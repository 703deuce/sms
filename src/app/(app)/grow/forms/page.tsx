"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { useEffect, useState } from "react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Click-to-text", href: "/grow/click-to-text" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

type FormRow = {
  id: string;
  name: string;
  listName: string;
  url?: string | null;
  slug?: string | null;
  status: string;
  submissions: number;
};

export default function FormsPage() {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [name, setName] = useState("Website signup");
  const [listName, setListName] = useState("Form subscribers");
  const [disclosureText, setDisclosureText] = useState(
    "By submitting, you agree to receive SMS from us. Msg&data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/growth/forms");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, listName, disclosureText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const submissions = rows.reduce((s, r) => s + (r.submissions || 0), 0);

  return (
    <div>
      <PageHeader
        title="Opt-in forms"
        description="Hosted signup pages with checkbox consent, disclosure text, privacy/terms links, list assignment, and consent records (phone, language, IP, time)."
      />
      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active forms" value={formatNumber(rows.length)} />
        <StatCard label="Submissions" value={formatNumber(submissions)} />
        <StatCard label="Public path" value="/f/[slug]" hint="No login required" />
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <CardTitle>Create form</CardTitle>
        <div>
          <Label htmlFor="name">Form name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="list">List</Label>
          <Input id="list" value={listName} onChange={(e) => setListName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="disclosure">Disclosure text</Label>
          <Textarea
            id="disclosure"
            rows={4}
            value={disclosureText}
            onChange={(e) => setDisclosureText(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button disabled={saving} onClick={create}>
          <Plus className="h-4 w-4" />
          {saving ? "Saving…" : "Create form"}
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>URL</TH>
              <TH>Submissions</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((f) => (
              <TR key={f.id}>
                <TD className="font-medium">{f.name}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="max-w-[220px] truncate text-sm text-slate-600">{f.url}</span>
                    {f.url && (
                      <>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-800"
                          onClick={() => navigator.clipboard.writeText(f.url || "")}
                          title="Copy"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-800">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </TD>
                <TD>{f.submissions}</TD>
                <TD>
                  <StatusChip status={f.status} />
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-slate-500">
                  No forms yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
