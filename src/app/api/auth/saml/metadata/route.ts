import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const saml = (platform as { samlSso?: { enabled?: boolean; entityId?: string; ssoUrl?: string } }).samlSso;
    if (!saml?.enabled) return NextResponse.json({ error: "SAML not enabled" }, { status: 404 });

    const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${saml.entityId || `transovo:${workspaceId}`}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${process.env.APP_URL || ""}/api/auth/saml/acs?workspaceId=${workspaceId}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

    return new NextResponse(metadata, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
