"use client";

type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusChip({
  label,
  tone = "neutral",
  live = false,
}: {
  label: string;
  tone?: ChipTone;
  live?: boolean;
}) {
  return (
    <span className={`chip chip-${tone}${live ? " chip-live" : ""}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}

const STATUS_TONES: Record<string, ChipTone> = {
  completed: "success",
  active: "info",
  recording: "info",
  scheduled: "info",
  joining: "info",
  awaiting_admission: "warning",
  pending: "neutral",
  processing: "warning",
  ended: "neutral",
  failed: "danger",
  canceled: "neutral",
  no_recap: "neutral",
  disabled: "neutral",
};

export function meetingStatusTone(status: string): ChipTone {
  return STATUS_TONES[status] ?? "neutral";
}

export function artifactChip(status?: string): { label: string; tone: ChipTone } | null {
  if (!status) return null;
  switch (status) {
    case "ready": return { label: "Ready", tone: "success" };
    case "processing": return { label: "Processing", tone: "warning" };
    case "failed": return { label: "Failed", tone: "danger" };
    case "recording": return { label: "Recording", tone: "info" };
    case "pending": return { label: "Pending", tone: "neutral" };
    default: return { label: status, tone: "neutral" };
  }
}
