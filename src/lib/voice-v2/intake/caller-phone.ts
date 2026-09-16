import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import type { VoiceV2CallContext, VoiceV2IntakeSchema } from "./types";

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

/**
 * When caller supplies a different callback number, store on `phone` but retain ANI in metadata
 * via source transition (CALLER overwrites PREFILLED ANI only when explicitly saved).
 */
export function isAniDerivedPhone(field: VoiceV2CallContext["intakeState"]["phone"]): boolean {
  return field?.source === "CALLER_ID" && field.status === "PREFILLED";
}
