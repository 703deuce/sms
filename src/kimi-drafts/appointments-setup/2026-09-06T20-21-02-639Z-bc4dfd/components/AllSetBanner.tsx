import { CheckCircle2, Sparkles, Lock } from "lucide-react";

type Props = {
  onboardingComplete: boolean;
  allDone: boolean;
  saving: boolean;
  readOnly?: boolean;
  onMarkComplete: () => void;
};

export default function AllSetBanner({ onboardingComplete, allDone, saving, readOnly = false, onMarkComplete }: Props) {
  if (onboardingComplete || allDone) {
    return (
      <div className="setup-banner" role="status">
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#d1f5e0",
            color: "var(--setup-success)",
            flexShrink: 0,
          }}
        >
          <CheckCircle2 size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#14532d" }}>
            You&apos;re all set!
          </p>
          <p style={{ fontSize: 12.5, color: "#3f7a58", margin: "2px 0 0" }}>
            Your booking system is live. Share your booking link to start taking appointments.
          </p>
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="setup-banner setup-banner-pending">
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#f1f1f6",
            color: "#8a8aa3",
            flexShrink: 0,
          }}
        >
          <Lock size={17} strokeWidth={2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>
            Setup is managed by a workspace admin
          </p>
          <p style={{ fontSize: 12.5, color: "var(--setup-muted)", margin: "2px 0 0" }}>
            You can view progress here, but only an owner or admin can mark setup as complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-banner setup-banner-pending">
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "var(--setup-accent-soft)",
          color: "var(--setup-accent)",
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} strokeWidth={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>
          Finished setting everything up?
        </p>
        <p style={{ fontSize: 12.5, color: "var(--setup-muted)", margin: "2px 0 0" }}>
          Mark setup as complete to dismiss this checklist from your home view.
        </p>
      </div>
      <button type="button" className="setup-btn setup-btn-outline" onClick={onMarkComplete} disabled={saving}>
        {saving ? "Saving…" : "Mark as complete"}
      </button>
    </div>
  );
}
