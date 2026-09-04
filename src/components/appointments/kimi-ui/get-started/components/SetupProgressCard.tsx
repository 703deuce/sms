import { CheckCircle2 } from "lucide-react";
import { progressSummary } from "../mock-data";

export default function SetupProgressCard() {
  const { completed, total, percent, inProgress, notStarted, estTime } = progressSummary;
  const R = 27;
  const C = 2 * Math.PI * R;
  const frac = completed / total;

  return (
    <div className="setup-card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* Ring */}
        <div className="ring-wrap">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="#ecebfa" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="#5b4bd6"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1.05,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1c1c2e" }}>{completed}</span>
            <span style={{ fontSize: 10, color: "#8a8aa3" }}>of {total}</span>
          </div>
        </div>

        {/* Bar + stats */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "#1c1c2e", marginBottom: 10 }}>
            <strong>Almost there!</strong> You&rsquo;re {percent}% complete.
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#ecebfa", overflow: "hidden", marginBottom: 14 }}>
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: 999,
                background: "#5b4bd6",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b6b85" }}>
              <CheckCircle2 size={15} color="#22c07a" fill="#e6f9f0" />
              <strong style={{ color: "#1c1c2e" }}>{completed}</strong> Completed
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b6b85" }}>
              <span style={{ fontSize: 13 }}>🕺</span>
              <strong style={{ color: "#1c1c2e" }}>{inProgress}</strong> In progress
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b6b85" }}>
              <strong style={{ color: "#1c1c2e" }}>{notStarted}</strong> Not started
            </span>
            <span style={{ marginLeft: "auto", textAlign: "right", fontSize: 11, color: "#8a8aa3" }}>
              Est. time remaining
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1c2e" }}>{estTime}</div>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
