"use client";

import { StatusChip } from "@/components/ui/status-chip";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AudioLines, Calendar, MessageSquare, Phone } from "lucide-react";

export default function AgentOverviewPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const [data, setData] = useState<{
    name: string;
    status: string;
    callsHandled: number;
    draftConfig: unknown;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [agentId]);

  const cfg = data ? parseVoiceAgentConfig(data.draftConfig) : null;
  const wizard = (cfg?.advanced as { receptionistWizard?: { capabilities?: string[] } } | undefined)
    ?.receptionistWizard;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="voice-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <div className="mt-2">
            {data ? <StatusChip status={data.status} /> : null}
          </div>
        </div>
        <div className="voice-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calls handled
          </p>
          <p className="mt-2 text-2xl font-bold">{data?.callsHandled ?? 0}</p>
        </div>
        <div className="voice-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Voice
          </p>
          <p className="mt-2 text-sm font-medium">
            {cfg?.voiceLanguage?.voiceId || "Default"}
          </p>
        </div>
      </div>

      <div className="voice-card p-6">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/voice/agents/${agentId}/test`}
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <Phone className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Test agent</span>
          </Link>
          <Link
            href={`/voice/agents/${agentId}/voice`}
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <AudioLines className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Voice settings</span>
          </Link>
          <Link
            href={`/voice/agents/${agentId}/knowledge`}
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Knowledge</span>
          </Link>
          <Link
            href="/voice/calendars"
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-primary/5"
          >
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Calendars</span>
          </Link>
        </div>
      </div>

      {wizard?.capabilities?.length ? (
        <div className="voice-card p-6">
          <h2 className="text-lg font-semibold">Capabilities</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {wizard.capabilities.map((c) => (
              <li
                key={c}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {c.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
