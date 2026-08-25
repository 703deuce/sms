/**
 * Map technical CRM/OAuth errors to customer-safe messages.
 */

export function humanizeCrmError(err: unknown, context?: string): string {
  const raw = err instanceof Error ? err.message : String(err || "Unknown error");
  const lower = raw.toLowerCase();

  if (
    /redirect_uri|redirect uri|callback.?mismatch|invalid.?callback|APP_URL is missing|couldn.?t return/i.test(
      raw,
    )
  ) {
    return "The CRM couldn’t return to Transovo after sign-in. Ask your admin to confirm the callback URL matches exactly.";
  }
  if (/client_id|client id|invalid_client|consumer key/i.test(lower)) {
    return "CRM app credentials look wrong or incomplete. Check the client ID/secret in environment settings.";
  }
  if (/invalid_grant|expired.*code|authorization code/i.test(lower)) {
    return "The sign-in link expired. Click Connect again and finish authorization within a couple of minutes.";
  }
  if (
    /needs_reauth|must reconnect|refresh.?token.*(expired|revoked|invalid|missing)|no refresh token/i.test(
      lower,
    )
  ) {
    return "Your CRM connection expired. Click Reconnect to authorize Transovo again — your mappings are kept.";
  }
  if (/\b429\b|too many requests|rate.?limit(ed)?/i.test(lower)) {
    return "The CRM temporarily limited requests. Transovo will retry automatically; try again in a few minutes if it persists.";
  }
  if (/permission|insufficient|forbidden|unauthorized|access denied|INVALID_FIELD|REQUIRED_FIELD/i.test(raw)) {
    return "Transovo doesn’t have enough permission in the CRM for that action. Ask a CRM admin to grant access to the required objects/fields.";
  }
  if (/not configured|missing|env/i.test(lower)) {
    return context
      ? `${context} isn’t fully configured yet. Open Diagnostics for the missing setup steps.`
      : "CRM integration isn’t fully configured yet. Open Diagnostics for the missing setup steps.";
  }
  if (/network|fetch failed|econnreset|timeout|enotfound/i.test(lower)) {
    return "Couldn’t reach the CRM. Check network connectivity and try again.";
  }
  if (/duplicate|collision/i.test(lower)) {
    return "A matching contact already exists in the CRM. Transovo linked to the existing record instead of creating a duplicate.";
  }

  // Keep short technical detail for admins, but softer for customers.
  if (raw.length > 160) return `${raw.slice(0, 157)}…`;
  return raw;
}
