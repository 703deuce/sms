import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  ensureNoShowRecoveryWorkflow,
  getNoShowRecoveryConfig,
  getNoShowRecoveryStats,
  runNoShowRecoveryScan,
  saveNoShowRecoveryConfig,
} from "@/lib/appointments/no-show-recovery";

export async function GET() {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;

    const [config, stats] = await Promise.all([
      getNoShowRecoveryConfig(auth.workspaceId),
      getNoShowRecoveryStats(auth.workspaceId),
    ]);
    return NextResponse.json({ data: { config, stats } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      action?: string;
      config?: Record<string, unknown>;
    };

    if (body.action === "install-workflow") {
      const workflow = await ensureNoShowRecoveryWorkflow(auth.workspaceId);
      return NextResponse.json({ data: { workflow } });
    }

    if (body.action === "scan") {
      const result = await runNoShowRecoveryScan(auth.workspaceId);
      return NextResponse.json({ data: result });
    }

    if (body.config) {
      const saved = await saveNoShowRecoveryConfig(auth.workspaceId, body.config as Parameters<typeof saveNoShowRecoveryConfig>[1]);
      if (saved.autoInstallWorkflow) {
        await ensureNoShowRecoveryWorkflow(auth.workspaceId);
      }
      return NextResponse.json({ data: saved });
    }

    return NextResponse.json({ error: "action or config required" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
