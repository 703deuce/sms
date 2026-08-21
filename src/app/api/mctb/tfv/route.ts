import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getTfvStatusForWorkspace,
  submitTrialTollFreeVerification,
  syncTrialTollFreeVerification,
} from "@/lib/mctb/tfv/service";
import { tfvStatusLabel, mapTfvRecordToUiStatus } from "@/lib/mctb/onboarding/trial-number";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);
    const status = await getTfvStatusForWorkspace(auth.workspaceId);
    return NextResponse.json({
      data: {
        ...status,
        statusLabel: tfvStatusLabel(mapTfvRecordToUiStatus(status.status)),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "sync") {
      const result = await syncTrialTollFreeVerification(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      const status = await getTfvStatusForWorkspace(auth.workspaceId);
      return NextResponse.json({ ok: true, data: status });
    }

    const result = await submitTrialTollFreeVerification(auth.workspaceId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const status = await getTfvStatusForWorkspace(auth.workspaceId);
    return NextResponse.json({ ok: true, deduped: result.deduped, data: status });
  } catch (err) {
    return jsonError(err, 500);
  }
}
