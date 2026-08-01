import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { isCrmProvider } from "@/lib/crm/registry";
import { getCrmRuntimeMetrics } from "@/lib/crm/runtime/metrics-runtime";
import { listAllSubscriptions } from "@/lib/crm/runtime/subscriptions";
import { defaultCrmRules } from "@/lib/crm/runtime/rules";
import { enqueueCrmMetadataRefresh } from "@/lib/crm/runtime/metadata-refresh";
import { enqueueCrmBulkSync } from "@/lib/crm/runtime/bulk-sync";
import { CRM_SDK_CHECKLIST } from "@/lib/crm/sdk";
import type { CrmProviderId } from "@/lib/crm/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const providerParam = new URL(request.url).searchParams.get("provider")?.trim();
    const provider =
      providerParam && isCrmProvider(providerParam)
        ? (providerParam as CrmProviderId)
        : undefined;

    const metrics = await getCrmRuntimeMetrics(auth.workspaceId, provider);
    return NextResponse.json({
      data: {
        metrics,
        subscriptions: listAllSubscriptions(),
        defaultRules: defaultCrmRules(),
        sdkChecklist: CRM_SDK_CHECKLIST,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      action?: "metadata_refresh" | "bulk_sync";
      objectType?: "contact" | "company" | "lead";
    };
    if (!body.provider || !isCrmProvider(body.provider)) {
      return NextResponse.json({ error: "provider required" }, { status: 400 });
    }
    if (body.action === "bulk_sync") {
      const run = await enqueueCrmBulkSync({
        workspaceId: auth.workspaceId,
        provider: body.provider,
        objectType: body.objectType || "contact",
        triggeredBy: auth.session.userId,
      });
      return NextResponse.json({ data: run }, { status: 202 });
    }
    const job = await enqueueCrmMetadataRefresh({
      workspaceId: auth.workspaceId,
      provider: body.provider,
      triggeredBy: auth.session.userId,
    });
    return NextResponse.json({ data: job }, { status: 202 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
