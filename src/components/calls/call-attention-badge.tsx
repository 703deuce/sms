import type { CallAttentionBadge } from "@/lib/voice/calls/outcome-display";
import { cn } from "@/lib/utils";

const STYLES: Record<CallAttentionBadge, string> = {
  "Needs attention": "bg-amber-50 text-amber-900 ring-amber-200",
  "Transfer failed": "bg-rose-50 text-rose-800 ring-rose-200",
  Urgent: "bg-amber-50 text-amber-900 ring-amber-200",
  Emergency: "bg-rose-50 text-rose-900 ring-rose-300",
  Spam: "bg-rose-50 text-rose-700 ring-rose-200",
  Solicitor: "bg-rose-50 text-rose-800 ring-rose-200",
  "Unanswered question": "bg-sky-50 text-sky-900 ring-sky-200",
};

export function CallAttentionBadge({
  label,
  className,
}: {
  label: CallAttentionBadge;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[label],
        className,
      )}
    >
      {label}
    </span>
  );
}
