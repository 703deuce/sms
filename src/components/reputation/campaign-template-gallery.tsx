"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CampaignTemplateDefinition,
  CampaignTemplateFilter,
} from "@/lib/reputation/campaign-templates";
import {
  recommendedTemplateIdsForTrigger,
  type CampaignTriggerConfig,
  type CampaignTriggerType,
} from "@/lib/reputation/campaign-triggers";

const FILTER_CHIPS: Array<{ id: CampaignTemplateFilter | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
  { id: "multi-channel", label: "Multi-channel" },
  { id: "automatic", label: "Automatic" },
  { id: "manual-csv", label: "Manual / CSV" },
  { id: "service-business", label: "Service" },
  { id: "appointment-business", label: "Appointment" },
  { id: "past-customer-reactivation", label: "Past customers" },
];

function channelChips(t: CampaignTemplateDefinition): string[] {
  if (t.channel === "both") return ["SMS", "Email"];
  if (t.channel === "sms") return ["SMS"];
  return ["Email"];
}

function Timeline({ steps }: { steps: string[] }) {
  return (
    <p className="mt-1.5 truncate text-[10px] leading-snug text-zinc-500" title={steps.join(" → ")}>
      {steps.join(" → ")}
    </p>
  );
}

export function CampaignTemplateGallery({
  businessId,
  onUsed,
  onCustom,
  triggerType = "manual",
  triggerConfig,
  webhookEndpointId,
}: {
  businessId: string;
  onUsed?: (campaignId: string) => void;
  onCustom?: () => void;
  triggerType?: CampaignTriggerType;
  triggerConfig?: CampaignTriggerConfig;
  webhookEndpointId?: string | null;
}) {
  const [templates, setTemplates] = useState<CampaignTemplateDefinition[]>([]);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CampaignTemplateFilter | "all">("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const recommendedIds = useMemo(
    () => recommendedTemplateIdsForTrigger(triggerType),
    [triggerType]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/campaign-templates`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load templates");
      setTemplates(json.templates ?? []);
      setFeaturedId(json.featuredId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let list = templates;
    if (!showAll && recommendedIds.length) {
      const preferred = recommendedIds
        .map((id) => list.find((t) => t.id === id))
        .filter(Boolean) as CampaignTemplateDefinition[];
      const rest = list.filter((t) => !recommendedIds.includes(t.id));
      list = [...preferred, ...rest];
      // Default view: recommended first; still show all unless filter set
    }
    if (filter === "all") return list;
    return list.filter((t) => t.filters.includes(filter));
  }, [templates, filter, showAll, recommendedIds]);

  const preview = previewId ? templates.find((t) => t.id === previewId) : null;

  const useTemplate = async (templateId: string) => {
    setBusyId(templateId);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/campaign-templates/${templateId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          triggerType,
          triggerConfig,
          webhookEndpointId: webhookEndpointId ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create draft");
      const campaignId = json.campaign?.id as string | undefined;
      if (campaignId) onUsed?.(campaignId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create draft");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-900">Campaign templates</p>
          <p className="text-[11px] text-zinc-500">
            Start from a proven short sequence. Copies into an editable draft — system templates never
            change under you. Recommended for{" "}
            <span className="font-medium text-zinc-700">
              {triggerType === "webhook" ? "automatic / webhook" : "manual / CSV"}
            </span>{" "}
            triggers first.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {showAll ? "Show recommended first" : "Browse all"}
          </button>
          {onCustom ? (
            <button
              type="button"
              onClick={onCustom}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Build custom
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              filter === chip.id
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates…
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {visible.map((t) => {
            const featured = t.id === featuredId || t.featured;
            return (
              <div
                key={t.id}
                className={cn(
                  "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
                  featured && "bg-emerald-50/40"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-zinc-900">{t.name}</p>
                    {featured ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        <Sparkles className="h-3 w-3" /> Featured
                      </span>
                    ) : null}
                    {recommendedIds.includes(t.id) ? (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                        Recommended
                      </span>
                    ) : null}
                    {channelChips(t).map((c) => (
                      <span
                        key={c}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                      >
                        {c}
                      </span>
                    ))}
                    <span className="text-[10px] text-zinc-500">
                      {t.stepCount} steps · {t.totalDurationLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">{t.description}</p>
                  <Timeline steps={t.timeline} />
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {previewId === t.id ? "Hide" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void useTemplate(t.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0f6344] disabled:opacity-50"
                  >
                    {busyId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Use template
                  </button>
                </div>
              </div>
            );
          })}
          {!visible.length ? (
            <p className="px-3 py-4 text-[12px] text-zinc-500">No templates match this filter.</p>
          ) : null}
        </div>
      )}

      {preview ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
          <p className="text-[12px] font-semibold text-zinc-900">Preview — {preview.name}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Trigger: {preview.recommendedTrigger}. Stop mode: review-link click (editable). Cooldown:{" "}
            {preview.duplicateProtectionDays} days. Quiet hours: {preview.sendWindowStart}–
            {preview.sendWindowEnd}.
          </p>
          {preview.suitableForCsvReactivation && !preview.suitableForWebhook ? (
            <p className="mt-1 text-[11px] font-medium text-amber-800">
              Best for CSV / manual enrollment — confirm consent before reactivation blasts.
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-zinc-500">{preview.complianceNotes}</p>
          <div className="mt-2 space-y-2">
            {preview.messages.map((m, i) => (
              <div
                key={`${m.step_key}-${m.channel}-${i}`}
                className="rounded-md border border-zinc-200 bg-white px-2.5 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {m.channel} · {m.step_key}
                </p>
                {m.subject ? (
                  <p className="mt-0.5 text-[12px] font-medium text-zinc-800">Subject: {m.subject}</p>
                ) : null}
                <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-zinc-700">
                  {m.body}
                </pre>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
