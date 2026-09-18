import type { VoiceV2CallContext } from "../intake/types";
import type {
  VoiceV2AfterHoursBehaviorConfig,
  VoiceV2OperatingState,
  VoiceV2ResolvedOperatingState,
} from "./types";

export type VoiceV2GatedCapabilities = {
  transferToolAvailable: boolean;
  officeTransferAllowed: boolean;
  onCallEscalationAllowed: boolean;
  liveBookingAllowed: boolean;
  callbackToolAvailable: boolean;
  messageTakingAllowed: boolean;
};

export function gateCapabilitiesForOperatingState(input: {
  ctx: VoiceV2CallContext;
  operating: VoiceV2ResolvedOperatingState;
  behavior: VoiceV2AfterHoursBehaviorConfig;
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
    liveBookingAllowed: closed ? when.allowLiveBooking && baseBooking : baseBooking,
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

export function applyOperatingStateGatingToContext(
  ctx: VoiceV2CallContext,
  gates: VoiceV2GatedCapabilities,
): VoiceV2CallContext {
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
