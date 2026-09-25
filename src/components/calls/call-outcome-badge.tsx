import { OUTCOME_BADGE_STYLES, type CallOutcomeBadge } from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";

export function CallOutcomeBadge({
  outcome,
  className,
  compact,
}: {
  outcome: CallOutcomeBadge;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        compact
          ? "transovo-outcome-badge--compact rounded px-1.5 py-px text-[10px] ring-1 ring-inset"
          : "rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset",
        OUTCOME_BADGE_STYLES[outcome],
        className,
      )}
    >
      {outcome}
    </span>
  );
}
