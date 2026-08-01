import { handleCrmOAuthCallback } from "@/lib/crm/oauth-callback-handler";

/**
 * Legacy shared callback — prefer provider-specific routes:
 *   /api/crm/zoho/callback
 *   /api/crm/pipedrive/callback
 */
export async function GET(request: Request) {
  return handleCrmOAuthCallback(request);
}
