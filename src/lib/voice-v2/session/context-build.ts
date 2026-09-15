import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import { compileVoiceV2IntakeSchema } from "../intake/compile-schema";
import type { VoiceV2CallContext, VoiceV2IntakeState } from "../intake/types";
import { buildVoiceV2EnrollmentSnapshot } from "./enrollment";
import type { VoiceV2EnrollmentSnapshot } from "./types";

function prefillPhone(fromE164?: string | null): VoiceV2IntakeState {
  const ani = normalizeCallerAni(fromE164 || "");
  if (!ani) return {};
  return {
    phone: {
      value: ani,
      status: "PREFILLED",
      source: "CALLER_ID",
      updatedAt: new Date().toISOString(),
    },
  };
}

export type BuiltVoiceV2Context = {
  payload: VoiceV2CallContext;
  enrollment: VoiceV2EnrollmentSnapshot;
  bookingTimezone: string;
};

export async function buildVoiceV2CallContextPayload(input: {
  workspaceId: string;
  agentId: string;
  canonicalSessionKey: string;
  callId?: string | null;
  fromE164?: string | null;
}): Promise<BuiltVoiceV2Context> {
  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const intakeSchema = compileVoiceV2IntakeSchema(config);
  const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";
  const enrollment = await buildVoiceV2EnrollmentSnapshot({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });
  const payload: VoiceV2CallContext = {
    sessionKey: input.canonicalSessionKey,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema,
    intakeState: prefillPhone(input.fromE164),
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
  };
  return { payload, enrollment, bookingTimezone: timezone };
}
