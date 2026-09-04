import { Clock4, HelpCircle, Rocket, ChevronRight, ExternalLink } from "lucide-react";
import type { SetupQuickTip } from "@/features/appointments/kimi/setup/types";

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock4 size={17} />,
  help: <HelpCircle size={17} />,
  rocket: <Rocket size={17} />,
};

type Props = {
  tips: SetupQuickTip[];
};

export default function QuickTipsCard({ tips }: Props) {
  return (
    <div className="setup-card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1c2e", marginBottom: 14 }}>
        Quick tips
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tips.map((tip) => (
          <div key={tip.title} className="tip-row">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#f1efff",
                color: "#5b4bd6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {iconMap[tip.icon]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1c1c2e" }}>{tip.title}</div>
              <div style={{ fontSize: 11.5, color: "#8a8aa3", marginTop: 1 }}>{tip.description}</div>
            </div>
            <ChevronRight size={15} color="#b9b9cc" style={{ marginTop: 8, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 16,
          fontSize: 12.5,
          fontWeight: 600,
          color: "#5b4bd6",
          textDecoration: "none",
        }}
      >
        Learn more about appointments <ExternalLink size={13} />
      </a>
    </div>
  );
}
