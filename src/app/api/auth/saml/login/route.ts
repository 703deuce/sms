import { NextResponse } from "next/server";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { publicRedirectUrl } from "@/lib/integrations/framework/app-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const saml = (platform as { samlSso?: { enabled?: boolean; ssoUrl?: string; entityId?: string } }).samlSso;
  if (!saml?.enabled || !saml.ssoUrl) {
    return NextResponse.json({ error: "SAML SSO not configured" }, { status: 404 });
  }

  const relayState = searchParams.get("relayState") || "/appointments/overview";
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const acsUrl = `${appUrl}/api/auth/saml/acs?workspaceId=${encodeURIComponent(workspaceId)}`;
  const entityId = saml.entityId || `transovo:${workspaceId}`;

  const samlRequest = Buffer.from(
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${Date.now()}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${saml.ssoUrl}" AssertionConsumerServiceURL="${acsUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${entityId}</saml:Issuer></samlp:AuthnRequest>`,
  ).toString("base64");

  const redirectUrl = `${saml.ssoUrl}?SAMLRequest=${encodeURIComponent(samlRequest)}&RelayState=${encodeURIComponent(relayState)}`;
  return NextResponse.redirect(publicRedirectUrl(redirectUrl, request), 302);
}
