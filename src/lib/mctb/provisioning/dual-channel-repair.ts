import "server-only";

import { assertMctbProvisionPhoneInWorkspace } from "@/lib/mctb/provision-policy";
import { readPhoneMctbSettings } from "@/lib/mctb/sip-ingress/sync";
import { switchDidToMctbTexmlIngress } from "@/lib/mctb/texml-ingress/provision";
import {
  repairMessagingOnWorkspaceNumber,
  verifyAndPersistNumber,
  type NumberDiagnostics,
} from "@/lib/phone/telnyx-dual-provision";

export type ReassertMctbTexmlVoiceRouteResult = {
  ok: boolean;
  e164: string;
  phoneNumberId: string;
  actions: string[];
  error?: string;
};

/**
 * Re-point voice at the frozen MCTB TeXML pipeline without touching runtime config.
 * SMS / messaging profile is unchanged — pair with repairMessagingOnWorkspaceNumber.
 */
export async function reassertMctbTexmlVoiceRoute(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<ReassertMctbTexmlVoiceRouteResult> {
  const phone = await assertMctbProvisionPhoneInWorkspace(input);
  const settings = readPhoneMctbSettings(phone.settingsJson);
  const roleRaw = String(settings.mctbRole || "customer_mctb").toLowerCase();
  const mctbRole =
    roleRaw === "platform_demo" ? ("platform_demo" as const) : ("customer_mctb" as const);

  const actions = ["mctb_texml_voice_reassert"];
  try {
    const routed = await switchDidToMctbTexmlIngress({
      workspaceId: phone.workspaceId,
      phoneNumberId: phone.id,
      friendlyName: mctbRole === "platform_demo" ? "MCTB Platform Demo" : `MCTB ${phone.e164}`,
      mctbRole,
    });
    actions.push(
      `mctb_texml_app:${String((routed.texmlRoute as { texmlAppId?: string }).texmlAppId || "")}`,
      `mctb_texml_route:${routed.verify.ok ? "verified" : "unverified"}`,
    );
    if (!routed.ok || !routed.verify.ok) {
      throw new Error(routed.verify.failReason || "mctb_texml_route_failed");
    }
    return {
      ok: true,
      e164: phone.e164,
      phoneNumberId: phone.id,
      actions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      e164: phone.e164,
      phoneNumberId: phone.id,
      actions,
      error: message || "mctb_texml_voice_reassert_failed",
    };
  }
}

/**
 * MCTB numbers are dual-channel: frozen TeXML voice + workspace SMS (campaigns, drip, MCTB texts).
 */
export async function repairMctbDualChannelNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberDiagnostics> {
  const voice = await reassertMctbTexmlVoiceRoute(input);
  if (!voice.ok) {
    throw new Error(voice.error || "mctb_texml_voice_reassert_failed");
  }
  await repairMessagingOnWorkspaceNumber(input);
  return verifyAndPersistNumber(input);
}
