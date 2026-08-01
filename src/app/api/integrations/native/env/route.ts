import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getIntegrationEnvHealth, externalOAuthCallbackUrl } from "@/lib/integrations/framework/app-url";
import { NATIVE_PROVIDER_CATALOG } from "@/lib/integrations/framework";

/** Safe configuration health — never returns secret values. */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const health = getIntegrationEnvHealth();
    return NextResponse.json({
      data: {
        health,
        callbacks: {
          calendly: externalOAuthCallbackUrl("calendly"),
          mailchimp: externalOAuthCallbackUrl("mailchimp"),
          typeform: externalOAuthCallbackUrl("typeform"),
        },
        providers: NATIVE_PROVIDER_CATALOG.map((p) => ({
          id: p.id,
          authKind: p.authKind,
          displayName: p.displayName,
          credentialFields: (p.credentialFields || []).map((f) => ({
            key: f.key,
            label: f.label,
            required: f.required !== false,
          })),
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
