import { PartyPopper, CheckSquare } from "lucide-react";

export default function AllSetBanner() {
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
          color: "#5b4bd6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <PartyPopper size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1c2e" }}>You&rsquo;re all set!</div>
        <div style={{ fontSize: 12.5, color: "#8a8aa3" }}>
          Complete all steps to launch your booking system with confidence.
        </div>
      </div>
      <button className="btn-primary" style={{ padding: "10px 18px" }}>
        <CheckSquare size={15} /> Mark setup complete
      </button>
    </div>
  );
}
