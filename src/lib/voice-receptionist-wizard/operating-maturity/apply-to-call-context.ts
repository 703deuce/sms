import "server-only";

import type { VoiceV2CallContext } from "../intake/types";
import {
  applyOperatingStateGatingToContext,
  gateCapabilitiesForOperatingState,
} from "./behavior-gating";
import { resolveVoiceV2OperatingState } from "./operating-state";
import { resolveActiveOnCallTarget } from "./on-call";
import type {
  VoiceV2OnCallOperationalOverride,
  VoiceV2OperatingMaturityPublishedConfig,
  VoiceV2ResolvedOperatingState,
  VoiceV2TemporaryClosure,
} from "./types";

export type VoiceV2OperatingRuntimeSnapshot = {
  operating: VoiceV2ResolvedOperatingState;
  onCallTarget: ReturnType<typeof resolveActiveOnCallTarget>;
};

export function applyOperatingMaturityToCallContext(input: {
  ctx: VoiceV2CallContext;
  maturity: VoiceV2OperatingMaturityPublishedConfig;
  liveTemporaryClosure?: VoiceV2TemporaryClosure | null;
  onCallOverride?: VoiceV2OnCallOperationalOverride | null;
  at?: string;
}): { ctx: VoiceV2CallContext; snapshot: VoiceV2OperatingRuntimeSnapshot } {
  const operating = resolveVoiceV2OperatingState({
    schedule: input.maturity.businessSchedule,
    at: input.at,
    liveTemporaryClosure: input.liveTemporaryClosure,
  });

  const onCallTarget = resolveActiveOnCallTarget({
    schedule: input.maturity.onCallSchedule,
    operationalOverride: input.onCallOverride,
    timestamp: input.at,
    operatingState: operating.state,
  });

  const gates = gateCapabilitiesForOperatingState({
    ctx: input.ctx,
    operating,
    behavior: input.maturity.afterHoursBehavior,
  });

  let ctx = applyOperatingStateGatingToContext(input.ctx, gates);

  const metaOperating = {
    operatingState: operating.state,
    operatingStateReason: operating.reason,
    operatingStateResolvedAt: operating.resolvedAt,
    onCallEntryId: onCallTarget?.entryId,
    onCallLabel: onCallTarget?.label,
    onCallTransferPlanId: onCallTarget?.transferPlanId ?? null,
  };

  ctx = {
    ...ctx,
    capabilities: {
      ...ctx.capabilities,
      operatingMaturityRevision: input.maturity.revision,
    },
    afterHours: {
      ...ctx.afterHours,
      operating: metaOperating,
    },
  };

  return { ctx, snapshot: { operating, onCallTarget } };
}
