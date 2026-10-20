/**
 * Shared CRM OAuth callback handler for provider-specific redirect URIs:
 *   /api/crm/zoho/callback
 *   /api/crm/pipedrive/callback
 *   /api/crm/salesforce/callback
 * Legacy shared route /api/crm/oauth/callback still works via state.provider.
 */

import { NextResponse } from "next/server";
import { getIntegrationAppUrl } from "@/lib/integrations/framework/app-url";
import { humanizeCrmError } from "./human-errors";
import { completeCrmOAuth, parseCrmOAuthState } from "./oauth";
import { isCrmProvider } from "./registry";
import type { CrmProviderId } from "./types";

function appUrl() {
  return getIntegrationAppUrl();
}

export async function handleCrmOAuthCallback(
  request: Request,
  expectedProvider?: CrmProviderId,
) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    const human = humanizeCrmError(oauthError, "CRM connect");
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected_error=${encodeURIComponent(human.slice(0, 200))}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected_error=${encodeURIComponent(
        "Sign-in didn't finish. Click Connect and try again.",
      )}`,
    );
  }

  const parsed = parseCrmOAuthState(state);
  if (!parsed) {
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected_error=${encodeURIComponent(
        "Sign-in expired or was tampered with. Click Connect and try again.",
      )}`,
    );
  }

  if (expectedProvider && parsed.provider !== expectedProvider) {
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected_error=${encodeURIComponent(
        `OAuth provider mismatch (expected ${expectedProvider}).`,
      )}`,
    );
  }

  try {
    const accountsServer =
      url.searchParams.get("accounts-server") ||
      url.searchParams.get("accounts_server");
    const location = url.searchParams.get("location");
    const { workspaceId, provider } = await completeCrmOAuth(code, state, {
      accountsServer,
      location,
    });
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected=${encodeURIComponent(provider)}`,
    );
  } catch (err) {
    const msg = humanizeCrmError(err, "CRM connect");
    return NextResponse.redirect(
      `${appUrl()}/app/integrations?provider=crm&connected_error=${encodeURIComponent(msg.slice(0, 200))}`,
    );
  }
}

export function providerFromCallbackParam(raw: string | undefined): CrmProviderId | null {
  if (!raw) return null;
  return isCrmProvider(raw) ? raw : null;
}
