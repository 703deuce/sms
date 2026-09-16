import "server-only";

import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  resolveVoiceV2BookingStrategy,
  voiceV2StrategyAllowsFindBook,
} from "@/lib/voice-v2/booking-strategy";
import type { VoiceV2CallContext } from "./intake/types";

export type FindBookGateResult =
  | { allowed: true; strategy: ReturnType<typeof resolveVoiceV2BookingStrategy> }
  | { allowed: false; status: "BOOKING_MODE_DISABLED"; speak: string };

export async function assertVoiceV2FindBookAllowed(input: {
  workspaceId: string;
  agentId: string;
  ctx?: VoiceV2CallContext | null;
}): Promise<FindBookGateResult> {
  const pinned = input.ctx?.capabilities?.bookingStrategy;
  if (pinned) {
    if (!voiceV2StrategyAllowsFindBook(pinned)) {
      return {
        allowed: false,
        status: "BOOKING_MODE_DISABLED",
        speak:
          "Live calendar booking is not enabled for this call. Collect the caller's request and use finalize when ready.",
      };
    }
    return { allowed: true, strategy: pinned };
  }
  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const strategy = resolveVoiceV2BookingStrategy(config);
  if (!voiceV2StrategyAllowsFindBook(strategy)) {
    return {
      allowed: false,
      status: "BOOKING_MODE_DISABLED",
      speak:
        "Live calendar booking is not enabled for this call. Collect the caller's request and use finalize when ready.",
    };
  }
  return { allowed: true, strategy };
}
