import type { VoiceV2BookingStrategy } from "./booking-strategy";
import type { VoiceV2NextStage } from "./booking-workflow";
import type { VoiceV2CallContext } from "./intake/types";
import type { VoiceV2QualificationFallbackAction } from "./qualification-types";

function fallbackToStage(
  fallback: VoiceV2QualificationFallbackAction,
  strategy: VoiceV2BookingStrategy,
): VoiceV2NextStage {
  switch (fallback) {
    case "SEND_BOOKING_LINK":
      return strategy === "SEND_LINK" ? "SEND_BOOKING_LINK" : "FINALIZE_CALLER_REQUEST";
    case "REQUEST_APPOINTMENT":
      return "FINALIZE_CALLER_REQUEST";
    case "TAKE_MESSAGE":
      return "FINALIZE_CALLER_REQUEST";
    case "CONTINUE_PRIMARY_MODE":
    default:
      return "COLLECT_REQUIRED_INTAKE";
  }
}

/** Adjust next stage when qualification blocks primary action (deterministic). */
export function applyQualificationStageOverride(
  stage: VoiceV2NextStage,
  ctx: VoiceV2CallContext,
  strategy: VoiceV2BookingStrategy,
): VoiceV2NextStage {
  const cap = ctx.capabilities;
  if (!cap?.qualificationEnabled || !cap.qualificationRequiredBeforePrimaryAction) {
    return stage;
  }
  const q = ctx.qualification;
  if (!q || q.status === "QUALIFIED" || q.status === "UNKNOWN") return stage;

  const primaryStages: VoiceV2NextStage[] = [
    "FIND_AVAILABILITY",
    "OFFER_SLOTS",
    "BOOK_SELECTED_SLOT",
    "SEND_BOOKING_LINK",
  ];
  if (!primaryStages.includes(stage)) return stage;

  const fallback =
    q.status === "NOT_QUALIFIED"
      ? cap.qualificationNotQualifiedFallback || "TAKE_MESSAGE"
      : cap.qualificationNeedsReviewFallback || "TAKE_MESSAGE";

  if (fallback === "CONTINUE_PRIMARY_MODE") return stage;
  return fallbackToStage(fallback, strategy);
}

export function qualificationWorkflowExtras(ctx: VoiceV2CallContext): Record<string, unknown> {
  if (!ctx.capabilities?.qualificationEnabled || !ctx.qualification) return {};
  const q = ctx.qualification;
  return {
    qualification_status: q.status,
    qualification_reason: q.reasonLabel || q.reasonCode || null,
    qualification_primary_blocked: Boolean(q.primaryActionBlocked),
  };
}
