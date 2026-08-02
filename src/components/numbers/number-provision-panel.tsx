"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";

type Diagnostics = {
  e164: string;
  providerNumberId: string | null;
  provisionState: string;
  capabilities: { voice?: boolean; sms?: boolean; mms?: boolean } | null;
  messagingProfileId: string | null;
  expectedMessagingProfileId: string | null;
  voiceConnectionId: string | null;
  expectedVoiceConnectionId: string | null;
  voiceWebhookUrl: string;
  messagingWebhookUrl: string;
  callFlow: {
    queueId: string | null;
    ivrMenuId: string | null;
    voiceForwardTo: string | null;
    agentId: string | null;
    agentName: string | null;
  };
  issues: Array<{ code: string; severity: string; message: string }>;
  ready: { messaging: boolean; voice: boolean; fully: boolean };
  lastVerifiedAt: string | null;
  lastError: string | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="break-all font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function NumberProvisionPanel({ numberId }: { numberId: string }) {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: string) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/numbers/${numberId}/provision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  useEffect(() => {
    run("diagnose");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId]);

  const readyLabel = data?.ready.fully
    ? "Fully configured"
    : data?.ready.voice
      ? "Voice ready"
      : data?.ready.messaging
        ? "Messaging ready"
        : "Needs setup";

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CardTitle>SMS + Voice provisioning</CardTitle>
        <StatusChip
          status={
            data?.ready.fully
              ? "Active"
              : data?.issues.some((i) => i.severity === "error")
                ? "Failed"
                : "Pending"
          }
        />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        One number for messaging and voice. Voice routes through Transovo Call Control
        (softphone, queues, AI) without clearing the messaging profile.
      </p>

      {error ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="mb-4">
          <Row label="State" value={`${data.provisionState} · ${readyLabel}`} />
          <Row label="Telnyx ID" value={data.providerNumberId} />
          <Row
            label="Capabilities"
            value={
              data.capabilities
                ? `voice=${data.capabilities.voice ? "yes" : "no"} · sms=${
                    data.capabilities.sms ? "yes" : "no"
                  } · mms=${data.capabilities.mms ? "yes" : "no"}`
                : "—"
            }
          />
          <Row
            label="Messaging profile"
            value={
              data.messagingProfileId ||
              (data.expectedMessagingProfileId
                ? `(expected ${data.expectedMessagingProfileId})`
                : "—")
            }
          />
          <Row
            label="Voice connection"
            value={
              data.voiceConnectionId ||
              (data.expectedVoiceConnectionId
                ? `(expected ${data.expectedVoiceConnectionId})`
                : "—")
            }
          />
          <Row label="Voice webhook" value={data.voiceWebhookUrl} />
          <Row label="Messaging webhook" value={data.messagingWebhookUrl} />
          <Row
            label="AI agent"
            value={
              data.callFlow.agentName
                ? `${data.callFlow.agentName} (${data.callFlow.agentId})`
                : "—"
            }
          />
          <Row label="Queue / IVR" value={data.callFlow.queueId || data.callFlow.ivrMenuId || "—"} />
          <Row
            label="Last verified"
            value={
              data.lastVerifiedAt
                ? new Date(data.lastVerifiedAt).toLocaleString()
                : "—"
            }
          />
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          {pending ? "Loading diagnostics…" : "No diagnostics yet."}
        </p>
      )}

      {data?.issues?.length ? (
        <ul className="mb-4 space-y-1 text-sm">
          {data.issues.map((issue) => (
            <li
              key={issue.code}
              className={
                issue.severity === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            >
              [{issue.severity}] {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("verify")}>
          Verify
        </Button>
        <Button size="sm" disabled={pending} onClick={() => run("enable_voice")}>
          Enable voice
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("repair_messaging")}
        >
          Repair messaging
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("provision")}>
          Full provision
        </Button>
      </div>
    </Card>
  );
}
