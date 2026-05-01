import "server-only";

export interface JiraEnv {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKeys: string[] | null;
}

let cached: JiraEnv | null = null;

export function getJiraEnv(): JiraEnv {
  if (cached) return cached;

  const baseUrl = process.env.JIRA_BASE_URL?.trim();
  const email = process.env.JIRA_EMAIL?.trim();
  const apiToken = process.env.JIRA_API_TOKEN?.trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push("JIRA_BASE_URL");
  if (!email) missing.push("JIRA_EMAIL");
  if (!apiToken) missing.push("JIRA_API_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Missing required Jira env var(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill in your credentials.`,
    );
  }

  const rawKeys = process.env.JIRA_PROJECT_KEYS?.trim();
  const projectKeys = rawKeys
    ? rawKeys
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  cached = {
    baseUrl: baseUrl!.replace(/\/+$/, ""),
    email: email!,
    apiToken: apiToken!,
    projectKeys: projectKeys.length > 0 ? projectKeys : null,
  };
  return cached;
}
