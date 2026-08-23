import { SmartRoutingAiAssistant } from "@/components/smart-routing/ai-assistant";
import { SrPageShell } from "@/components/smart-routing/shared";

export default function SmartRoutingAiPage() {
  return (
    <SrPageShell
      title="AI Routing Assistant"
      description="Build, change, explain, and improve your call routing in plain language. Changes go through preview and approval before they affect live calls."
    >
      <SmartRoutingAiAssistant />
    </SrPageShell>
  );
}
