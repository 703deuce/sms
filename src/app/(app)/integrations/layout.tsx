import "@/components/mctb/shell/mctb-design-tokens.css";
import "@/components/mctb/shell/mctb-global-overrides.css";

export default function IntegrationsProductLayout({ children }: { children: React.ReactNode }) {
  return <div className="integrations-mctb-shell min-h-full">{children}</div>;
}
