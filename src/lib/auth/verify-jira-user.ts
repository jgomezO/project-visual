import "server-only";
import { getJiraEnv } from "@/lib/jira/env";

interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName?: string;
  active?: boolean;
}

// Looks up a user by email against Jira's REST API and returns their
// accountId if (and only if) an exact email match is found.
//
// Fail-closed: any error (timeout, 5xx, non-array response, missing
// emailAddress on results, etc.) returns null. Better to refuse a real
// user once than to let through someone whose Jira account doesn't
// actually exist.
//
// Called once per user: the OAuth callback caches the accountId in
// user_profiles so subsequent logins skip the round-trip. See
// /auth/callback/route.ts.
export async function verifyUserInJira(email: string): Promise<string | null> {
  const env = getJiraEnv();
  const auth = Buffer.from(`${env.email}:${env.apiToken}`).toString("base64");
  const url = `${env.baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(
    email,
  )}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      // Hard ceiling so a Jira outage doesn't stall login indefinitely.
      // 5s leaves room for normal latency without making the user wait.
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[verifyUserInJira] network error:", err);
    return null;
  }

  if (!response.ok) {
    console.warn(
      `[verifyUserInJira] Jira returned ${response.status} for ${email}`,
    );
    return null;
  }

  let users: JiraUser[];
  try {
    const json = (await response.json()) as unknown;
    if (!Array.isArray(json)) {
      console.warn("[verifyUserInJira] non-array response from Jira");
      return null;
    }
    users = json as JiraUser[];
  } catch (err) {
    console.warn("[verifyUserInJira] failed to parse Jira response:", err);
    return null;
  }

  if (users.length === 0) return null;

  // The query parameter does substring/prefix match across name + email,
  // so we have to filter for exact email match. Workspace tenants
  // include emailAddress in the response; if Jira hides it (some
  // configs do), we conservatively return null rather than guessing.
  const exact = users.find(
    (u) => u.emailAddress?.toLowerCase() === email.toLowerCase(),
  );
  if (!exact) {
    console.warn(
      `[verifyUserInJira] no exact email match for ${email} (got ${users.length} fuzzy hit(s))`,
    );
    return null;
  }
  return exact.accountId;
}
