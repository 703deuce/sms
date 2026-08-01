"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { useEffect, useState } from "react";

type CallRow = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  disposition?: string | null;
  recordingUrl?: string | null;
  startedAt: string;
  endedAt?: string | null;
  agentUserId?: string | null;
};

const DISPOSITIONS = [
  "",
  "completed",
  "voicemail",
  "missed",
  "no_answer",
  "callback_requested",
  "wrong_number",
  "sale",
  "not_interested",
];

export default function PhoneCallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  function load() {
    const params = new URLSearchParams({ limit: "100" });
    if (direction) params.set("direction", direction);
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/phone/calls?${params}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
  }, [direction, status]);

  async function setDisposition(id: string, disposition: string) {
    setSaving(id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, disposition } : r)));
    try {
      await fetch(`/api/phone/calls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition: disposition || null }),
      });
    } finally {
      setSaving(null);
    }
  }

  async function returnCall(phone: string) {
    // Open softphone with click-to-call so WebRTC / Call my phone owns media.
    window.location.href = `/phone?dial=${encodeURIComponent(phone)}`;
  }

  async function sendSms(phone: string) {
    window.location.href = `/send/quick?to=${encodeURIComponent(phone)}`;
  }

  async function addToContacts(phone: string) {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, firstName: "Unknown", lastName: "Caller" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Could not create contact");
      return;
    }
    const j = await res.json();
    if (j.data?.id) window.location.href = `/contacts/${j.data.id}`;
  }

  return (
    <div>
      <PageHeader
        title="Call history"
        description="Human agent calls placed and received through the softphone. Play recordings and set dispositions."
      />
      <PhoneSubNav />
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="text-xs text-muted-foreground">Direction</label>
          <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="ringing">Ringing</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="voicemail">Voicemail</option>
            <option value="parked">Parked</option>
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Search</label>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name / number / notes"
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-sm"
          onClick={load}
        >
          Apply
        </button>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Direction</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Status</TH>
              <TH>Recording</TH>
              <TH>Disposition</TH>
              <TH>Started</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={8} className="text-center text-muted-foreground py-8">
                  No calls yet
                </TD>
              </TR>
            ) : (
              rows.map((c) => {
                const peer = c.direction === "inbound" ? c.from : c.to;
                return (
                <TR key={c.id}>
                  <TD className="capitalize">{c.direction}</TD>
                  <TD className="font-mono text-xs">{c.from}</TD>
                  <TD className="font-mono text-xs">{c.to}</TD>
                  <TD>{c.status}</TD>
                  <TD>
                    {c.recordingUrl ? (
                      <audio controls preload="none" src={c.recordingUrl} className="h-8 w-44" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD>
                    <Select
                      className="h-8 w-40 text-xs"
                      value={c.disposition || ""}
                      disabled={saving === c.id}
                      onChange={(e) => setDisposition(c.id, e.target.value)}
                    >
                      {DISPOSITIONS.map((d) => (
                        <option key={d} value={d}>{d === "" ? "— none —" : d.replace(/_/g, " ")}</option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="text-muted-foreground text-xs">
                    {new Date(c.startedAt).toLocaleString()}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <a
                        href={`/phone/calls/${c.id}`}
                        className="rounded border border-border px-2 py-1 text-[11px]"
                      >
                        Diagnostics
                      </a>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px]"
                        onClick={() => void returnCall(peer)}
                      >
                        Return
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px]"
                        onClick={() => void sendSms(peer)}
                      >
                        SMS
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px]"
                        onClick={() => void addToContacts(peer)}
                      >
                        Add contact
                      </button>
                    </div>
                  </TD>
                </TR>
              );
              })
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
