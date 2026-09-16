import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import type { IntakeFieldKey, VoiceV2CallContext, VoiceV2IntakeSchema } from "./types";

function phoneFieldEnabled(schema: VoiceV2IntakeSchema): boolean {
  return schema.fields.some((f) => f.key === "phone" && f.enabled);
}

/** Apply inbound ANI to intake `phone` when enabled and not already captured. */
export function applyCallerAniToIntakeState(
  ctx: VoiceV2CallContext,
  fromE164?: string | null,
): VoiceV2CallContext {
  const ani = normalizeCallerAni(fromE164 || "");
  if (!ani || !phoneFieldEnabled(ctx.intakeSchema)) return ctx;

  const existing = ctx.intakeState.phone;
  if (existing?.value?.trim() && existing.status !== "MISSING") {
    return ctx;
  }

  return {
    ...ctx,
    callerAniE164: ani,
    intakeState: {
      ...ctx.intakeState,
      phone: {
        value: ani,
        status: "PREFILLED",
        source: "CALLER_ID",
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

/** Load ANI from durable VoiceCall when tool webhooks omit `from`. */
export async function resolveCallerAniForSession(input: {
  workspaceId: string;
  fromE164?: string | null;
  trustedPrismaCallId?: string | null;
}): Promise<string | null> {
  const direct = normalizeCallerAni(input.fromE164 || "");
  if (direct) return direct;

  const callId = input.trustedPrismaCallId?.trim();
  if (!callId) return null;

  const prisma = getPrisma();
  const row = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId: input.workspaceId },
    select: { fromE164: true },
  });
  return normalizeCallerAni(row?.fromE164 || "") || null;
}

export function isAniDerivedPhone(field: VoiceV2CallContext["intakeState"]["phone"]): boolean {
  return field?.source === "CALLER_ID" && field.status === "PREFILLED";
}

/**
 * When intake save includes `phone` that differs from inbound ANI, route to `callback_number`
 * so `phone` stays the caller identity (ANI).
 */
export function redirectPhoneSaveAwayFromAni(
  ctx: VoiceV2CallContext,
  normalized: Partial<Record<IntakeFieldKey, string>>,
): Partial<Record<IntakeFieldKey, string>> {
  const next = { ...normalized };
  const proposedPhone = next.phone?.trim();
  if (!proposedPhone) return next;

  const ani = normalizeCallerAni(ctx.callerAniE164 || ctx.intakeState.phone?.value || "");
  if (!ani) return next;
  if (proposedPhone === ani) return next;

  const currentPhone = ctx.intakeState.phone;
  const phoneIsAni =
    currentPhone?.value === ani ||
    isAniDerivedPhone(currentPhone) ||
    currentPhone?.source === "CALLER_ID";

  if (!phoneIsAni) return next;

  delete next.phone;
  next.callback_number = proposedPhone;
  return next;
}
