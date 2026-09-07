import { statusLabel } from "../list-types";

const TONE: Record<string, { chip: string; dot: string }> = {
  confirmed: { chip: "tv-chip tv-chip--green", dot: "tv-dot tv-dot--green" },
  awaiting_confirmation: { chip: "tv-chip tv-chip--amber", dot: "tv-dot tv-dot--amber" },
  scheduled: { chip: "tv-chip tv-chip--sky", dot: "tv-dot tv-dot--sky" },
  reschedule_requested: { chip: "tv-chip tv-chip--orange", dot: "tv-dot tv-dot--orange" },
  canceled: { chip: "tv-chip tv-chip--slate", dot: "tv-dot tv-dot--slate" },
  cancelled: { chip: "tv-chip tv-chip--slate", dot: "tv-dot tv-dot--slate" },
  completed: { chip: "tv-chip tv-chip--violet", dot: "tv-dot tv-dot--violet" },
  no_show: { chip: "tv-chip tv-chip--rose", dot: "tv-dot tv-dot--rose" },
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const tone = TONE[status.toLowerCase()] || TONE.canceled;
  return (
    <span className={tone.chip}>
      <span className={tone.dot} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
