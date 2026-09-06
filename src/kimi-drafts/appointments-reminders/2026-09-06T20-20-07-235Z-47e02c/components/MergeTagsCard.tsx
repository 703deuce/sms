"use client";

import { useState } from "react";
import { Braces, Check } from "lucide-react";

export default function MergeTagsCard({
  tags,
  onInsert,
}: {
  tags: string[];
  onInsert?: (tag: string) => boolean;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const use = (tag: string) => {
    // Prefer inserting into the focused template; fall back to clipboard copy.
    const inserted = onInsert?.(tag) ?? false;
    if (!inserted) {
      try {
        navigator.clipboard?.writeText(tag);
      } catch {
        /* clipboard unavailable */
      }
    }
    setFeedback(tag);
    window.setTimeout(() => setFeedback((c) => (c === tag ? null : c)), 1200);
  };

  return (
    <section className="rs-card" aria-labelledby="merge-tags-h">
      <div className="rs-card-hd">
        <span className="rs-icon-tile">
          <Braces className="h-4 w-4" />
        </span>
        <div>
          <h2 id="merge-tags-h" className="text-[13.5px] font-semibold text-gray-900">
            Merge tags
          </h2>
          <p className="text-[12px] text-gray-500">
            Click to insert into the template you&apos;re editing (or copy to clipboard).
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 p-4">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="rs-tag"
            onClick={() => use(tag)}
            title={`Insert ${tag} into template`}
          >
            {feedback === tag ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="h-3 w-3" /> {tag}
              </span>
            ) : (
              tag
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
