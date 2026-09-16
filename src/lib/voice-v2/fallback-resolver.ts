import type {
  VoiceV2FallbackAction,
  VoiceV2HandlingAction,
  VoiceV2PublishedAfterHoursHandlingConfig,
} from "./after-hours-handling-types";

export function handlingActionToFallback(action: VoiceV2HandlingAction): VoiceV2FallbackAction | null {
  switch (action) {
    case "TAKE_MESSAGE":
      return "TAKE_MESSAGE";
    case "CALLBACK":
      return "CALLBACK";
    case "REQUEST_ONLY":
      return "REQUEST_ONLY";
    case "SEND_LINK":
      return "SEND_LINK";
    case "CONTINUE":
      return "CONTINUE_WITH_AMY";
    default:
      return null;
  }
}

export function resolveFallbackHandlingAction(
  config: VoiceV2PublishedAfterHoursHandlingConfig,
  reason: "transfer_failed" | "waterfall_exhausted" | "urgency",
  attempted: VoiceV2FallbackAction[] = [],
): VoiceV2HandlingAction {
  let candidate: VoiceV2FallbackAction =
    reason === "urgency"
      ? config.urgencyRules.find((r) => r.fallbackAction)?.fallbackAction ||
        config.transferFailureFallback
      : config.transferFailureFallback;

  if (attempted.includes(candidate)) {
    if (candidate === "CALLBACK" && !attempted.includes("TAKE_MESSAGE")) {
      candidate = "TAKE_MESSAGE";
    } else {
      candidate = "CONTINUE_WITH_AMY";
    }
  }

  switch (candidate) {
    case "TAKE_MESSAGE":
      return "TAKE_MESSAGE";
    case "CALLBACK":
      return "CALLBACK";
    case "REQUEST_ONLY":
      return "REQUEST_ONLY";
    case "SEND_LINK":
      return "SEND_LINK";
    default:
      return "CONTINUE";
  }
}

export function recordAttemptedFallback(
  attempted: VoiceV2FallbackAction[] | undefined,
  action: VoiceV2FallbackAction,
): VoiceV2FallbackAction[] {
  const next = [...(attempted || [])];
  if (!next.includes(action)) next.push(action);
  return next;
}
