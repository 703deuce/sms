"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { TabBar } from "@/components/ui/design-system";
import { renderTemplate } from "@/lib/reputation/template-vars";
import { cn } from "@/lib/utils";

type TemplateTab = "sms" | "email" | "sequence" | "industry" | "saved";

const TEMPLATE_TABS: Array<{ id: TemplateTab; label: string }> = [
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "sequence", label: "Sequence templates" },
  { id: "industry", label: "Industry starters" },
  { id: "saved", label: "Saved business" },
];

type Template = {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  is_default: boolean;
  tone?: string;
  usage_count?: number | null;
  usageCount?: number | null;
};

type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  channel: string;
  recommendedIndustries?: string[];
  recommendedTrigger?: string;
  timeline?: string[];
  stepCount?: number;
  totalDurationLabel?: string;
  suitableForWebhook?: boolean;
  suitableForCsvReactivation?: boolean;
  usage_count?: number | null;
  usageCount?: number | null;
};

function usageLabel(item: { usage_count?: number | null; usageCount?: number | null }) {
  const count = item.usage_count ?? item.usageCount;
  return count == null ? "—" : String(count);
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-[13px] text-zinc-500">
      {children}
    </div>
  );
}

function CampaignTemplateCards({
  templates,
  loading,
  error,
  businessId,
  industryOnly = false,
}: {
  templates: CampaignTemplate[];
  loading: boolean;
  error: string | null;
  businessId: string;
  industryOnly?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
      </div>
    );
  }
  if (error) {
    return (
      <EmptyPanel>
        Could not load sequence templates from /api/reputation/campaign-templates.{" "}
        <span className="text-zinc-400">{error}</span>
      </EmptyPanel>
    );
  }
  if (!templates.length) {
    return (
      <EmptyPanel>
        {industryOnly
          ? "No industry starter templates are available from the template API yet."
          : "No sequence templates are available yet."}{" "}
        <Link
          href={`/businesses/${businessId}/reputation/campaigns`}
          className="font-medium text-emerald-700 underline"
        >
          Open campaigns
        </Link>
        .
      </EmptyPanel>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {templates.map((template) => (
        <div key={template.id} className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">{template.name}</p>
              <p className="mt-1 text-[12px] leading-snug text-zinc-500">{template.description}</p>
            </div>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">
              {template.channel}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
            <div>
              <dt className="font-medium uppercase tracking-wide text-zinc-400">Steps</dt>
              <dd className="mt-0.5 text-zinc-700">{template.stepCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-zinc-400">Duration</dt>
              <dd className="mt-0.5 text-zinc-700">{template.totalDurationLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium uppercase tracking-wide text-zinc-400">Usage</dt>
              <dd className="mt-0.5 text-zinc-700">{usageLabel(template)}</dd>
            </div>
          </dl>
          {template.recommendedIndustries?.length ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              Industries: {template.recommendedIndustries.join(", ")}
            </p>
          ) : null}
          {template.recommendedTrigger ? (
            <p className="mt-1 text-[11px] text-zinc-500">
              Trigger: {template.recommendedTrigger}
            </p>
          ) : null}
          <Link
            href={`/businesses/${businessId}/reputation/campaigns`}
            className="mt-3 inline-flex rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Use in campaign
          </Link>
        </div>
      ))}
    </div>
  );
}

export function TemplatesManager({ businessId }: { businessId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<CampaignTemplate[]>([]);
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [activeTab, setActiveTab] = useState<TemplateTab>("sms");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unknownTokens, setUnknownTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignTemplateError, setCampaignTemplateError] = useState<string | null>(null);
  const [campaignTemplatesLoading, setCampaignTemplatesLoading] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation/templates?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setTemplates(json.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadCampaignTemplates = useCallback(async () => {
    setCampaignTemplatesLoading(true);
    setCampaignTemplateError(null);
    try {
      const res = await fetch("/api/reputation/campaign-templates");
      if (res.status === 404) {
        setCampaignTemplates([]);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setCampaignTemplates(json.templates ?? []);
    } catch (e) {
      setCampaignTemplateError(e instanceof Error ? e.message : "Failed");
      setCampaignTemplates([]);
    } finally {
      setCampaignTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCampaignTemplates();
  }, [loadCampaignTemplates]);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel]
  );
  const savedBusinessTemplates = useMemo(
    () => templates.filter((t) => t.is_default || t.channel === "sms" || t.channel === "email"),
    [templates]
  );
  const industryStarters = useMemo(
    () => campaignTemplates.filter((t) => (t.recommendedIndustries ?? []).length > 0),
    [campaignTemplates]
  );

  function changeTab(tab: TemplateTab) {
    setActiveTab(tab);
    if (tab === "sms" || tab === "email") setChannel(tab);
  }

  useEffect(() => {
    const preferred =
      channelTemplates.find((t) => t.id === activeId) ||
      channelTemplates.find((t) => t.is_default) || channelTemplates[0];
    if (preferred) {
      setActiveId(preferred.id);
      setName(preferred.name);
      setSubject(preferred.subject ?? "");
      setBody(preferred.body);
    } else {
      setActiveId(null);
      setName("");
      setSubject("");
      setBody("");
    }
  }, [activeId, channelTemplates]);

  useEffect(() => {
    const t = templates.find((x) => x.id === activeId);
    if (!t) return;
    setName(t.name);
    setSubject(t.subject ?? "");
    setBody(t.body);
  }, [activeId, templates]);

  const preview = useMemo(
    () =>
      renderTemplate(body, {
        first_name: "Sam",
        business_name: "Your Business",
        review_link: "https://example.com/r/demo",
        location_name: "Main Location",
      }),
    [body]
  );

  async function save(createNew = false) {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: createNew || !activeId ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createNew || !activeId
            ? { businessId, channel, name, subject, body }
            : { businessId, templateId: activeId, name, subject, body }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setWarnings(json.validation?.warnings ?? []);
      setUnknownTokens(json.validation?.unknownTokens ?? []);
      setMsg("Saved");
      await load();
      if (json.template?.id) setActiveId(json.template.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function actFor(templateId: string, action: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: action === "duplicate" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, templateId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      await load();
      if (json.template?.id) setActiveId(json.template.id);
      setMsg(action.replace("_", " "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  async function act(action: string) {
    if (!activeId) return;
    await actFor(activeId, action);
  }

  async function testSend() {
    if (!activeId || !testTo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "test_send",
          templateId: activeId,
          toPhone: channel === "sms" ? testTo.trim() : undefined,
          toEmail: channel === "email" ? testTo.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test send failed");
      setMsg("Test send queued/sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setSaving(false);
    }
  }

  async function generateAi() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reputation/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, tone: "friendly" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generate failed");
      setMsg("AI templates generated");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <TabBar tabs={TEMPLATE_TABS} active={activeTab} onChange={changeTab} />

      {(activeTab === "sms" || activeTab === "email") && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Editing {channel} templates
        </p>
        <div className="flex flex-wrap gap-1">
          {channelTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={cn(
                "rounded border px-2 py-1 text-[11px]",
                activeId === t.id
                  ? "border-emerald-600 text-emerald-800"
                  : "border-zinc-200 text-zinc-600"
              )}
            >
              {t.name}
              {t.is_default ? " ★" : ""}
            </button>
          ))}
          <button
            type="button"
            className="rounded border border-dashed border-zinc-300 px-2 py-1 text-[11px] text-zinc-500"
            onClick={() => {
              setActiveId(null);
              setName(`New ${channel} template`);
              setSubject(channel === "email" ? "How was your experience?" : "");
              setBody(
                channel === "sms"
                  ? "Hi {{first_name}}, thanks for choosing {{business_name}}. Honest feedback welcome: {{review_link}} Reply STOP to opt out."
                  : "Hi {{first_name}},\n\nThanks for choosing {{business_name}}. Leave honest feedback here:\n{{review_link}}"
              );
            }}
          >
            + New
          </button>
        </div>

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        ) : (
          <>
            <input
              className="h-8 w-full rounded-md border border-zinc-200 px-2 text-[13px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
            />
            {channel === "email" && (
              <input
                className="h-8 w-full rounded-md border border-zinc-200 px-2 text-[13px]"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
              />
            )}
            <textarea
              className="min-h-[140px] w-full rounded-md border border-zinc-200 px-2 py-1.5 text-[13px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {(warnings.length > 0 || unknownTokens.length > 0) && (
              <ul className="space-y-1 text-[11px] text-amber-800">
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
                {unknownTokens.map((t) => (
                  <li key={t}>Unknown token: {`{{${t}}}`}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => void generateAi()}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium text-zinc-700"
              >
                Generate with AI
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(!activeId)}
                className="rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
              {activeId && (
                <>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
                    onClick={() => void act("set_default")}
                  >
                    Set default
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
                    onClick={() => void act("duplicate")}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] text-red-700"
                    onClick={() => void act("archive")}
                  >
                    Archive
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2">
              <input
                className="h-8 min-w-0 w-full flex-1 rounded-md border border-zinc-200 px-2 text-[12px] sm:min-w-[12rem]"
                placeholder={channel === "sms" ? "Test phone (+1…)" : "Test email"}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <button
                type="button"
                disabled={saving || !activeId || !testTo.trim()}
                onClick={() => void testSend()}
                className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50"
              >
                Test send
              </button>
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            {msg && <p className="text-[12px] text-emerald-700">{msg}</p>}
          </>
        )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Live preview
        </p>
        {channel === "sms" ? (
          <div className="mx-auto mt-3 max-w-[240px] rounded-[1.5rem] border border-zinc-300 bg-white p-3 shadow-sm">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-800">{preview}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-medium text-zinc-500">Subject</p>
            <p className="text-[13px] font-semibold text-zinc-900">
              {renderTemplate(subject || "(no subject)", {
                first_name: "Sam",
                business_name: "Your Business",
                review_link: "https://example.com/r/demo",
              })}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-[12px] text-zinc-700">{preview}</p>
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-500">
          Tokens: {"{{first_name}}"} {"{{business_name}}"} {"{{review_link}}"} {"{{location_name}}"}
        </p>
          </div>
        </div>
      )}

      {activeTab === "sequence" && (
        <CampaignTemplateCards
          templates={campaignTemplates}
          loading={campaignTemplatesLoading}
          error={campaignTemplateError}
          businessId={businessId}
        />
      )}

      {activeTab === "industry" && (
        <CampaignTemplateCards
          templates={industryStarters}
          loading={campaignTemplatesLoading}
          error={campaignTemplateError}
          businessId={businessId}
          industryOnly
        />
      )}

      {activeTab === "saved" && (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3 py-2">
            <h3 className="text-[13px] font-semibold text-zinc-900">Saved business templates</h3>
            <p className="text-[11px] text-zinc-500">
              Business-owned SMS/email templates. Usage counts show when the API provides them.
            </p>
          </div>
          {savedBusinessTemplates.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Template</th>
                    <th className="px-3 py-2 font-medium">Channel</th>
                    <th className="px-3 py-2 text-right font-medium">Usage</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {savedBusinessTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900">
                          {template.name}
                          {template.is_default ? (
                            <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Default
                            </span>
                          ) : null}
                        </p>
                        <p className="max-w-md truncate text-[11px] text-zinc-500">
                          {template.subject || template.body}
                        </p>
                      </td>
                      <td className="px-3 py-2 uppercase text-zinc-600">{template.channel}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                        {usageLabel(template)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {(template.channel === "sms" || template.channel === "email") && (
                            <button
                              type="button"
                              className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700"
                              onClick={() => {
                                setChannel(template.channel as "sms" | "email");
                                setActiveTab(template.channel as "sms" | "email");
                                setActiveId(template.id);
                              }}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700 disabled:opacity-50"
                            onClick={() => void actFor(template.id, "duplicate")}
                          >
                            Duplicate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-zinc-500">
              No saved business templates yet. Create one from the SMS or Email tab.
            </div>
          )}
        </div>
      )}
      </div>
  );
}
