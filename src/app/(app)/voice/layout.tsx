import "./voice-theme.css";
import "@/styles/transovo-pass3-surface-first.css";
import "@/styles/transovo-operational-redesign.css";
import "@/styles/transovo-voice-calls-workspace.css";
import "@/styles/transovo-call-detail-workspace.css";

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="voice-theme transovo-product-surface-first transovo-operational-redesign min-h-full">
      {children}
    </div>
  );
}
