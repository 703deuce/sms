type Props = { status: string };

const CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "chip-scheduled" },
  pending: { label: "Pending", cls: "chip-pending" },
  joining: { label: "Joining", cls: "chip-pending" },
  awaiting_admission: { label: "Awaiting admission", cls: "chip-pending" },
  active: { label: "In meeting", cls: "chip-active" },
  recording: { label: "Recording", cls: "chip-recording" },
  processing: { label: "Processing recap", cls: "chip-pending" },
  completed: { label: "Recap ready", cls: "chip-recap" },
  canceled: { label: "Canceled", cls: "chip-muted" },
  failed: { label: "Failed", cls: "chip-failed" },
};

export default function StatusChip({ status }: Props) {
  const c = CONFIG[status] ?? { label: status, cls: "chip-scheduled" };
  return <span className={`chip ${c.cls}`}>{c.label}</span>;
}
