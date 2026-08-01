import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { isCrmProvider } from "@/lib/crm/registry";
import { getCrmSyncPreferences, updateCrmSyncPreferences } from "@/lib/crm/settings";
import type { CrmSyncPreferences } from "@/lib/crm/types";
import { disconnectCrm } from "@/lib/crm/oauth";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider");
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    const preferences = await getCrmSyncPreferences(auth.workspaceId, provider);
    return NextResponse.json({ data: preferences });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { requireCrmPermission } = await import("@/lib/crm/permissions");
    await requireCrmPermission(auth.session.userId, auth.workspaceId, "configure_crm");
    const body = (await request.json()) as {
      provider?: string;
      preferences?: Partial<CrmSyncPreferences>;
    };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    const preferences = await updateCrmSyncPreferences(
      auth.workspaceId,
      provider,
      body.preferences || {},
      auth.session.userId,
    );
    return NextResponse.json({ data: preferences });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { requireCrmPermission } = await import("@/lib/crm/permissions");
    await requireCrmPermission(auth.session.userId, auth.workspaceId, "disconnect_crm");
    const provider = new URL(request.url).searchParams.get("provider");
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    await disconnectCrm(auth.workspaceId, provider, auth.session.userId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
