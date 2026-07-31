"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  DEFAULT_DISCLOSURE,
  DEFAULT_FORM_FIELDS,
  FIELD_LABELS,
  type FormFieldKey,
  type FormBranding,
} from "@/lib/forms/types";
import { formatNumber } from "@/lib/utils";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { growTabs } from "@/lib/grow-tabs";

const ALL_FIELDS: FormFieldKey[] = ["firstName", "lastName", "email", "phone"];

type FormDetail = {
  id: string;
  name: string;
  listName: string;
  slug: string | null;
  url: string | null;
  embedUrl: string | null;
  embedCode: string | null;
  status: string;
  submissions: number;
  views: number;
  disclosureText: string | null;
  thankYouMessage: string | null;
  doubleOptIn: boolean;
  startCampaignId: string | null;
  config: {
    fields?: FormFieldKey[];
    branding?: FormBranding;
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
  };
};

type SubmissionRow = {
  id: string;
  phone: string;
  embedHost?: string | null;
  referrer?: string | null;
  createdAt: string;
};

type CampaignOption = { id: string; name: string };

export function FormEditor({ formId }: { formId: string }) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [formRes, subRes, campRes] = await Promise.all([
      fetch(`/api/growth/forms/${formId}`),
      fetch(`/api/growth/forms/${formId}/submissions?limit=25`),
      fetch("/api/campaigns"),
    ]);
    if (!formRes.ok) throw new Error("Form not found");
    const formJson = await formRes.json();
    setForm(formJson.data);
    if (subRes.ok) {
      const subJson = await subRes.json();
      setSubmissions(subJson.data || []);
    }
    if (campRes.ok) {
      const campJson = await campRes.json();
      setCampaigns(
        (campJson.data || []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        })),
      );
    }
  }, [formId]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [load]);

  function updateConfig(patch: Partial<FormDetail["config"]>) {
    setForm((f) => (f ? { ...f, config: { ...f.config, ...patch } } : f));
  }

  function updateBranding(patch: Partial<FormBranding>) {
    setForm((f) =>
      f
        ? {
            ...f,
            config: {
              ...f.config,
              branding: { ...f.config.branding, ...patch },
            },
          }
        : f,
    );
  }

  function toggleField(field: FormFieldKey) {
    if (!form) return;
    const fields = form.config.fields || [...DEFAULT_FORM_FIELDS];
    if (field === "phone") return;
    const next = fields.includes(field)
      ? fields.filter((f) => f !== field)
      : [...fields, field];
    updateConfig({ fields: next });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/growth/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          listName: form.listName,
          disclosureText: form.disclosureText,
          thankYouMessage: form.thankYouMessage,
          doubleOptIn: form.doubleOptIn,
          startCampaignId: form.startCampaignId,
          status: form.status,
          fields: form.config.fields,
          branding: form.config.branding,
          headline: form.config.headline,
          subheadline: form.config.subheadline,
          buttonLabel: form.config.buttonLabel,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setForm(json.data);
      setMessage("Saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm() {
    if (!confirm("Delete this form? Submissions will be removed.")) return;
    const res = await fetch(`/api/growth/forms/${formId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "Delete failed");
      return;
    }
    window.location.href = "/grow/forms";
  }

  if (!form && !error) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!form) {
    return <p className="text-rose-600">{error || "Form not found"}</p>;
  }

  const fields = form.config.fields || [...DEFAULT_FORM_FIELDS];
  const branding = form.config.branding || {};

  return (
    <div>
      <PageHeader
        title={form.name}
        description="Edit fields, branding, consent text, and embed code. Hosted URL and iframe embed both record consent and submissions."
        actions={
          <div className="flex flex-wrap gap-2">
            {form.url && (
              <a
                href={form.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </a>
            )}
            <Button variant="outline" onClick={deleteForm}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />
      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Views</p>
          <p className="text-2xl font-semibold">{formatNumber(form.views)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Submissions</p>
          <p className="text-2xl font-semibold">{formatNumber(form.submissions)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Status</p>
          <div className="mt-1">
            <StatusChip status={form.status} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Slug</p>
          <p className="truncate font-mono text-sm">{form.slug}</p>
        </Card>
      </div>

      {message && <p className="mb-4 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <CardTitle>Content</CardTitle>
          <div>
            <Label htmlFor="name">Form name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder={form.name}
              value={form.config.headline || ""}
              onChange={(e) => updateConfig({ headline: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="subheadline">Subheadline</Label>
            <Input
              id="subheadline"
              value={form.config.subheadline || ""}
              onChange={(e) => updateConfig({ subheadline: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="button">Button label</Label>
            <Input
              id="button"
              value={form.config.buttonLabel || "Subscribe"}
              onChange={(e) => updateConfig({ buttonLabel: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="list">List name</Label>
            <Input
              id="list"
              value={form.listName}
              onChange={(e) => setForm({ ...form, listName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="disclosure">Consent / disclosure text</Label>
            <Textarea
              id="disclosure"
              rows={4}
              value={form.disclosureText || DEFAULT_DISCLOSURE}
              onChange={(e) => setForm({ ...form, disclosureText: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="thanks">Thank-you message</Label>
            <Input
              id="thanks"
              value={form.thankYouMessage || ""}
              onChange={(e) => setForm({ ...form, thankYouMessage: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.doubleOptIn}
              onChange={(e) => setForm({ ...form, doubleOptIn: e.target.checked })}
            />
            Require double opt-in (SMS confirmation)
          </label>
          <div>
            <Label htmlFor="campaign">Start campaign on submit</Label>
            <select
              id="campaign"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.startCampaignId || ""}
              onChange={(e) =>
                setForm({ ...form, startCampaignId: e.target.value || null })
              }
            >
              <option value="">None</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <CardTitle>Fields & branding</CardTitle>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Form fields</p>
            <div className="flex flex-wrap gap-2">
              {ALL_FIELDS.map((field) => (
                <button
                  key={field}
                  type="button"
                  disabled={field === "phone"}
                  onClick={() => toggleField(field)}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    fields.includes(field)
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : "border-slate-200 text-slate-600"
                  } ${field === "phone" ? "opacity-80" : ""}`}
                >
                  {FIELD_LABELS[field]}
                  {field === "phone" ? " (required)" : ""}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="business">Business name</Label>
            <Input
              id="business"
              value={branding.businessName || ""}
              onChange={(e) => updateBranding({ businessName: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="primary">Primary color</Label>
              <Input
                id="primary"
                type="color"
                className="h-10 w-full"
                value={branding.primaryColor || "#2563eb"}
                onChange={(e) => updateBranding({ primaryColor: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="theme">Theme</Label>
              <select
                id="theme"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={branding.theme || "light"}
                onChange={(e) =>
                  updateBranding({ theme: e.target.value as "light" | "dark" })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              placeholder="https://…"
              value={branding.logoUrl || ""}
              onChange={(e) => updateBranding({ logoUrl: e.target.value })}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-6 space-y-3 p-5">
        <CardTitle>Share & embed</CardTitle>
        <div>
          <Label>Hosted URL</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={form.url || ""} className="font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(form.url || "")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Embed code</Label>
          <Textarea
            readOnly
            rows={3}
            className="mt-1 font-mono text-xs"
            value={form.embedCode || ""}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => navigator.clipboard.writeText(form.embedCode || "")}
          >
            <Copy className="h-4 w-4" />
            Copy embed code
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            Paste on your site. Submissions include embed host for attribution.
          </p>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <CardTitle>Recent submissions</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Phone</TH>
              <TH>Source</TH>
              <TH>Time</TH>
            </TR>
          </THead>
          <TBody>
            {submissions.map((s) => (
              <TR key={s.id}>
                <TD className="font-mono text-sm">{s.phone}</TD>
                <TD className="text-sm text-slate-600">
                  {s.embedHost ? `Embed · ${s.embedHost}` : s.referrer || "Hosted"}
                </TD>
                <TD className="text-sm text-slate-500">
                  {new Date(s.createdAt).toLocaleString()}
                </TD>
              </TR>
            ))}
            {submissions.length === 0 && (
              <TR>
                <TD colSpan={3} className="text-slate-500">No submissions yet.</TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      <p className="mt-6 text-sm text-slate-500">
        <Link href="/grow/forms" className="underline hover:text-slate-800">← All forms</Link>
      </p>
    </div>
  );
}
