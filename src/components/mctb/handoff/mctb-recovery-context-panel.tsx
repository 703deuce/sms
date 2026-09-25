"use client";

import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  buildMctbCapturedFieldRows,
  formatMctbUrgencyLine,
} from "@/lib/mctb/inbox/thread-presentation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type HandoffPanelData = {
  state: string | null;
  followUpStatus: string | null;
  responseMode: string | null;
  capturedFields: Record<string, unknown>;
  latestSnapshot?: {
    summaryText: string | null;
    customerFacts: Record<string, unknown>;
    aiDerived: Record<string, unknown>;
  } | null;
};

type Props = {
  conversationId: string;
  missedCallEventId?: string | null;
  customerPhone?: string | null;
};

export function MctbRecoveryContextPanel({
  conversationId,
  missedCallEventId,
  customerPhone,
}: Props) {
  const [data, setData] = useState<HandoffPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/mctb/handoff/context?conversationId=${conversationId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setData(json.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function action(
    act: "take_over" | "resume_automation" | "follow_up",
    followUpStatus?: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/handoff/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: act,
          conversationId,
          followUpStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const facts = useMemo(() => {
    const snap = data?.latestSnapshot?.customerFacts || {};
    const captured = data?.capturedFields || {};
    return { ...captured, ...snap };
  }, [data]);

  const fieldRows = useMemo(() => buildMctbCapturedFieldRows(facts), [facts]);
  const urgencyLine = useMemo(
    () => formatMctbUrgencyLine(facts, data?.state),
    [facts, data?.state],
  );
  const summary =
    data?.latestSnapshot?.summaryText?.trim() ||
    (typeof data?.latestSnapshot?.aiDerived?.aiSummary === "string"
      ? data.latestSnapshot.aiDerived.aiSummary.trim()
      : "");

  const humanActive = data?.state === "human_active";
  const aiHandling =
    data?.state &&
    !humanActive &&
    data.state !== "resolved" &&
    data.state !== "appointment_booked" &&
    data.responseMode !== "notify_only";

  const tel =
    customerPhone ||
    (facts.caller_phone as string | undefined) ||
    (facts.callerPhone as string | undefined);

  const hasAutomationControl = Boolean(aiHandling || humanActive);
  const hasContext = fieldRows.length > 0 || Boolean(urgencyLine) || Boolean(summary);
  const showPanel = loading || loadError || hasAutomationControl || hasContext;

  if (!showPanel) return null;

  const automationBadge = humanActive ? "Human active" : aiHandling ? "AI active" : null;

  return (
    <section
      className="border-b border-[#eaedf0] bg-[#f8f9fb] px-4 py-3"
      aria-label="AI recovery context"
    >
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-3 w-32 animate-pulse rounded bg-[#e2e6ec]" />
          <div className="h-3 w-48 animate-pulse rounded bg-[#e2e6ec]" />
        </div>
      ) : loadError ? (
        <p className="text-[12px] text-[#6b7280]">
          Recovery details unavailable.{" "}
          <button
            type="button"
            className="font-semibold text-[var(--mctb-brand-strong,#2f3f85)] underline"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Retry
          </button>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111827]">AI Recovery</p>
              {urgencyLine ? (
                <p className="mt-0.5 text-[12px] font-medium text-[#374151]">{urgencyLine}</p>
              ) : null}
            </div>
            {automationBadge ? (
              <span
                className="shrink-0 rounded-full border border-[#dde2ea] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4b5563]"
              >
                {automationBadge}
              </span>
            ) : null}
          </div>

          {fieldRows.length > 0 ? (
            <dl className="mt-2 grid gap-1 text-[12px] text-[#374151]">
              {fieldRows.map((row) => (
                <div key={row.label} className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-[#6b7280]">{row.label}</dt>
                  <dd className="min-w-0 flex-1">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {summary ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Summary</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#374151]">{summary}</p>
            </div>
          ) : null}

          {humanActive ? (
            <p className="mt-2 text-[12px] text-[#4b5563]">
              You&apos;re handling this conversation. Automatic AI replies are paused.
            </p>
          ) : aiHandling ? (
            <p className="mt-2 text-[12px] text-[#4b5563]">AI Recovery is handling replies.</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {aiHandling ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)]"
                onClick={() => void action("take_over")}
              >
                Take over conversation
              </button>
            ) : null}
            {humanActive ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold text-[#374151]"
                onClick={() => void action("resume_automation")}
              >
                Resume AI Recovery
              </button>
            ) : null}
            {tel ? (
              <a
                href={`tel:${tel}`}
                className="inline-flex h-8 items-center rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold text-[#374151]"
              >
                Call customer
              </a>
            ) : null}
            {data?.followUpStatus !== "called_back" ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center rounded-lg border border-transparent px-2 text-[12px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)] underline-offset-2 hover:underline"
                onClick={() => void action("follow_up", "called_back")}
              >
                Mark called back
              </button>
            ) : null}
            {data?.followUpStatus !== "resolved" && data?.state !== "resolved" ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center rounded-lg border border-transparent px-2 text-[12px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)] underline-offset-2 hover:underline"
                onClick={() => void action("follow_up", "resolved")}
              >
                Resolve
              </button>
            ) : null}
          </div>

          {missedCallEventId ? (
            <Link
              href={MCTB_ROUTES.missedCallDetail(missedCallEventId)}
              className="mt-2 inline-block text-[12px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)] hover:underline"
            >
              View missed call
            </Link>
          ) : null}

          {error ? (
            <p className="mt-2 text-[12px] text-rose-700" role="alert">{error}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
