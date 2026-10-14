"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Clock,
  Copy,
  Edit3,
  FileText,
  Import,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MessagingSetupCallout } from "@/components/messaging/messaging-setup-callout";
import { RepBadge, RepMetricCard, RepPageHeader, RepSearch, RepTabs, rep } from "@/components/reputation/rep-ui";
import { renderTemplate } from "@/lib/reputation/template-vars";
import type { ReputationTemplatePreviewKpis, ReputationTemplateRow } from "@/lib/reputation/reputation-page-preview-data";
import { cn } from "@/lib/utils";

type TemplateTab = "all" | "sms" | "email" | "sequences" | "mine" | "archived";

type ApiTemplate = {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  is_default: boolean;
  usage_count?: number | null;
  usageCount?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  channel: string;
  recommendedIndustries?: string[];
  stepCount?: number;
  usage_count?: number | null;
  usageCount?: number | null;
};

const TABS: Array<{ id: TemplateTab; label: string }> = [
  { id: "all", label: "All Templates" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "sequences", label: "Sequences" },
  { id: "mine", label: "My Templates" },
  { id: "archived", label: "Archived" },
];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateByYou(value: string | null | undefined) {
  if (!value) return "—";
  return `${fmtDate(value)} by You`;
}

function TemplateChannelIcon({
  channel,
  className,
}: {
  channel: ReputationTemplateRow["channel"];
  className?: string;
}) {
  if (channel === "email") return <Mail className={className} />;
  if (channel === "sequence") return <Sparkles className={className} />;
  return <MessageSquare className={className} />;
}

function channelTone(channel: ReputationTemplateRow["channel"]): "green" | "blue" | "purple" {
  if (channel === "email") return "blue";
  if (channel === "sequence") return "purple";
  return "green";
}

function channelLabel(channel: ReputationTemplateRow["channel"]) {
  if (channel === "email") return "Email";
  if (channel === "sequence") return "Sequence";
  return "SMS";
}

function mapApiTemplate(template: ApiTemplate): ReputationTemplateRow {
  const channel = template.channel === "email" ? "email" : "sms";
  return {
    id: template.id,
    channel,
    name: template.name,
    subject: template.subject,
    body: template.body,
    snippet: template.subject || template.body,
    type: template.is_default ? "Default request" : channel === "sms" ? "SMS request" : "Email request",
    lastUpdated: template.updated_at ?? template.created_at ?? new Date().toISOString(),
    usageCount: template.usage_count ?? template.usageCount ?? 0,
    conversionPct: null,
    isDefault: template.is_default,
    status: "active",
    source: "business",
  };
}

function mapCampaignTemplate(template: CampaignTemplate): ReputationTemplateRow {
  return {
    id: `campaign-${template.id}`,
    channel: "sequence",
    name: template.name,
    body: template.description,
    snippet: template.description,
    type: (template.recommendedIndustries?.length ?? 0) > 0 ? "Industry sequence" : "Sequence",
    lastUpdated: new Date().toISOString(),
    usageCount: template.usage_count ?? template.usageCount ?? 0,
    conversionPct: null,
    status: "active",
    source: (template.recommendedIndustries?.length ?? 0) > 0 ? "industry" : "business",
    steps: template.stepCount,
  };
}

function emptyTemplate(channel: "sms" | "email"): ReputationTemplateRow {
  return {
    id: "new-template",
    channel,
    name: `New ${channel.toUpperCase()} template`,
    subject: channel === "email" ? "How did we do, {{first_name}}?" : null,
    body:
      channel === "sms"
        ? "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you share honest feedback? {{review_link}} Reply STOP to opt out."
        : "Hi {{first_name}},\n\nThanks for choosing {{business_name}}. Leave honest feedback here:\n{{review_link}}",
    snippet: "Draft template",
    type: "Draft",
    lastUpdated: new Date().toISOString(),
    usageCount: 0,
    conversionPct: null,
    status: "active",
    source: "business",
  };
}

function TemplatePreview({
  selected,
  businessId,
  onSelectDraft,
}: {
  selected: ReputationTemplateRow | null;
  businessId: string;
  onSelectDraft: (channel: "sms" | "email") => void;
}) {
  const renderedBody = selected
    ? renderTemplate(selected.body, {
        first_name: "Sam",
        business_name: "A-Team Junk Removal",
        review_link: "https://example.com/r/demo",
        location_name: "Main Location",
      })
    : "";
  const renderedSubject =
    selected?.subject &&
    renderTemplate(selected.subject, {
      first_name: "Sam",
      business_name: "A-Team Junk Removal",
      review_link: "https://example.com/r/demo",
    });

  return (
    <aside className={cn(rep.card, "h-fit p-4")}>
      {selected ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#101828]">Template Preview</h2>
            <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
              <TemplateChannelIcon channel={selected.channel} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[#101828]">{selected.name}</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                <RepBadge tone={channelTone(selected.channel)}>{channelLabel(selected.channel)}</RepBadge>
                {selected.isDefault ? <RepBadge>Default</RepBadge> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-[#F9FAFB] px-4 py-2.5 text-center">
            <p className="text-xs font-bold tracking-wider text-[#667085] uppercase">
              Used {selected.usageCount.toLocaleString()} times
              {selected.conversionPct != null ? ` | Conversion ${selected.conversionPct}%` : ""}
            </p>
          </div>

          <div className="mt-4 rounded-[22px] border border-[#D0D5DD] bg-[#F9FAFB] p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Preview with merge fields
            </p>
            {selected.channel === "email" ? (
              <div className="rounded-xl border border-[#E6EAF0] bg-white p-3">
                <p className="text-xs font-semibold text-[#667085]">Subject</p>
                <p className="mt-1 text-sm font-semibold text-[#101828]">{renderedSubject || "(no subject)"}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#344054]">{renderedBody}</p>
              </div>
            ) : (
              <div className="ml-auto max-w-[260px] rounded-2xl rounded-br-md bg-[#137752] px-3 py-2 text-sm leading-relaxed text-white shadow-sm">
                {renderedBody}
              </div>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#667085]">Channel</dt>
              <dd className="font-medium text-[#101828]">{channelLabel(selected.channel)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#667085]">Type</dt>
              <dd className="font-medium text-[#101828]">{selected.type}</dd>
            </div>
            {selected.createdAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[#667085]">Created</dt>
                <dd className="font-medium text-[#101828]">{fmtDateByYou(selected.createdAt)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-[#667085]">Last Updated</dt>
              <dd className="font-medium text-[#101828]">{fmtDateByYou(selected.lastUpdated)}</dd>
            </div>
          </dl>

          {selected.mergeFields && selected.mergeFields.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-[#667085]">Merge Fields</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.mergeFields.map((field) => (
                  <span key={field} className="inline-flex items-center rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[11px] font-semibold text-[#175CD3]">
                    {`{{${field}}}`}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {selected.recommendedTiming ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#FFFAEB] px-3 py-2.5">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B54708]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B54708]">Recommended Timing</p>
                <p className="mt-0.5 text-xs text-[#344054]">{selected.recommendedTiming}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button type="button" className={rep.btnPrimary}>
              <Edit3 className="h-4 w-4" />
              Edit Template
            </button>
            <button type="button" className={rep.btnSecondary}>
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#FECDCA] bg-white px-3 text-sm font-semibold text-[#B42318] hover:bg-[#FEF3F2]">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      ) : (
        <div className="py-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[#98A2B3]" />
          <h2 className="mt-3 text-sm font-semibold text-[#101828]">Select a template</h2>
          <p className="mt-1 text-sm text-[#667085]">Preview content, usage, and actions here.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" className={rep.btnSecondary} onClick={() => onSelectDraft("sms")}>
              SMS draft
            </button>
            <button type="button" className={rep.btnSecondary} onClick={() => onSelectDraft("email")}>
              Email draft
            </button>
          </div>
          <p className="mt-3 text-xs text-[#98A2B3]">Business: {businessId}</p>
        </div>
      )}
    </aside>
  );
}

export function TemplatesHub({
  businessId,
  initialTemplates,
  previewKpis,
}: {
  businessId: string;
  initialTemplates?: ReputationTemplateRow[];
  previewKpis?: ReputationTemplatePreviewKpis;
}) {
  const [templates, setTemplates] = useState<ReputationTemplateRow[]>(initialTemplates ?? []);
  const [activeTab, setActiveTab] = useState<TemplateTab>("all");
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(!initialTemplates);
  const [error, setError] = useState<string | null>(null);
  const defaultSelected = initialTemplates?.find((t) => t.isDefault)?.id ?? initialTemplates?.[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelected);

  const load = useCallback(async () => {
    if (initialTemplates) return;
    setLoading(true);
    setError(null);
    try {
      const [templateRes, campaignRes] = await Promise.all([
        fetch(`/api/reputation/templates?businessId=${businessId}`),
        fetch("/api/reputation/campaign-templates"),
      ]);
      const templateJson = await templateRes.json();
      if (!templateRes.ok) throw new Error(templateJson.error || "Failed to load templates");
      let campaignRows: ReputationTemplateRow[] = [];
      if (campaignRes.ok) {
        const campaignJson = await campaignRes.json();
        campaignRows = ((campaignJson.templates ?? []) as CampaignTemplate[]).map(mapCampaignTemplate);
      }
      const apiRows = ((templateJson.templates ?? []) as ApiTemplate[]).map(mapApiTemplate);
      const rows = [...apiRows, ...campaignRows];
      setTemplates(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [businessId, initialTemplates]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const selected = templates.find((template) => template.id === selectedId) ?? templates[0] ?? null;
  const messageTemplates = useMemo(
    () => templates.filter((template) => (template.channel === "sms" || template.channel === "email") && template.source !== "industry"),
    [templates]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const tabMatch =
        activeTab === "all" ||
        (activeTab === "sms" && template.channel === "sms" && template.status !== "archived") ||
        (activeTab === "email" && template.channel === "email" && template.status !== "archived") ||
        (activeTab === "sequences" && template.channel === "sequence") ||
        (activeTab === "mine" && template.source !== "industry" && template.status !== "archived") ||
        (activeTab === "archived" && template.status === "archived");
      const channelMatch = channelFilter === "all" || template.channel === channelFilter;
      const typeMatch =
        typeFilter === "all" ||
        (typeFilter === "industry"
          ? template.source === "industry"
          : template.type.toLowerCase().includes(typeFilter));
      const searchMatch =
        !needle ||
        [template.name, template.snippet, template.type, template.body].some((value) =>
          value.toLowerCase().includes(needle)
        );
      return tabMatch && channelMatch && typeMatch && searchMatch;
    });
  }, [activeTab, channelFilter, query, templates, typeFilter]);

  const stats = useMemo(() => {
    if (previewKpis) return previewKpis;
    const active = templates.filter((template) => template.status !== "archived");
    return {
      sms: active.filter((template) => template.channel === "sms").length,
      email: active.filter((template) => template.channel === "email").length,
      sequences: active.filter((template) => template.channel === "sequence").length,
      industry: active.filter((template) => template.source === "industry").length,
      mine: active.filter((template) => template.source !== "industry").length,
    };
  }, [templates, previewKpis]);

  function selectDraft(channel: "sms" | "email") {
    const draft = emptyTemplate(channel);
    setTemplates((rows) => [draft, ...rows.filter((row) => row.id !== draft.id)]);
    setSelectedId(draft.id);
    setActiveTab(channel);
  }

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Templates"
        subtitle="Create, manage, and optimize SMS, email, and sequence templates for review requests."
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" className={rep.btnPrimary} onClick={() => selectDraft("sms")}>
              <Plus className="h-4 w-4" />
              New Template
            </button>
            <button
              type="button"
              className={rep.btnSecondary}
              onClick={() => {
                setActiveTab("all");
                setTypeFilter("all");
                setQuery("");
                selectDraft("sms");
              }}
              title="Create a new template from scratch"
            >
              <Import className="h-4 w-4" />
              Import Template
            </button>
            <button
              type="button"
              className={rep.btnSecondary}
              onClick={() => {
                setActiveTab("all");
                setTypeFilter("industry");
                setQuery("");
              }}
            >
              <Sparkles className="h-4 w-4 text-[#137752]" />
              Industry Templates
            </button>
          </>
        }
      />

      <MessagingSetupCallout businessId={businessId} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="SMS Templates" value={stats.sms} icon={MessageSquare} trend="^2 this month" trendPositive>
          <button type="button" className={rep.link} onClick={() => setActiveTab("sms")}>
            View SMS →
          </button>
        </RepMetricCard>
        <RepMetricCard label="Email Templates" value={stats.email} icon={Mail} trend="^1 this month" trendPositive>
          <button type="button" className={rep.link} onClick={() => setActiveTab("email")}>
            View Email →
          </button>
        </RepMetricCard>
        <RepMetricCard label="Sequences" value={stats.sequences} icon={Sparkles}>
          <button type="button" className={rep.link} onClick={() => setActiveTab("sequences")}>
            View Sequences →
          </button>
        </RepMetricCard>
        <RepMetricCard label="Industry Templates" value={stats.industry} icon={FileText} hint="Ready-made starters">
          <button
            type="button"
            className={rep.link}
            onClick={() => {
              setActiveTab("all");
              setTypeFilter("industry");
            }}
          >
            View Industry →
          </button>
        </RepMetricCard>
        <RepMetricCard label="My Templates" value={stats.mine} icon={Edit3} hint="Business-owned">
          <button type="button" className={rep.link} onClick={() => setActiveTab("mine")}>
            View Mine →
          </button>
        </RepMetricCard>
      </div>

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as TemplateTab)} />

      {!loading && !error && messageTemplates.length === 0 ? (
        <div className={cn(rep.card, "flex flex-col gap-3 border-dashed border-[#B7E4CC] bg-[#ECFDF3]/60 p-4 md:flex-row md:items-center md:justify-between")}>
          <div>
            <h2 className="text-sm font-semibold text-[#101828]">No SMS or email message templates yet</h2>
            <p className="mt-1 text-sm text-[#667085]">
              Create your first reusable message, or browse campaign sequence templates that can be used from the campaign wizard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={rep.btnPrimary} onClick={() => selectDraft("sms")}>
              <Plus className="h-4 w-4" />
              Create SMS Template
            </button>
            <button
              type="button"
              className={rep.btnSecondary}
              onClick={() => {
                setActiveTab("sequences");
                setChannelFilter("all");
                setTypeFilter("all");
                setQuery("");
              }}
            >
              <Sparkles className="h-4 w-4 text-[#137752]" />
              Use Campaign Template
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          <div className={cn(rep.card, "flex flex-col gap-3 p-3 md:flex-row md:items-center")}>
            <RepSearch value={query} onChange={setQuery} placeholder="Search templates by name, snippet, or merge field..." />
            <div className="flex flex-wrap gap-2">
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={rep.select}>
                <option value="all">All channels</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="sequence">Sequence</option>
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={rep.select}>
                <option value="all">All types</option>
                <option value="single">Single Message</option>
                <option value="industry">Industry Starter</option>
                <option value="sequence">Sequence</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

          <div className={cn(rep.card, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label="Select all templates" />
                    </th>
                    <th className="min-w-[320px] px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Channel</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Last Updated</th>
                    <th className="px-4 py-3 text-right font-semibold">Usage</th>
                    <th className="px-4 py-3 text-right font-semibold">Conversion</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {filtered.map((template) => {
                    return (
                      <tr
                        key={template.id}
                        className={cn(
                          "cursor-pointer bg-white transition hover:bg-[#F9FAFB]",
                          selected?.id === template.id && "bg-[#ECFDF3]/50"
                        )}
                        onClick={() => setSelectedId(template.id)}
                      >
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" className="h-4 w-4 rounded border-[#D0D5DD]" aria-label={`Select ${template.name}`} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#667085]">
                              <TemplateChannelIcon channel={template.channel} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-semibold text-[#101828]">{template.name}</p>
                                {template.isDefault ? <RepBadge>Default</RepBadge> : null}
                                {template.status === "archived" ? <RepBadge tone="gray">Archived</RepBadge> : null}
                              </div>
                              <p className="mt-1 max-w-[420px] truncate text-xs text-[#667085]">{template.snippet}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RepBadge tone={channelTone(template.channel)}>{channelLabel(template.channel)}</RepBadge>
                        </td>
                        <td className="px-4 py-3 text-[#344054]">{template.type}</td>
                        <td className="px-4 py-3 text-[#667085]">
                          <span className="block">{fmtDate(template.lastUpdated)}</span>
                          <span className="text-xs text-[#98A2B3]">by You</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#344054]">
                          {template.usageCount.toLocaleString()} sends
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#344054]">
                          {template.conversionPct == null ? "—" : `${template.conversionPct}%`}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                        No templates match the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#667085]">
                        Loading templates...
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[360px]">
          <TemplatePreview selected={selected} businessId={businessId} onSelectDraft={selectDraft} />
        </div>
      </div>

      <div className="rounded-xl border border-[#B7E4CC] bg-[#ECFDF3] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#137752]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#101828]">
              Improve your results: Templates with personalized merge fields and a clear value statement get 34% higher conversion.
            </h3>
            <button type="button" className={cn(rep.link, "mt-1")}>
              View best practices →
            </button>
          </div>
          <Archive className="ml-auto hidden h-5 w-5 shrink-0 text-[#137752] sm:block" />
        </div>
      </div>
    </div>
  );
}
