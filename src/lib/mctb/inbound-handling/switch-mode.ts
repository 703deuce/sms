import "server-only";

import { getPrisma } from "@/lib/db";
import { invalidateMctbInboundRoutingProfile } from "@/lib/mctb/texml-ingress/routing-profile";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";
import {
  ensureMctbTexmlApplication,
  routePhoneToTexmlApp,
} from "@/lib/mctb/texml-ingress/texml-route";
import { routePhoneToTexmlAssistant } from "@/lib/voice/telnyx/texml-direct-route";
import { MCTB_TEXML_DEFAULT_APP_ID } from "@/lib/mctb/texml-ingress/constants";
import type { InboundHandlingMode } from "./types";
import { loadMctbLineInboundConfig, persistMctbLineInboundConfig } from "./line-config";
import { getVoiceAgentReadiness } from "./voice-readiness";
import { emitInboundHandlingTrace } from "./trace";

export type SetInboundHandlingModeResult =
  | { ok: true; mode: InboundHandlingMode; telephonyPath: string }
  | { ok: false; error: string; blockingReasons?: string[] };

export async function setInboundHandlingMode(input: {
  workspaceId: string;
  mode: InboundHandlingMode;
  phoneNumberId?: string | null;
  voiceAgentId?: string | null;
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

  let telephonyPath = "";

  if (input.mode === "VOICE_AGENT") {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId!, workspaceId: input.workspaceId },
      select: { telnyxAssistantId: true },
    });
    const assistantId = agent?.telnyxAssistantId?.trim();
    if (!assistantId) {
      return { ok: false, error: "missing_telnyx_assistant" };
    }

    const mctbTexmlAppId =
      line.mctbTexmlAppId ||
      (await ensureMctbTexmlApplication({
        preferredAppId:
          process.env.MCTB_TEXML_APP_ID?.trim() || MCTB_TEXML_DEFAULT_APP_ID,
      }));

    const routed = await routePhoneToTexmlAssistant({
      e164: phone.e164,
      assistantId,
      providerNumberId: phone.providerNumberId,
      preferredTexmlAppId: line.voiceTexmlAppId || undefined,
    });

    telephonyPath = routed.path;

    await persistMctbLineInboundConfig({
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      patch: {
        inboundHandlingMode: "VOICE_AGENT",
        voiceAgentId: agentId!,
        voiceAgentEnabled: true,
        voiceTexmlAppId: routed.texmlAppId,
        mctbTexmlAppId: mctbTexmlAppId,
        configRevision: `voice-on-${Date.now()}`,
      },
    });

    await prisma.voiceAgent.updateMany({
      where: { id: agentId!, workspaceId: input.workspaceId },
      data: { phoneNumberId: phone.id },
    });

    await emitInboundHandlingTrace({
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      event: "VOICE_AGENT_SELECTED",
      detail: { assistantId, texmlAppId: routed.texmlAppId, path: telephonyPath },
    });
  } else {
    const mctbTexmlAppId =
      line.mctbTexmlAppId ||
      (await ensureMctbTexmlApplication({
        preferredAppId:
          process.env.MCTB_TEXML_APP_ID?.trim() || MCTB_TEXML_DEFAULT_APP_ID,
      }));

    await routePhoneToTexmlApp({
      e164: phone.e164,
      providerNumberId: phone.providerNumberId,
      texmlAppId: mctbTexmlAppId,
    });

    telephonyPath = `${phone.e164} → MCTB TeXML ${mctbTexmlAppId}`;

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
      detail: { texmlAppId: mctbTexmlAppId, path: telephonyPath },
    });
  }

  invalidateMctbTexmlIngressCache(phone.e164);
  invalidateMctbInboundRoutingProfile(phone.e164);

  return { ok: true, mode: input.mode, telephonyPath };
}
