"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MissedCallTextBackConfig } from "@/lib/solutions/missed-call-text-back/types";
import { DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG } from "@/lib/solutions/missed-call-text-back/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PhoneOption = { id: string; number: string; friendlyName?: string };

export function MissedCallTextBackWizard({
  initial,
  phoneNumbers,
}: {
  initial?: {
    setupId: string | null;
    flowId: string | null;
    config: MissedCallTextBackConfig;
    advancedCustomized: boolean;
    status: string;
  } | null;
  phoneNumbers: PhoneOption[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState<MissedCallTextBackConfig>(
    initial?.config || DEFAULT_MISSED_CALL_TEXT_BACK_CONFIG,
  );
  const [setupId, setSetupId] = useState<string | null>(initial?.setupId || null);
  const [flowId, setFlowId] = useState<string | null>(initial?.flowId || null);
  const [advancedCustomized, setAdvancedCustomized] = useState(
    Boolean(initial?.advancedCustomized),
  );
  const [status, setStatus] = useState(initial?.status || "DRAFT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initial?.config) setConfig(initial.config);
    if (initial?.setupId) setSetupId(initial.setupId);
    if (initial?.flowId) setFlowId(initial.flowId);
    setAdvancedCustomized(Boolean(initial?.advancedCustomized));
    if (initial?.status) setStatus(initial.status);
  }, [initial]);

  async function save(activate: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/solutions/missed-call-text-back", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...config,
          activate,
          setupId: setupId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSetupId(json.data.setupId);
      setFlowId(json.data.flowId);
      setAdvancedCustomized(Boolean(json.data.advancedCustomized));
      if (json.data.status) setStatus(String(json.data.status));
      else if (activate) setStatus("ACTIVE");
      setSaved(true);
      if (activate) {
        router.push(`/automations/${json.data.flowId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof MissedCallTextBackConfig>(
    key: K,
    value: MissedCallTextBackConfig[K],
  ) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
          Missed Call Text Back
        </h1>
        <p className="mt-1.5 text-[14px] text-[#6B7280]">
          Automatically text people who called and could not reach you. This
          creates a real automation you can later open in the visual builder.
        </p>
      </div>

      {advancedCustomized ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          This automation contains advanced customizations. Some settings are
          available only in the visual builder. Safe wizard fields still update
          without deleting your custom nodes.
          {flowId ? (
            <div className="mt-2">
              <Link
                href={`/automations/${flowId}/edit`}
                className="font-semibold text-[#2563EB] hover:underline"
              >
                Open Visual Flow
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <Card className="space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-[#374151]">Name</span>
          <input
            className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
            value={config.name}
            onChange={(e) => patch("name", e.target.value)}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-[#374151]">
            Sending number
          </span>
          <select
            className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
            value={config.phoneNumberId || ""}
            onChange={(e) => patch("phoneNumberId", e.target.value || null)}
          >
            <option value="">Default workspace number</option>
            {phoneNumbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.friendlyName || n.number}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-[#374151]">
              Wait before first text (minutes)
            </span>
            <input
              type="number"
              min={0}
              className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
              value={config.initialDelayMinutes}
              onChange={(e) =>
                patch("initialDelayMinutes", Number(e.target.value || 0))
              }
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-[#374151]">
              Reply window (minutes)
            </span>
            <input
              type="number"
              min={1}
              className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
              value={config.replyWindowMinutes}
              onChange={(e) =>
                patch("replyWindowMinutes", Number(e.target.value || 1))
              }
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[12px] font-semibold text-[#374151]">
            First message
          </span>
          <textarea
            className="min-h-[96px] w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px]"
            value={config.firstMessage}
            onChange={(e) => patch("firstMessage", e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
          <input
            type="checkbox"
            checked={config.followUpEnabled}
            onChange={(e) => patch("followUpEnabled", e.target.checked)}
          />
          Send a follow-up if they do not reply
        </label>

        {config.followUpEnabled ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">
                Follow-up delay (minutes)
              </span>
              <input
                type="number"
                min={0}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
                value={config.followUpDelayMinutes}
                onChange={(e) =>
                  patch("followUpDelayMinutes", Number(e.target.value || 0))
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">
                Follow-up message
              </span>
              <textarea
                className="min-h-[96px] w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px]"
                value={config.followUpMessage}
                onChange={(e) => patch("followUpMessage", e.target.value)}
              />
            </label>
          </>
        ) : null}

        <label className="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
          <input
            type="checkbox"
            checked={config.stopOnReply}
            onChange={(e) => patch("stopOnReply", e.target.checked)}
          />
          Stop messaging when they reply
        </label>
      </Card>

      {error ? (
        <p className="text-[13px] font-medium text-rose-600">{error}</p>
      ) : null}
      {saved && !error ? (
        <p className="text-[13px] font-medium text-emerald-700">
          Saved. Linked automation is ready under Automations → Flows.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => save(true)}>
          {saving ? "Saving…" : setupId ? "Save & activate" : "Create & activate"}
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => save(false)}
        >
          {setupId && status === "ACTIVE" ? "Save changes" : "Save draft"}
        </Button>
        {flowId ? (
          <>
            <Link
              href={`/automations/${flowId}`}
              className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-[#2563EB] hover:underline"
            >
              Open automation
            </Link>
            <Link
              href={`/automations/${flowId}/edit`}
              className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-[#2563EB] hover:underline"
            >
              Edit visual flow
            </Link>
          </>
        ) : null}
        <Link
          href="/systems"
          className="inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-semibold text-[#6B7280] hover:underline"
        >
          View in My Agents
        </Link>
      </div>
    </div>
  );
}
