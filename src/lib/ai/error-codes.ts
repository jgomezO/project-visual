// Shared error-code vocabulary for in-stream AI errors (iter 7).
//
// The route handler classifies caught Anthropic SDK errors into one
// of these codes and sends it via the SSE error frame; the client
// hook maps it to a localized user-facing string from
// narratives.ai.errors.*.
//
// Out-of-stream errors (401 from our auth gate, 404 when issues are
// missing, 400 invalid body) flow through HTTP status codes instead
// — see mapHttpStatus in useWorkstreamDescriptionAI.

export type AIErrorCode =
  // Anthropic 401/403: API key invalid, expired, or lacks permission.
  // Maps to: errors.configMissing — surfaces "AI configuration not
  // available. Contact administrator." to the user.
  | "config"
  // Anthropic 429: rate limit OR per-account quota.
  // Maps to: errors.rateLimited.
  | "rate"
  // Anthropic 5xx OR APIConnectionError: their service is down.
  // Maps to: errors.serviceUnavailable.
  | "service"
  // APIConnectionTimeoutError OR our SSE stream closed without a
  // terminal frame (usually = Vercel function timeout).
  // Maps to: errors.timeout.
  | "timeout"
  // Catch-all for unclassified SDK errors. Maps to: errors.generic.
  | "generic";
