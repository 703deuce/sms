import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  DIAGNOSTIC_PROBE_IDS,
  getCrmDiagnosticsSnapshot,
  runCrmDiagnosticProbe,
  type ProbeId,
} from "@/lib/crm/diagnostics";
import { getFeatureMatrix } from "@/lib/crm/feature-matrix";
import { humanizeCrmError } from "@/lib/crm/human-errors";
import { isCrmProvider } from "@/lib/crm/registry";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const provider = new URL(request.url).searchParams.get("provider")?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }

    const snapshot = await getCrmDiagnosticsSnapshot(auth.workspaceId, provider);
    return NextResponse.json({
      data: {
        snapshot,
        probes: DIAGNOSTIC_PROBE_IDS,
        features: getFeatureMatrix(provider),
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
      probe?: string;
      action?: string;
    };
    const provider = body.provider?.trim();
    if (!provider || !isCrmProvider(provider)) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 400 });
    }

    if (body.action === "clear_quarantine") {
      const { requireCrmPermission } = await import("@/lib/crm/permissions");
      await requireCrmPermission(auth.session.userId, auth.workspaceId, "configure_crm");
      const { clearCrmQuarantine } = await import("@/lib/crm/circuit-breaker");
      const result = await clearCrmQuarantine({
        workspaceId: auth.workspaceId,
        provider,
        actorUserId: auth.session.userId,
      });
      return NextResponse.json({ data: result });
    }

    if (body.action === "acceptance") {
      const { requireCrmPermission } = await import("@/lib/crm/permissions");
      await requireCrmPermission(auth.session.userId, auth.workspaceId, "access_crm_diagnostics");
      const { runCrmAcceptanceSuite } = await import("@/lib/crm/acceptance");
      const report = await runCrmAcceptanceSuite(auth.workspaceId, provider);
      return NextResponse.json({ data: report });
    }

    const { requireCrmPermission } = await import("@/lib/crm/permissions");
    await requireCrmPermission(auth.session.userId, auth.workspaceId, "access_crm_diagnostics");

    const probe = body.probe?.trim() as ProbeId | undefined;
    if (!probe || !DIAGNOSTIC_PROBE_IDS.includes(probe)) {
      return NextResponse.json(
        { error: `Unknown probe. Allowed: ${DIAGNOSTIC_PROBE_IDS.join(", ")}` },
        { status: 400 },
      );
    }

    const result = await runCrmDiagnosticProbe({
      workspaceId: auth.workspaceId,
      provider,
      probe,
      actorUserId: auth.session.userId,
    });

    return NextResponse.json(
      {
        data: result,
        error: result.ok ? undefined : result.humanMessage || humanizeCrmError(result.message),
      },
      { status: result.ok || result.skipped ? 200 : 422 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: humanizeCrmError(err), technical: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
