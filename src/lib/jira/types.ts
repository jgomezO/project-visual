export interface JiraProject {
  id: string;
  key: string;
  name: string;
  lead?: { accountId?: string; displayName?: string } | null;
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

// Field shapes within JiraSearchIssue.fields. The sync layer reads these.
// Custom fields are addressed by their tenant-specific id (see
// JIRA_START_DATE_FIELD_ID below). If running against another Jira
// instance with different field ids, those constants must be updated
// (TODO: parametrize via env).
export interface JiraIssueFields {
  summary?: string;
  issuetype?: { name?: string };
  status?: {
    name?: string;
    statusCategory?: { name?: string; key?: string };
  };
  assignee?: { accountId?: string; displayName?: string } | null;
  priority?: { name?: string } | null;
  parent?: { id?: string; key?: string } | null;
  duedate?: string | null;
  created?: string;
  updated?: string;
  issuelinks?: JiraIssueLink[];
  // Custom field for "Start date" (system datepicker). Tenant-specific
  // id; see src/lib/sync/issues.ts for the constant.
  [customField: `customfield_${number}`]: string | null | undefined;
}

// Jira field id for "Start date" in this tenant. Verified via
// GET /rest/api/3/field. If you swap to another Jira Cloud instance,
// re-query and update this value.
export const JIRA_START_DATE_FIELD_ID = "customfield_10015" as const;

export interface JiraIssueLink {
  type: { name: string; inward: string; outward: string };
  inwardIssue?: { id: string; key: string };
  outwardIssue?: { id: string; key: string };
}
