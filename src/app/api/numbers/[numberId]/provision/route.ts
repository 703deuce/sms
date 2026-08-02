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

type Action =
  | "diagnose"
  | "verify"
  | "enable_voice"
  | "repair_voice"
  | "repair_messaging"
  | "provision";

/**
 * Dual SMS + voice provisioning actions for a workspace number.
 * Body: { action: "diagnose" | "verify" | "enable_voice" | "repair_voice" | "repair_messaging" | "provision" }
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
    const body = (await request.json().catch(() => ({}))) as { action?: Action };
    const action = (body.action || "diagnose") as Action;

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
