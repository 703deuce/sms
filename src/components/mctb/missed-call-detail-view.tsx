"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import Link from "next/link";
import { useEffect, useState } from "react";

type TimelineStep = {
  id: string;
  label: string;
  status: "pending" | "complete" | "failed" | "skipped";
  at: string | null;
};

type RepeatCaller = {
  total: number;
  missedToday: number;
};

type LinkClick = {
  id: string;
  destinationUrl: string | null;
  createdAt: string;
};

type FormSubmission = {
  id: string;
  submittedAt: string;
  payloadJson: Record<string, unknown>;
};

type CallerHistoryEntry = {
  id: string;
  kind: string;
  label: string;
  at: string;
  href?: string;
};

export function MctbMissedCallDetailView({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<{ consentMode: string; steps: TimelineStep[] } | null>(
    null,
  );
  const [repeatCaller, setRepeatCaller] = useState<RepeatCaller | null>(null);
  const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  const [history, setHistory] = useState<CallerHistoryEntry[]>([]);
  const [showCallBack, setShowCallBack] = useState(false);
  const [consent, setConsent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load event");
        setEvent(json.event);
        setTimeline(json.timeline);
        setRepeatCaller(json.repeatCaller || null);
        setLinkClicks(json.linkClicks || []);
        setFormSubmissions(json.formSubmissions || []);
        setLeadCaptureEnabled(Boolean(json.leadCaptureEnabled));
        setConsent(json.consent || null);
        const caller = String(json.event?.callerE164 || "");
        if (caller) {
          void fetch(`/api/voice/caller-history?callerE164=${encodeURIComponent(caller)}`)
            .then((r) => r.json())
            .then((h) => setHistory(h.data || []));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading event…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Missed call event</h1>
          <p className="text-sm text-muted-foreground">{eventId}</p>
        </div>
        <Link href="/voice/missed-calls">
          <Button variant="outline">Back to log</Button>
        </Link>
      </div>

      <Card className="space-y-2 p-4 text-sm">
        <p>
          <span className="font-semibold">Caller:</span> {String(event?.callerE164 || "—")}
        </p>
        <p>
          <span className="font-semibold">Business line:</span> {String(event?.businessE164 || "—")}
        </p>
        <p>
          <span className="font-semibold">Status:</span> {String(event?.status || "—")}
        </p>
        <p>
          <span className="font-semibold">Consent mode:</span> {timeline?.consentMode || "—"}
        </p>
        {repeatCaller ? (
          <p>
            <span className="font-semibold">Repeat caller:</span>{" "}
            {repeatCaller.missedToday > 1
              ? `Called ${repeatCaller.missedToday}× today (${repeatCaller.total} total)`
              : `${repeatCaller.total} prior missed call(s)`}
          </p>
        ) : null}
        {leadCaptureEnabled ? (
          <p className="text-emerald-700">Lead capture enabled for this workspace</p>
        ) : null}
      </Card>

      {consent ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Press-1 consent</h2>
            <Link href="/voice/consent-log" className="text-sm font-semibold text-primary hover:underline">
              Open consent log
            </Link>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="font-semibold">Recorded:</span>{" "}
              {consent.consentedAt
                ? new Date(String(consent.consentedAt)).toLocaleString()
                : "—"}
            </p>
            <p>
              <span className="font-semibold">Digit pressed:</span>{" "}
              {String(consent.affirmativeInput || "1")}
            </p>
            <p>
              <span className="font-semibold">Method:</span> {String(consent.method || "—")}
            </p>
            <p>
              <span className="font-semibold">Scope:</span> {String(consent.consentScope || "—")}
            </p>
            {consent.callSessionId ? (
              <p className="sm:col-span-2">
                <span className="font-semibold">Call reference:</span>{" "}
                <code className="text-xs">{String(consent.callSessionId)}</code>
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {event?.callerE164 ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-[15px] font-semibold">Call back</h2>
          {showCallBack ? (
            <BusinessCallBackButton
              destinationE164={String(event.callerE164)}
              contextType="missed_call"
              contextRefId={eventId}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowCallBack(true)}>
              Call Back as Business
            </Button>
          )}
        </Card>
      ) : null}

      {history.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-[15px] font-semibold">Caller history</h2>
          <ul className="space-y-2 text-sm">
            {history.slice(0, 12).map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                {h.href ? (
                  <Link href={h.href} className="text-primary hover:underline truncate">
                    {h.label}
                  </Link>
                ) : (
                  <span>{h.label}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(h.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {linkClicks.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-[15px] font-semibold">Link clicks</h2>
          <ul className="space-y-2 text-sm">
            {linkClicks.map((click) => (
              <li key={click.id} className="flex justify-between gap-3">
                <span className="truncate">{click.destinationUrl || "Tracked link"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(click.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {formSubmissions.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-[15px] font-semibold">Form submissions</h2>
          <ul className="space-y-2 text-sm">
            {formSubmissions.map((sub) => (
              <li key={sub.id}>
                <p className="text-xs text-muted-foreground">
                  {new Date(sub.submittedAt).toLocaleString()}
                </p>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                  {JSON.stringify(sub.payloadJson, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-[15px] font-semibold">Timeline</h2>
        <div className="space-y-2">
          {(timeline?.steps || []).map((step) => (
            <div key={`${step.id}-${step.at || "pending"}`} className="flex items-start gap-2 text-sm">
              <span
                className={
                  step.status === "complete"
                    ? "text-emerald-600"
                    : step.status === "failed"
                      ? "text-rose-600"
                      : "text-muted-foreground"
                }
              >
                {step.status === "complete" ? "✓" : step.status === "failed" ? "✕" : "○"}
              </span>
              <div>
                <p className="font-medium">{step.label}</p>
                {step.at ? (
                  <p className="text-xs text-muted-foreground">{new Date(step.at).toLocaleString()}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
