import "./voice-theme.css";
import "@/styles/transovo-pass3-surface-first.css";

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="voice-theme transovo-product-surface-first min-h-full">{children}</div>
  );
}
