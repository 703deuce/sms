import type { SetupQuickTip } from "../mock-data";
import { Clock, HelpCircle, Rocket, Lightbulb } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  clock: Clock,
  help: HelpCircle,
  rocket: Rocket,
};

export default function QuickTipsCard({ tips }: { tips: SetupQuickTip[] }) {
  return (
    <section className="setup-card" aria-label="Quick tips">
      <div className="setup-card-header" style={{ paddingBottom: 6 }}>
        <div>
          <h2 className="setup-card-title">
            <Lightbulb size={15} style={{ color: "var(--setup-accent)" }} />
            Quick tips
          </h2>
        </div>
      </div>
      <div style={{ padding: "6px 20px 18px" }}>
        {tips.map((tip) => {
          const Icon = ICONS[tip.icon] ?? Lightbulb;
          return (
            <div key={tip.title} className="setup-tip-row">
              <span className="setup-tip-icon">
                <Icon size={15} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="setup-tip-title">{tip.title}</p>
                <p className="setup-tip-desc">{tip.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
