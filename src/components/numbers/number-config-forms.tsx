"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SaveState = { saving: boolean; error: string; saved: boolean };

const initialSaveState: SaveState = { saving: false, error: "", saved: false };

async function patchNumber(numberId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/numbers/${numberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to save");
  return json.data;
}

export function NumberMessagingForm({
  numberId,
  messagingService,
  initialSettings,
}: {
  numberId: string;
  messagingService: string;
  initialSettings: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [mmsEnabled, setMmsEnabled] = useState(
    initialSettings?.mmsEnabled !== false,
  );
  const [state, setState] = useState<SaveState>(initialSaveState);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: "", saved: false });
    try {
      await patchNumber(numberId, {
        settingsJson: { ...(initialSettings || {}), mmsEnabled },
      });
      setState({ saving: false, error: "", saved: true });
      router.refresh();
    } catch (err) {
      setState({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save",
        saved: false,
      });
    }
  }

  return (
    <form className="mt-4 space-y-4 max-w-xl" onSubmit={save}>
      <div>
        <Label htmlFor="messagingService">Messaging service</Label>
        <Input id="messagingService" value={messagingService} readOnly className="bg-muted" />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="mmsEnabled"
          checked={mmsEnabled}
          onChange={(e) => setMmsEnabled(e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="mmsEnabled" className="mb-0">
          Enable MMS on this number
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Inbound/status webhook endpoints are managed per workspace in Settings → Messaging.
      </p>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-violet-600">Messaging settings saved.</p> : null}
      <Button type="submit" size="sm" disabled={state.saving}>
        {state.saving ? "Saving…" : "Save messaging settings"}
      </Button>
    </form>
  );
}

export function NumberWebhooksForm({
  numberId,
  initialWebhookUrl,
}: {
  numberId: string;
  initialWebhookUrl: string | null;
}) {
  const router = useRouter();
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl || "");
  const [state, setState] = useState<SaveState>(initialSaveState);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: "", saved: false });
    try {
      await patchNumber(numberId, { webhookUrl: webhookUrl.trim() || null });
      setState({ saving: false, error: "", saved: true });
      router.refresh();
    } catch (err) {
      setState({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save",
        saved: false,
      });
    }
  }

  return (
    <form className="mt-4 space-y-4 max-w-xl" onSubmit={save}>
      <div>
        <Label htmlFor="inboundWebhook">Inbound message webhook (override)</Label>
        <Input
          id="inboundWebhook"
          placeholder="https://api.example.com/webhooks/inbound"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional per-number override. When empty, the workspace default messaging webhook is used.
        </p>
      </div>
      {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-violet-600">Webhook saved.</p> : null}
      <Button type="submit" size="sm" disabled={state.saving}>
        {state.saving ? "Saving…" : "Save webhook"}
      </Button>
    </form>
  );
}

type Member = { id: string; name: string; email: string; role: string };

export function NumberAssignmentForm({
  numberId,
  members,
  initialAssignedUserIds,
}: {
  numberId: string;
  members: Member[];
  initialAssignedUserIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<Set<string>>(
    () => new Set(initialAssignedUserIds),
  );
  const [state, setState] = useState<SaveState>(initialSaveState);

  function toggle(userId: string) {
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function save() {
    setState({ saving: true, error: "", saved: false });
    try {
      await patchNumber(numberId, { assignedUserIds: Array.from(assigned) });
      setState({ saving: false, error: "", saved: true });
      router.refresh();
    } catch (err) {
      setState({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save",
        saved: false,
      });
    }
  }

  return (
    <>
      <Table className="mt-4">
        <THead>
          <TR>
            <TH>User</TH>
            <TH>Role</TH>
            <TH>Assigned</TH>
          </TR>
        </THead>
        <TBody>
          {members.map((member) => (
            <TR key={member.id}>
              <TD>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </TD>
              <TD>{member.role}</TD>
              <TD>
                <input
                  type="checkbox"
                  checked={assigned.has(member.id)}
                  onChange={() => toggle(member.id)}
                  className="rounded border-border"
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={state.saving} onClick={save}>
          {state.saving ? "Saving…" : "Save assignments"}
        </Button>
        {state.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
        {state.saved ? <p className="text-sm text-violet-600">Assignments saved.</p> : null}
      </div>
    </>
  );
}
