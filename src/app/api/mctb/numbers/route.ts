import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  enrichWorkspacePhoneWithMessagingStatus,
  loadMctbSetupPhoneOptions,
} from "@/lib/numbers/workspace-accessible-numbers";
import { provisionTrialMctbNumber } from "@/lib/mctb/onboarding/trial-number";
import { getTfvStatusForWorkspace, syncTrialTollFreeVerification } from "@/lib/mctb/tfv/service";
import { tfvStatusLabel, mapTfvRecordToUiStatus } from "@/lib/mctb/onboarding/trial-number";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await syncTrialTollFreeVerification(auth.workspaceId).catch(() => undefined);

    const [rows, mctbConfig, tfv] = await Promise.all([
      loadMctbSetupPhoneOptions(auth.workspaceId),
      loadMissedCallTextConfig(auth.workspaceId),
      getTfvStatusForWorkspace(auth.workspaceId),
    ]);

    const enriched = enrichWorkspacePhoneWithMessagingStatus(rows);
    const numbers = enriched.map((n) => ({
      id: n.id,
      e164: n.e164,
      friendlyName: n.friendlyName,
      type: n.type,
      provider: n.provider,
      status: n.status,
      messagingStatus: n.messagingStatus,
      voiceReady: String(n.status || "").toLowerCase() === "active",
    }));

    return NextResponse.json({
      data: {
        numbers,
        activePhoneNumberId: mctbConfig.phoneNumberId ?? null,
        tfv: {
          status: tfv.status,
          approved: tfv.approved,
          statusLabel: tfvStatusLabel(mapTfvRecordToUiStatus(tfv.status)),
          failureReason: tfv.record?.failureReason || null,
          e164: tfv.e164,
        },
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

    const body = (await req.json()) as {
      action?: "select" | "provision_auto";
      phoneNumberId?: string;
    };

    if (body.action === "provision_auto") {
      const result = await provisionTrialMctbNumber(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, trialNumber: result.trialNumber });
    }

    if (body.action === "select" && body.phoneNumberId) {
      const prisma = getPrisma();
      const phone = await prisma.phoneNumber.findFirst({
        where: { id: body.phoneNumberId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!phone) {
        return NextResponse.json({ error: "Number not found" }, { status: 404 });
      }
      await updateMissedCallTextConfig({
        workspaceId: auth.workspaceId,
        patch: { phone_number_id: body.phoneNumberId },
        actor: auth.session.userId,
        source: "mctb_number_drawer",
      });
      return NextResponse.json({ ok: true, phoneNumberId: body.phoneNumberId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
