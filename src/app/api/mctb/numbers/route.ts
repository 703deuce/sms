import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  enrichWorkspacePhoneWithMessagingStatus,
  loadMctbSetupPhoneOptions,
} from "@/lib/numbers/workspace-accessible-numbers";
import { ensureMctbWorkspaceIngressReady } from "@/lib/mctb/provisioning/ensure-workspace-ingress";
import { wireMctbWorkspaceIngressPhone } from "@/lib/mctb/provisioning/wire-workspace-ingress-phone";
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
      confirmVoiceProductSwitch?: boolean;
    };

    if (body.action === "provision_auto") {
      const result = await ensureMctbWorkspaceIngressReady(auth.workspaceId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Provisioning failed" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        forwardE164: result.e164,
        phoneNumberId: result.phoneNumberId,
      });
    }

    if (body.action === "select" && body.phoneNumberId) {
      const confirmSwitch = body.confirmVoiceProductSwitch === true;
      const { getVoiceProductSwitchConflict } = await import(
        "@/lib/phone/voice-product-switch"
      );
      const switchConflict = await getVoiceProductSwitchConflict({
        workspaceId: auth.workspaceId,
        phoneNumberId: body.phoneNumberId,
        targetProduct: "mctb",
      });
      if (switchConflict && !confirmSwitch) {
        return NextResponse.json(
          {
            error: switchConflict.message,
            code: switchConflict.code,
            voiceProductSwitch: switchConflict,
          },
          { status: 409 },
        );
      }
      const wired = await wireMctbWorkspaceIngressPhone(auth.workspaceId, body.phoneNumberId);
      if (!wired.ok) {
        return NextResponse.json({ error: wired.error || "Could not wire ingress" }, { status: 400 });
      }
      const { ensureMctbPlatformSenderDefault } = await import(
        "@/lib/mctb/ensure-platform-sender-default"
      );
      await ensureMctbPlatformSenderDefault(auth.workspaceId).catch(() => undefined);
      return NextResponse.json({ ok: true, phoneNumberId: body.phoneNumberId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
