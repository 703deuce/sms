import "server-only";

import { getPrisma } from "@/lib/db";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import { mergeCallHandlingIntoSettings } from "@/lib/call-handling/phone-settings";
import { invalidateMctbInboundRoutingProfile } from "@/lib/mctb/texml-ingress/routing-profile";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";
import type { InboundHandlingMode } from "./types";
import { loadMctbLineInboundConfig, persistMctbLineInboundConfig } from "./line-config";
import { getVoiceAgentReadiness } from "./voice-readiness";
import { emitInboundHandlingTrace } from "./trace";

export type SetInboundHandlingModeResult =
  | { ok: true; mode: InboundHandlingMode; telephonyPath: string }
  | { ok: false; error: string; blockingReasons?: string[] };

/**
 * Legacy MCTB inbound-handling mode switch — Telnyx ownership mutations delegate to
 * `setActiveCallHandler` (PR #483). This function only updates line metadata labels.
 */
export async function setInboundHandlingMode(input: {
  workspaceId: string;
  mode: InboundHandlingMode;
  phoneNumberId?: string | null;
  voiceAgentId?: string | null;
  userId?: string | null;
}): Promise<SetInboundHandlingModeResult> {
  const line = await loadMctbLineInboundConfig({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
  if (!line) {
    return { ok: false, error: "line_not_configured" };
  }

  const agentId = input.voiceAgentId?.trim() || line.voiceAgentId;
  if (input.mode === "VOICE_AGENT") {
    if (!agentId) {
      return { ok: false, error: "voice_agent_id_required" };
    }
    const readiness = await getVoiceAgentReadiness({
      workspaceId: input.workspaceId,
      agentId,
      phoneNumberId: line.phoneNumberId,
    });
    if (!readiness.canAnswer) {
      return {
        ok: false,
        error: "voice_agent_not_ready",
        blockingReasons: readiness.reasons,
      };
    }
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: line.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    return { ok: false, error: "phone_missing_provider_id" };
  }

  if (input.mode === "VOICE_AGENT" && agentId) {
    const settings = mergeCallHandlingIntoSettings(phone.settingsJson, {
      parkedAiReceptionistAgentId: agentId,
    });
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: { settingsJson: settings as object },
    });
  }

  const handler = input.mode === "VOICE_AGENT" ? "ai_receptionist" : "mctb";

  try {
    const state = await setActiveCallHandler({
      workspaceId: input.workspaceId,
      voiceIngressPhoneNumberId: phone.id,
      handler,
      userId: input.userId ?? null,
    });

    const telephonyPath =
      state.effectiveHandler === "ai_receptionist"
        ? `${phone.e164} → AI Receptionist (Voice V3)`
        : `${phone.e164} → MCTB call-handling ingress`;

    if (input.mode === "VOICE_AGENT") {
      await persistMctbLineInboundConfig({
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
        patch: {
          inboundHandlingMode: "VOICE_AGENT",
          voiceAgentId: agentId!,
          voiceAgentEnabled: true,
          configRevision: `voice-on-${Date.now()}`,
        },
      });

      await emitInboundHandlingTrace({
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
        event: "VOICE_AGENT_SELECTED",
        detail: { voiceAgentId: agentId, path: telephonyPath },
      });
    } else {
      await persistMctbLineInboundConfig({
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
        patch: {
          inboundHandlingMode: "MCTB_RECOVERY",
          voiceAgentEnabled: false,
          configRevision: `mctb-on-${Date.now()}`,
        },
      });

      await emitInboundHandlingTrace({
        workspaceId: input.workspaceId,
        phoneNumberId: phone.id,
        event: "MCTB_RECOVERY_SELECTED",
        detail: { path: telephonyPath },
      });
    }

    invalidateMctbTexmlIngressCache(phone.e164);
    invalidateMctbInboundRoutingProfile(phone.e164);

    return { ok: true, mode: input.mode, telephonyPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : "switch_failed";
    return { ok: false, error: message };
  }
}
