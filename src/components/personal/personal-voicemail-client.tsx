"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";
import { formatPhone } from "@/lib/utils";
import { useEffect, useState } from "react";

type VoicemailMessage = {
  id: string;
  callerNumber: string;
  durationSec: number;
  createdAt: string;
  transcript?: string | null;
};

export function PersonalVoicemailClient({ numberId }: { numberId?: string }) {
  const [messages, setMessages] = useState<VoicemailMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/phone/voicemail")
      .then((r) => r.json())
      .then((j) => {
        const { messages: rows } = parseVoicemailApiPayload(j.data);
        setMessages(rows);
      })
      .finally(() => setLoading(false));
  }, [numberId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading voicemail…</p>;

  if (messages.length === 0) {
    return (
      <EmptyState
        title="No voicemails yet"
        description="When someone leaves a message on your number, it will appear here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {messages.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">{formatPhone(m.callerNumber || "Unknown")}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(m.createdAt).toLocaleString()} · {m.durationSec}s
            </p>
            {m.transcript ? (
              <p className="mt-1 text-sm text-muted-foreground">{m.transcript}</p>
            ) : null}
          </div>
          <a
            href={`/api/phone/voicemail/${m.id}/recording`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary"
          >
            Play
          </a>
        </li>
      ))}
    </ul>
  );
}
