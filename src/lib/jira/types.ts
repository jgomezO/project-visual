export interface JiraProject {
  id: string;
  key: string;
  name: string;
  lead?: { displayName?: string } | null;
}

export interface JiraProjectSearchResponse {
  values: JiraProject[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
  total?: number;
}

export interface JiraApproximateCountResponse {
  count: number;
}

export interface ProjectStats {
  total: number;
  done: number;
  donePct: number;
}

export interface ProjectWithStats extends JiraProject {
  stats: ProjectStats;
}

export class JiraApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "JiraApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export interface JiraSearchIssue {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

export interface JiraIssueSearchRequest {
  jql: string;
  fields?: string[];
  expand?: string[];
  maxResults?: number;
  nextPageToken?: string;
}

export interface JiraIssueSearchResponse {
  issues: JiraSearchIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}
