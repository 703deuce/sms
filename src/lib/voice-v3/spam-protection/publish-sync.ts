import "server-only";

import { isAppointmentReceptionistAgent } from "../config/from-published-agent";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { compileVoiceV3AgentConfig } from "../config/compile-voice-v3-agent-config";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { syncTelnyxInboundCallScreeningForPhone } from "./sync-telnyx-inbound-screening";
import { ensureTelnyxSpamHeaderMappingOnInboundTrunk } from "@/lib/telephony/provisioning/livekit/telnyx-spam-header-trunk";
import { isLiveKitVoiceRuntime } from "@/lib/voice/runtime-provider/config";

export async function syncVoiceV3SpamProtectionOnPublish(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string | null | undefined;
  config: VoiceAgentConfig;
}): Promise<{ ok: boolean; error?: string; telnyx?: unknown; livekitTrunk?: unknown }> {
  if (!input.phoneNumberId) {
    return { ok: true };
  }
  const parsed = parseVoiceAgentConfig(input.config);
  if (!isAppointmentReceptionistAgent(parsed)) {
    return { ok: true };
  }

  const advanced = parsed.advanced as Record<string, unknown> | undefined;
  const wizard = advanced?.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  if (!wizard) {
    return { ok: true };
  }

  const compiled = compileVoiceV3AgentConfig({ wizard, source: "wizard_published" });
  const policy = compiled.spamProtection?.spamLikelyPolicy ?? null;

  const telnyx = await syncTelnyxInboundCallScreeningForPhone({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    spamLikelyPolicy: policy,
    agentId: input.agentId,
  });

  let livekitTrunk: unknown = null;
  if (isLiveKitVoiceRuntime() && policy && policy !== "BLOCK") {
    const prisma = (await import("@/lib/db")).getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
      select: { e164: true },
    });
    if (phone?.e164) {
      livekitTrunk = await ensureTelnyxSpamHeaderMappingOnInboundTrunk(phone.e164);
    }
  }

  if (!telnyx.ok && !telnyx.skipped) {
    return {
      ok: false,
      error:
        telnyx.error ||
        "Spam protection could not be updated on your phone number. Try publishing again.",
      telnyx,
      livekitTrunk,
    };
  }

  return { ok: true, telnyx, livekitTrunk };
}
