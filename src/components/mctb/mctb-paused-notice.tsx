import Link from "next/link";

export type MctbPausedNoticeKind = "manual" | "timed" | null;

type MctbPausedNoticeProps = {
  pauseKind?: MctbPausedNoticeKind;
  pauseUntil?: string | null;
  /** Persistent page banner vs post-save confirmation */
  variant?: "banner" | "saved";
  className?: string;
};

function pauseTimingLine(
  pauseKind: MctbPausedNoticeKind,
  pauseUntil?: string | null,
): string | null {
  if (pauseKind === "timed" && pauseUntil) {
    const until = new Date(pauseUntil);
    if (!Number.isNaN(until.getTime()) && until > new Date()) {
      return `Text-backs stay paused until ${until.toLocaleString()}.`;
    }
  }
  if (pauseKind === "manual") {
    return "Text-backs stay paused until you resume from Schedule.";
  }
  return null;
}

export function MctbPausedNotice({
  pauseKind = "manual",
  pauseUntil,
  variant = "banner",
  className = "",
}: MctbPausedNoticeProps) {
  const timing = pauseTimingLine(pauseKind, pauseUntil);

  if (variant === "saved") {
    return (
      <div
        className={`rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-[13px] text-violet-950 ${className}`}
        role="status"
      >
        <p className="font-semibold">Changes saved — missed-call text back is still paused</p>
        <p className="mt-1">
          Your updates are saved and will apply the next time text-backs run. Saving here does{" "}
          <strong>not</strong> restart text-backs or send messages.
          {timing ? <> {timing}</> : null}
        </p>
        <p className="mt-2">
          <Link href="/voice/schedule" className="font-semibold text-violet-900 underline">
            Resume on Schedule →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-950 ${className}`}
      role="status"
    >
      <p className="font-semibold">Missed Call Text Back is paused</p>
      <p className="mt-1">
        You can still edit setup here; changes are saved but text-backs will not send until you
        resume.
        {timing ? <> {timing}</> : null}{" "}
        <Link href="/voice/schedule" className="font-semibold text-violet-900 underline">
          Open Schedule →
        </Link>
      </p>
    </div>
  );
}
