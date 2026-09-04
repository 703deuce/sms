import { Rocket, CheckCircle2, Circle, Loader } from "lucide-react";
import { readinessItems } from "../mock-data";

export default function LaunchReadinessCard() {
  const doneCount = readinessItems.filter((i) => i.state === "done").length;
  const frac = doneCount / readinessItems.length;

  // semicircle gauge
  const R = 70;
  const C = Math.PI * R;

  return (
    <div className="setup-card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1c2e", marginBottom: 14 }}>
        Launch readiness
      </div>

      {/* gauge */}
      <div style={{ position: "relative", height: 92, marginBottom: 4 }}>
        <svg width="100%" height="110" viewBox="0 0 180 100" style={{ display: "block" }}>
          <path
            d={`M 20 95 A ${R} ${R} 0 0 1 160 95`}
            fill="none"
            stroke="#ecebfa"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d={`M 20 95 A ${R} ${R} 0 0 1 160 95`}
            fill="none"
            stroke="#5b4bd6"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
          />
        </svg>
        <div className="gauge-rocket" style={{ color: "#5b4bd6" }}>
          <Rocket size={30} fill="#dcd7ff" />
        </div>
      </div>

      <div style={{ textAlign: "left", marginTop: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1c2e" }}>
          You&rsquo;re almost ready to launch!
        </div>
        <div style={{ fontSize: 12.5, color: "#8a8aa3", marginTop: 3, marginBottom: 14 }}>
          Complete the remaining steps to start accepting bookings.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {readinessItems.map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}
          >
            {item.state === "done" ? (
              <CheckCircle2 size={16} color="#22c07a" fill="#e6f9f0" />
            ) : item.state === "partial" ? (
              <Loader size={15} color="#5b4bd6" />
            ) : (
              <Circle size={15} color="#cfcfe0" />
            )}
            <span style={{ color: item.state === "pending" ? "#8a8aa3" : "#3c3c55" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
