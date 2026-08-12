import Link from "next/link";

export default function AgentKnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Knowledge</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Business facts, FAQs, and documents Amy can answer from.
        </p>
      </div>
      <div className="voice-card p-6">
        <p className="text-sm text-muted-foreground">
          Manage workspace knowledge bases and link them to this agent.
        </p>
        <Link href="/voice/knowledge" className="mt-4 inline-flex voice-btn-outline voice-btn-outline-purple">
          Open knowledge library
        </Link>
      </div>
    </div>
  );
}
