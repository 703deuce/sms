import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  diagnoseWorkspaceNumber,
  enableVoiceOnWorkspaceNumber,
  getDualProvisionEnvStatus,
  provisionPurchasedNumber,
  repairMessagingOnWorkspaceNumber,
  verifyAndPersistNumber,
} from "@/lib/phone/telnyx-dual-provision";
import {
  diagnoseTelnyxOutboundVoice,
  ensureTelnyxOutboundVoiceReady,
  testTelnyxOutboundDial,
} from "@/lib/phone/telnyx-outbound-voice";
import { getPrisma } from "@/lib/db";

type Action =
  | "diagnose"
  | "verify"
  | "enable_voice"
  | "repair_voice"
  | "repair_messaging"
  | "provision"
  | "diagnose_outbound"
  | "repair_outbound"
  | "test_outbound";

/**
 * Dual SMS + voice provisioning actions for a workspace number.
 * Body: { action, to? }
 * Never clears messaging_profile_id when assigning voice.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: Action;
      to?: string;
    };
    const action = (body.action || "diagnose") as Action;

    if (
      action === "diagnose_outbound" ||
      action === "repair_outbound" ||
      action === "test_outbound"
    ) {
      const row = await getPrisma().phoneNumber.findFirst({
        where: { id: numberId, workspaceId: auth.workspaceId },
        select: { e164: true, providerNumberId: true, settingsJson: true },
      });
      if (!row) return NextResponse.json({ error: "Number not found" }, { status: 404 });

      if (action === "diagnose_outbound") {
        const outbound = await diagnoseTelnyxOutboundVoice({
          callerIdE164: row.e164,
        });
        return NextResponse.json({
          data: { outbound, e164: row.e164 },
          env: getDualProvisionEnvStatus(),
        });
      }

      if (action === "repair_outbound") {
        const outbound = await ensureTelnyxOutboundVoiceReady({
          callerIdE164: row.e164,
        });
        const diag = await diagnoseWorkspaceNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        return NextResponse.json({
          data: { outbound, diagnose: diag },
          env: getDualProvisionEnvStatus(),
        });
      }

      const to = String(body.to || "").trim();
      if (!to) {
        return NextResponse.json(
          {
            error:
              "Provide body.to as the E.164 destination for the outbound diagnostic call",
          },
          { status: 400 },
        );
      }
      const test = await testTelnyxOutboundDial({
        fromE164: row.e164,
        toE164: to,
        workspaceId: auth.workspaceId,
      });
      return NextResponse.json({
        data: { test, e164: row.e164 },
        env: getDualProvisionEnvStatus(),
      });
    }

    let data;
    switch (action) {
      case "enable_voice":
      case "repair_voice":
        data = await enableVoiceOnWorkspaceNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        break;
      case "repair_messaging":
        data = await repairMessagingOnWorkspaceNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        break;
      case "provision":
        data = await provisionPurchasedNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        break;
      case "verify":
        data = await verifyAndPersistNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        break;
      case "diagnose":
      default:
        data = await diagnoseWorkspaceNumber({
          workspaceId: auth.workspaceId,
          phoneNumberId: numberId,
        });
        break;
    }

    return NextResponse.json({
      data,
      env: getDualProvisionEnvStatus(),
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const data = await diagnoseWorkspaceNumber({
      workspaceId: auth.workspaceId,
      phoneNumberId: numberId,
    });
    return NextResponse.json({ data, env: getDualProvisionEnvStatus() });
  } catch (err) {
    return jsonError(err, 400);
  }
}
