"use client";

import { useMemo } from "react";
import { buildHighlightSegments } from "@/lib/reviews/review-themes";
import { cn } from "@/lib/utils";

export function HighlightedReviewText({
  text,
  phrases,
  className,
  clamp,
}: {
  text: string | null;
  phrases: string[];
  className?: string;
  clamp?: 2 | 3 | 4 | 5;
}) {
  const segments = useMemo(
    () => buildHighlightSegments(text ?? "", phrases),
    [text, phrases]
  );

  if (!text?.trim()) {
    return <p className={cn("text-sm text-zinc-500", className)}>No review text.</p>;
  }

  return (
    <p
      className={cn(
        "text-sm leading-relaxed text-zinc-700",
        clamp === 2 && "line-clamp-2",
        clamp === 3 && "line-clamp-3",
        clamp === 4 && "line-clamp-4",
        clamp === 5 && "line-clamp-5",
        className
      )}
    >
      {segments.map((segment, i) =>
        segment.highlight ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-200/90 px-0.5 font-medium text-zinc-900 not-italic"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}
