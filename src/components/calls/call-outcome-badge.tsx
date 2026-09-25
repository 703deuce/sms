import { OUTCOME_BADGE_STYLES, type CallOutcomeBadge } from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";

export function CallOutcomeBadge({
  outcome,
  className,
}: {
  outcome: CallOutcomeBadge;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        OUTCOME_BADGE_STYLES[outcome],
        className,
      )}
    >
      {outcome}
    </span>
  );
}
