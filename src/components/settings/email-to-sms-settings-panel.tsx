"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { settingsTabs } from "@/lib/settings-tabs";

type Row = {
  id: string;
  localPart: string;
  phoneE164: string | null;
  fromNumber: string | null;
  active: boolean;
};

const domain = process.env.NEXT_PUBLIC_EMAIL_TO_SMS_DOMAIN || "sms.transovo.ai";

export function EmailToSmsSettingsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [localPart, setLocalPart] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/email-to-sms");
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/email-to-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localPart, phoneE164 }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    setLocalPart("");
    setPhoneE164("");
    await load();
  }

  async function toggleActive(row: Row) {
    await fetch("/api/email-to-sms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this alias?")) return;
    await fetch("/api/email-to-sms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Email-to-SMS"
        description={`Emails to alias@${domain} are forwarded as SMS to the configured phone.`}
      />
      <Tabs items={settingsTabs} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>Add alias</CardTitle>
          <form className="mt-4 space-y-4" onSubmit={create}>
            <div>
              <Label htmlFor="localPart">Local part</Label>
              <Input
                id="localPart"
                placeholder="support"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Full address: {localPart || "alias"}@{domain}
              </p>
            </div>
            <div>
              <Label htmlFor="phone">Forward to phone (E.164)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+15551234567"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit">Create alias</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Inbound webhook: POST /api/public/email-to-sms with JSON {"{to, from, subject, text}"}
          </p>
        </Card>

        <Card className="p-5">
          <CardTitle>Active aliases</CardTitle>
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No aliases yet.</p>
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Address</TH>
                  <TH>Phone</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="font-mono text-sm">{row.localPart}@{domain}</TD>
                    <TD>{row.phoneE164 || row.fromNumber || "—"}</TD>
                    <TD>
                      <button
                        type="button"
                        className="text-sm text-primary"
                        onClick={() => toggleActive(row)}
                      >
                        {row.active ? "Active" : "Paused"}
                      </button>
                    </TD>
                    <TD>
                      <button type="button" onClick={() => remove(row.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
