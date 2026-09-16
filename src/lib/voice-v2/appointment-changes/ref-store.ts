import "server-only";

import { createId } from "@/lib/supabase/id";
import type { ExistingAppointmentRef } from "./types";
import { patchVoiceV2CallContext, getVoiceV2CallContext } from "../intake/session-store";
import type { VoiceV2CallContext } from "../intake/types";

export type VoiceV2AppointmentActionState = {
  intent?: "RESCHEDULE" | "CANCEL" | null;
  refsById: Record<string, ExistingAppointmentRef>;
  selectedRefId?: string;
  replacementOfferSetId?: string;
  operationId?: string;
  status?: string;
};

export function getAppointmentActionState(
  ctx: VoiceV2CallContext | null,
): VoiceV2AppointmentActionState | undefined {
  return (ctx as { appointmentAction?: VoiceV2AppointmentActionState }).appointmentAction;
}

export function storeAppointmentRefs(input: {
  sessionKey: string;
  intent: "RESCHEDULE" | "CANCEL";
  refs: ExistingAppointmentRef[];
  selectedRefId?: string;
}): Record<string, string> {
  const refsById: Record<string, ExistingAppointmentRef> = {};
  const idMap: Record<string, string> = {};
  for (const ref of input.refs) {
    const refId = ref.refId || `v2appt_${createId()}`;
    const stored = { ...ref, refId };
    refsById[refId] = stored;
    idMap[refId] = refId;
  }
  const selected =
    input.selectedRefId && refsById[input.selectedRefId]
      ? input.selectedRefId
      : input.refs.length === 1
        ? Object.keys(refsById)[0]
        : undefined;

  patchVoiceV2CallContext(input.sessionKey, {
    appointmentAction: {
      intent: input.intent,
      refsById,
      selectedRefId: selected,
    },
  } as Partial<VoiceV2CallContext>);

  return idMap;
}

export function resolveStoredAppointmentRef(
  sessionKey: string,
  appointmentRefId: string,
): ExistingAppointmentRef | null {
  const ctx = getVoiceV2CallContext(sessionKey);
  const action = getAppointmentActionState(ctx);
  if (!action?.refsById) return null;
  return action.refsById[appointmentRefId] ?? null;
}

export function selectAppointmentRef(sessionKey: string, appointmentRefId: string): boolean {
  const ctx = getVoiceV2CallContext(sessionKey);
  const action = getAppointmentActionState(ctx);
  if (!action?.refsById?.[appointmentRefId]) return false;
  patchVoiceV2CallContext(sessionKey, {
    appointmentAction: { ...action, selectedRefId: appointmentRefId },
  } as Partial<VoiceV2CallContext>);
  return true;
}
