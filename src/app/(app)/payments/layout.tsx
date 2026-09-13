import "@/components/mctb/shell/mctb-design-tokens.css";
import "@/components/mctb/shell/mctb-global-overrides.css";

export default function PaymentsProductLayout({ children }: { children: React.ReactNode }) {
  return <div className="payments-mctb-shell min-h-full">{children}</div>;
}
