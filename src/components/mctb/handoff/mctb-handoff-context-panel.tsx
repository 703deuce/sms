"use client";

import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { Phone, PhoneMissed } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  detectedAt?: string | null;
};

export function MctbHandoffContextPanel({
  conversationId,
  missedCallEventId,
  detectedAt,
}: Props) {
  const [data, setData] = useState<HandoffPanelData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/mctb/handoff/context?conversationId=${conversationId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok) setData(json.data);
    } catch {
      /* optional panel */
    }
  }, [conversationId]);

  useEffect(() => {
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

  const facts = data?.latestSnapshot?.customerFacts || data?.capturedFields || {};

  return (
    <aside
      className="border-l border-indigo-100 bg-indigo-50/40 p-4"
      aria-label="MCTB handoff context"
    >
      <div className="flex items-start gap-2 text-[13px] text-indigo-950">
        <PhoneMissed className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Missed-call recovery</p>
          {detectedAt ? (
            <p className="text-[12px] text-indigo-900/85">Missed {new Date(detectedAt).toLocaleString()}</p>
          ) : null}
          {data?.state ? (
            <p className="mt-1 text-[12px]">
              <span className="font-medium">State:</span> {data.state.replace(/_/g, " ")}
            </p>
          ) : null}
          {facts.service_reason ? (
            <p className="mt-1 text-[12px]">
              <span className="font-medium">Need:</span> {String(facts.service_reason)}
            </p>
          ) : null}
          {facts.urgency ? (
            <p className="mt-1 text-[12px]">
              <span className="font-medium">Urgency:</span> {String(facts.urgency)}
            </p>
          ) : null}
        </div>
      </div>

      {missedCallEventId ? (
        <Link
          href={MCTB_ROUTES.missedCallDetail(missedCallEventId)}
          className="mt-3 inline-block text-[12px] font-semibold text-indigo-700 hover:underline"
        >
          View missed call
        </Link>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo-800"
          onClick={() => void action("take_over")}
        >
          Take over
        </button>
        {data?.state === "human_active" ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700"
            onClick={() => void action("resume_automation")}
          >
            Resume automation
          </button>
        ) : null}
        {facts.caller_phone || facts.callerPhone ? (
          <a
            href={`tel:${facts.caller_phone || facts.callerPhone}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Call
          </a>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["called_back", "resolved"] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            className="text-[11px] font-semibold text-indigo-700 hover:underline"
            onClick={() => void action("follow_up", status)}
          >
            Mark {status.replace("_", " ")}
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-[12px] text-rose-700" role="alert">{error}</p> : null}
    </aside>
  );
}
