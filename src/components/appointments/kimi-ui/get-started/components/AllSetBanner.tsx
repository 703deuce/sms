import { PartyPopper, CheckSquare } from "lucide-react";

type Props = {
  onboardingComplete: boolean;
  allDone: boolean;
  saving?: boolean;
  onMarkComplete: () => void;
};

export default function AllSetBanner({
  onboardingComplete,
  allDone,
  saving = false,
  onMarkComplete,
}: Props) {
  const complete = onboardingComplete || allDone;

  return (
    <div
      className="setup-card"
      style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "#f1efff",
          color: "#147d74",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <PartyPopper size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1c2e" }}>
          {complete ? "You&rsquo;re all set!" : "Finish setup at your own pace"}
        </div>
        <div style={{ fontSize: 12.5, color: "#8a8aa3" }}>
          {complete
            ? "Setup is marked complete. You can revisit any step above."
            : "Complete all steps to launch your booking system with confidence."}
        </div>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ padding: "10px 18px" }}
        onClick={onMarkComplete}
        disabled={onboardingComplete || saving}
      >
        <CheckSquare size={15} />
        {onboardingComplete ? "Setup marked complete" : saving ? "Saving…" : "Mark setup complete"}
      </button>
    </div>
  );
}
