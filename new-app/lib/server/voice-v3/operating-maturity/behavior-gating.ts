import type { AfterHoursBehaviorConfig } from "@/lib/agent";
import type {
  VoiceV2OperatingState,
  VoiceV2ResolvedOperatingState,
} from "@/lib/receptionist/operating-runtime-types";

type GatingCallContext = {
  capabilities?: {
    transferToolAvailable?: boolean;
    callbackToolAvailable?: boolean;
    bookingEnabled?: boolean;
    voiceV2PstnLiveBooking?: boolean;
  };
};

export type VoiceV2GatedCapabilities = {
  transferToolAvailable: boolean;
  officeTransferAllowed: boolean;
  onCallEscalationAllowed: boolean;
  liveBookingAllowed: boolean;
  callbackToolAvailable: boolean;
  messageTakingAllowed: boolean;
};

export function gateCapabilitiesForOperatingState(input: {
  ctx: GatingCallContext;
  operating: VoiceV2ResolvedOperatingState;
  behavior: AfterHoursBehaviorConfig;
}): VoiceV2GatedCapabilities {
  const baseTransfer = input.ctx.capabilities?.transferToolAvailable === true;
  const baseCallback = input.ctx.capabilities?.callbackToolAvailable === true;
  const baseBooking =
    input.ctx.capabilities?.bookingEnabled === true ||
    input.ctx.capabilities?.voiceV2PstnLiveBooking === true;

  if (!input.behavior.useOperatingStateDuringCalls || input.operating.state === "OPEN") {
    return {
      transferToolAvailable: baseTransfer,
      officeTransferAllowed: baseTransfer,
      onCallEscalationAllowed: baseTransfer,
      liveBookingAllowed: baseBooking,
      callbackToolAvailable: baseCallback,
      messageTakingAllowed: true,
    };
  }

  const closed = isClosedLike(input.operating.state);
  const when = input.behavior.whenClosed;

  const officeTransfer =
    baseTransfer && when.allowNormalTransferDestinations && when.allowOfficeTransfer;
  const onCall =
    baseTransfer && when.allowOnCallEscalation;
  const anyTransfer = officeTransfer || onCall;

  return {
    transferToolAvailable: anyTransfer,
    officeTransferAllowed: officeTransfer,
    onCallEscalationAllowed: onCall,
    // Live FIND/BOOK follows agent capabilities only — not business-hours / after-hours policy.
    // After-hours rules govern transfer, callback, and message-taking instead.
    liveBookingAllowed: baseBooking,
    callbackToolAvailable: closed ? when.allowCallbackRequest && baseCallback : baseCallback,
    messageTakingAllowed: closed ? when.allowMessageTaking : true,
  };
}

function isClosedLike(state: VoiceV2OperatingState): boolean {
  return (
    state === "CLOSED_AFTER_HOURS" ||
    state === "WEEKEND" ||
    state === "HOLIDAY" ||
    state === "TEMPORARILY_CLOSED" ||
    state === "OVERFLOW" ||
    state === "UNKNOWN"
  );
}

export function applyOperatingStateGatingToContext<T extends GatingCallContext>(
  ctx: T,
  gates: VoiceV2GatedCapabilities,
): T {
  return {
    ...ctx,
    capabilities: {
      ...ctx.capabilities,
      transferToolAvailable: gates.transferToolAvailable,
      callbackToolAvailable: gates.callbackToolAvailable,
      bookingEnabled: gates.liveBookingAllowed,
      voiceV2PstnLiveBooking: gates.liveBookingAllowed,
    },
  };
}
