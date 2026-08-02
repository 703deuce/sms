import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getIntegrationMetadata } from "@/lib/integrations/product/contact-crm-context";

const ALLOWED = new Set(["salesforce", "zoho", "pipedrive", "calendly"]);

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") || "";

    if (!ALLOWED.has(provider)) {
      return NextResponse.json(
        { error: "provider must be salesforce, zoho, pipedrive, or calendly" },
        { status: 400 },
      );
    }

    const data = await getIntegrationMetadata(auth.workspaceId, provider);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("Unsupported provider")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return jsonError(err, 500);
  }
}
