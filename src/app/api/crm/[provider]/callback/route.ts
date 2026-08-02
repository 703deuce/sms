import { NextResponse } from "next/server";
import {
  handleCrmOAuthCallback,
  providerFromCallbackParam,
} from "@/lib/crm/oauth-callback-handler";
import { getIntegrationAppUrl } from "@/lib/integrations/framework/app-url";

/**
 * Provider-specific OAuth callbacks registered in CRM consoles:
 *   /api/crm/zoho/callback
 *   /api/crm/pipedrive/callback
 *   /api/crm/salesforce/callback
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await params;
  const provider = providerFromCallbackParam(raw);
  if (!provider) {
    return NextResponse.redirect(
      `${getIntegrationAppUrl()}/integrations/crm?connected_error=${encodeURIComponent(
        "Unknown CRM provider callback.",
      )}`,
    );
  }
  return handleCrmOAuthCallback(request, provider);
}
