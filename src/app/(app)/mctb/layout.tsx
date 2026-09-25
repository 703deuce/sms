import "@/styles/transovo-pass3-surface-first.css";
import "@/styles/transovo-operational-redesign.css";
import "@/styles/transovo-config-workspace.css";
import "@/components/mctb/shell/mctb-design-tokens.css";
import "@/components/mctb/shell/mctb-neutral-shell.css";
import "@/components/mctb/shell/mctb-sidebar.css";
import "@/components/mctb/shell/mctb-global-overrides.css";

export default function MctbProductLayout({ children }: { children: React.ReactNode }) {
  return <div className="transovo-operational-redesign min-h-full">{children}</div>;
}
