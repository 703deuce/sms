"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Copy, ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { growTabs } from "@/lib/grow-tabs";

type FormRow = {
  id: string;
  name: string;
  listName: string;
  url?: string | null;
  slug?: string | null;
  status: string;
  submissions: number;
  views?: number;
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
      window.location.href = `/grow/forms/${json.data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const submissions = rows.reduce((s, r) => s + (r.submissions || 0), 0);
  const views = rows.reduce((s, r) => s + (r.views || 0), 0);

  return (
    <div>
      <PageHeader
        title="Opt-in forms"
        description="Hosted signup pages and embeddable widgets with checkbox consent, disclosure text, list assignment, and consent records."
      />
      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Active forms" value={formatNumber(rows.length)} />
        <StatCard label="Views" value={formatNumber(views)} />
        <StatCard label="Submissions" value={formatNumber(submissions)} />
        <StatCard label="Embed" value="form.js" hint="/embed/f/[slug]" />
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
          {saving ? "Creating…" : "Create form"}
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>URL</TH>
              <TH>Views</TH>
              <TH>Submissions</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((f) => (
              <TR key={f.id}>
                <TD className="font-medium">
                  <Link href={`/grow/forms/${f.id}`} className="hover:text-indigo-600">
                    {f.name}
                  </Link>
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="max-w-[200px] truncate text-sm text-slate-600">{f.url}</span>
                    {f.url && (
                      <>
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-800"
                          onClick={() => navigator.clipboard.writeText(f.url || "")}
                          title="Copy URL"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </TD>
                <TD>{f.views ?? 0}</TD>
                <TD>{f.submissions}</TD>
                <TD>
                  <StatusChip status={f.status} />
                </TD>
                <TD>
                  <Link
                    href={`/grow/forms/${f.id}`}
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-slate-500">
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
