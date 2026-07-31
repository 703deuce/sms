"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useState } from "react";

export type SupportTicketRow = {
  id: string;
  email: string;
  subject: string;
  body: string;
  status: string;
  workspaceId: string | null;
  createdAt: string;
};

export function SupportTicketsPanel({ initialTickets }: { initialTickets: SupportTicketRow[] }) {
  const [tickets, setTickets] = useState<SupportTicketRow[]>(initialTickets);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          subject: form.get("subject"),
          body: form.get("body"),
          workspaceId: String(form.get("workspaceId") || "").trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create ticket");
      setTickets((t) => [json.data, ...t]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between">
        <CardTitle>Support tickets</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New ticket"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {showForm ? (
        <form className="mt-4 grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2" onSubmit={createTicket}>
          <div>
            <Label htmlFor="email">Customer email</Label>
            <Input id="email" name="email" type="email" required placeholder="customer@example.com" />
          </div>
          <div>
            <Label htmlFor="workspaceId">Workspace ID (optional)</Label>
            <Input id="workspaceId" name="workspaceId" placeholder="ws_…" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required placeholder="Billing question" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="body">Details</Label>
            <Textarea id="body" name="body" rows={3} required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Creating…" : "Create ticket"}
            </Button>
          </div>
        </form>
      ) : null}

      {tickets.length === 0 ? (
        <EmptyState
          title="No support tickets"
          description="Create a ticket or wait for inbound customer requests."
        />
      ) : (
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Subject</TH>
              <TH>Email</TH>
              <TH>Workspace</TH>
              <TH>Status</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {tickets.map((ticket) => (
              <TR key={ticket.id}>
                <TD className="max-w-[260px] font-medium">{ticket.subject}</TD>
                <TD className="text-muted-foreground">{ticket.email}</TD>
                <TD className="text-muted-foreground">{ticket.workspaceId || "—"}</TD>
                <TD>
                  <StatusChip status={ticket.status === "closed" ? "Closed" : "Open"} />
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
