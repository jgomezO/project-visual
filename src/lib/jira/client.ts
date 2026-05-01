import "server-only";
import { getJiraEnv } from "./env";
import {
  JiraApiError,
  type JiraApproximateCountResponse,
  type JiraIssueSearchRequest,
  type JiraIssueSearchResponse,
  type JiraProject,
  type JiraProjectSearchResponse,
  type JiraSearchIssue,
  type ProjectStats,
} from "./types";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const PAGE_SIZE = 50;

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly projectKeysFilter: string[] | null;

  constructor() {
    const env = getJiraEnv();
    this.baseUrl = env.baseUrl;
    this.authHeader =
      "Basic " +
      Buffer.from(`${env.email}:${env.apiToken}`, "utf-8").toString("base64");
    this.projectKeysFilter = env.projectKeys;
  }

  // TODO(supabase): this is a 1+2N call pattern (1 listProjects + 2 stats per
  // project). Acceptable for the first iteration; persist projects + computed
  // stats in Supabase next, refresh in the background, and drop these
  // synchronous round-trips from the request path.
  async listProjects(): Promise<JiraProject[]> {
    const all: JiraProject[] = [];
    let startAt = 0;
    while (true) {
      const params = new URLSearchParams({
        startAt: String(startAt),
        maxResults: String(PAGE_SIZE),
        expand: "lead",
        orderBy: "+name",
      });
      const res = await this.request<JiraProjectSearchResponse>(
        `/rest/api/3/project/search?${params.toString()}`,
      );
      all.push(...res.values);
      if (res.isLast || res.values.length < PAGE_SIZE) break;
      startAt += res.values.length;
    }

    if (this.projectKeysFilter) {
      const filterSet = new Set(this.projectKeysFilter);
      return all.filter((p) => filterSet.has(p.key));
    }
    return all;
  }

  async getProjectStats(projectKey: string): Promise<ProjectStats> {
    const escaped = escapeJqlString(projectKey);
    const totalJql = `project = "${escaped}"`;
    const doneJql = `${totalJql} AND statusCategory = Done`;

    const [total, done] = await Promise.all([
      this.approximateCount(totalJql),
      this.approximateCount(doneJql),
    ]);
    const donePct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, donePct };
  }

  // Cursor-paginated POST /rest/api/3/search/jql. Yields each page of issues
  // so the caller can stream-process (e.g., upsert in batches) instead of
  // buffering the whole result. The legacy GET /rest/api/3/search was removed
  // by Atlassian in May 2025; cursor pagination is the only supported way.
  async *searchIssuesPaginated(
    request: JiraIssueSearchRequest,
  ): AsyncGenerator<JiraSearchIssue[], void, unknown> {
    let nextPageToken: string | undefined = request.nextPageToken;

    while (true) {
      const body = {
        jql: request.jql,
        fields: request.fields ?? ["*all"],
        expand: request.expand,
        maxResults: request.maxResults ?? 100,
        nextPageToken,
      };

      const res = await this.request<JiraIssueSearchResponse>(
        "/rest/api/3/search/jql",
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        },
      );

      yield res.issues;

      if (res.isLast || !res.nextPageToken) break;
      nextPageToken = res.nextPageToken;
    }
  }

  async searchIssues(
    request: JiraIssueSearchRequest,
  ): Promise<JiraSearchIssue[]> {
    const all: JiraSearchIssue[] = [];
    for await (const page of this.searchIssuesPaginated(request)) {
      all.push(...page);
    }
    return all;
  }

  private async approximateCount(jql: string): Promise<number> {
    const res = await this.request<JiraApproximateCountResponse>(
      "/rest/api/3/search/approximate-count",
      {
        method: "POST",
        body: JSON.stringify({ jql }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return res.count;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastStatus = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        body: init?.body,
        headers: {
          Accept: "application/json",
          ...(init?.headers ?? {}),
          // SECURITY: never log or echo this header in errors, traces, or UI.
          Authorization: this.authHeader,
        },
        cache: "no-store",
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      lastStatus = res.status;

      if (res.status === 429 && attempt < MAX_RETRIES - 1) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : NaN;
        const delay =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? retryAfterSec * 1000
            : BASE_BACKOFF_MS * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      // SECURITY: do not include the Authorization header, the API token, or
      // the response body in the thrown error — Jira may echo request details
      // in error payloads.
      throw new JiraApiError(
        `Jira API request failed: ${res.status} ${res.statusText}`,
        res.status,
        path,
      );
    }

    throw new JiraApiError(
      `Jira API rate limit exceeded after ${MAX_RETRIES} attempts`,
      lastStatus,
      path,
    );
  }
}
