"use client";

import { fmtCallDurationShort } from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";

export type TranscriptSegmentRow = {
  id?: string;
  speaker: string;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
};

function speakerLabel(speaker: string, agentName: string, callerName: string) {
  const s = speaker.toUpperCase();
  if (s === "AGENT" || s.includes("ASSISTANT") || s.includes("AI")) return agentName;
  if (s === "CALLER") return callerName;
  return speaker;
}

export function CallTranscript({
  segments,
  agentName,
  callerName,
  status,
  onRetry,
}: {
  segments: TranscriptSegmentRow[];
  agentName: string;
  callerName: string;
  status?: string | null;
  onRetry?: () => void;
}) {
  if (status === "processing" || status === "pending") {
    return (
      <p className="text-sm text-muted-foreground" role="status">Transcript processing…</p>
    );
  }
  if (status === "failed") {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p>Transcript unavailable. We couldn&apos;t process this transcript.</p>
        {onRetry ? (
          <button
            type="button"
            className="mt-2 font-medium text-rose-800 underline"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  if (!segments.length) {
    return <p className="text-sm text-muted-foreground">No transcript for this call.</p>;
  }

  return (
    <div className="space-y-4">
      {segments.map((seg, idx) => {
        const label = speakerLabel(seg.speaker, agentName, callerName);
        const isAgent = label === agentName;
        return (
          <div key={seg.id || idx} className="text-sm">
            <p className="text-xs font-medium text-muted-foreground">
              {label}
              {seg.startMs != null ? ` · ${fmtCallDurationShort(Math.round(seg.startMs / 1000))}` : ""}
            </p>
            <p className={cn("mt-1 leading-relaxed text-foreground", isAgent && "text-[#374151]")}>
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
