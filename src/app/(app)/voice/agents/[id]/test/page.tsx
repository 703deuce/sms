"use client";

import { useParams } from "next/navigation";
import { AgentBrowserCall } from "@/components/voice/agent-browser-call";

export default function AgentTestPage() {
  const params = useParams();
  const agentId = params?.id as string;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Test your receptionist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk to your agent in the browser before assigning a phone number.
        </p>
      </div>
      <div className="voice-card p-6">
        <AgentBrowserCall agentId={agentId} />
      </div>
    </div>
  );
}
