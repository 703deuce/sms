"use client";

import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProviderPayload = {
  booking: {
    provider: string;
    connected: boolean;
    ready: boolean;
    reason?: string;
    calendarLabel: string | null;
    eventTypeLabel: string | null;
  };
  stripe: { connected: boolean; canCharge: boolean };
};

type AiConfig = {
  provider: "microsoft" | "calendly";
  enabled: boolean;
  calendarId?: string | null;
  eventTypeUri?: string | null;
  eventTypeId?: string | null;
  durationMinutes?: number | null;
  fallbackBookingLinkId?: string | null;
};

export function LeadRecoveryProviderPanel({
  showBookingProvider,
  showBookingTargets,
  showPaymentsProvider,
  onBookingSaved,
}: {
  showBookingProvider: boolean;
  showBookingTargets: boolean;
  showPaymentsProvider: boolean;
  onBookingSaved?: () => void;
}) {
  const [providers, setProviders] = useState<ProviderPayload | null>(null);
  const [aiCfg, setAiCfg] = useState<AiConfig | null>(null);
  const [targets, setTargets] = useState<Array<{ id: string; label: string }>>([]);
  const [targetId, setTargetId] = useState("");
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [testSlots, setTestSlots] = useState<string[]>([]);

  const load = useCallback(async () => {
    const lrRes = await fetch("/api/mctb/lead-recovery/config", { cache: "no-store" });
    const lrJson = await lrRes.json();
    setProviders(lrJson.data?.providers as ProviderPayload);
    if (!showBookingProvider) return;
    const aiRes = await fetch("/api/mctb/ai-booking/config");
    if (aiRes.ok) {
      const aiJson = await aiRes.json();
      const cfg = aiJson.data?.config as AiConfig;
      setAiCfg(cfg);
      const provider = cfg?.provider === "calendly" ? "calendly" : "microsoft";
      const tRes = await fetch(`/api/mctb/ai-booking/config?targets=1&provider=${provider}`);
      const tJson = await tRes.json();
      const list = (tJson.data?.targets || []) as Array<{ id: string; label: string }>;
      setTargets(list);
      setTargetId(cfg?.eventTypeUri || cfg?.calendarId || cfg?.eventTypeId || list[0]?.id || "");
      setDuration(cfg?.durationMinutes || 60);
    }
  }, [showBookingProvider]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTarget = async () => {
    if (!aiCfg) return;
    setSaving(true);
    const patch =
      aiCfg.provider === "calendly"
        ? { enabled: true, eventTypeUri: targetId, durationMinutes: duration }
        : { enabled: true, calendarId: targetId, durationMinutes: duration };
    await fetch("/api/mctb/ai-booking/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    await load();
    onBookingSaved?.();
  };

  const runAvailabilityTest = async () => {
    setTestSlots([]);
    const res = await fetch("/api/mctb/ai-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test_availability",
        timezone: "America/New_York",
        windowStartUtc: new Date(Date.now() + 24 * 3600_000).toISOString(),
        windowEndUtc: new Date(Date.now() + 48 * 3600_000).toISOString(),
      }),
    });
    const json = await res.json();
    const slots = (json.data?.slots || []) as Array<{ startUtc: string }>;
    setTestSlots(
      slots.slice(0, 3).map((s) =>
        new Date(s.startUtc).toLocaleString("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      ),
    );
  };

  const bookingProvider = providers?.booking;
  const providerName =
    bookingProvider?.provider === "calendly" ? "Calendly" : "Microsoft Calendar";

  return (
    <div className="lr-card">
      <h3 className="lr-card-title">Connected services</h3>

      {showBookingProvider && (
      <div className="lr-provider-block">
        <div className="lr-provider-head">
          <strong>Scheduling (when policy allows)</strong>
          <span className={bookingProvider?.ready ? "lr-status--ready" : "lr-status--warn"}>
            {bookingProvider?.ready ? "Ready" : "Needs attention"}
          </span>
        </div>
        <dl className="lr-provider-dl">
          <div><dt>Provider</dt><dd>{providerName}</dd></div>
          <div>
            <dt>Connection</dt>
            <dd>{bookingProvider?.connected ? "Connected" : "Not connected"}</dd>
          </div>
          {bookingProvider?.calendarLabel && (
            <div><dt>Calendar</dt><dd>{bookingProvider.calendarLabel}</dd></div>
          )}
          {bookingProvider?.eventTypeLabel && (
            <div><dt>Event type</dt><dd>{bookingProvider.eventTypeLabel}</dd></div>
          )}
        </dl>
        <div className="lr-provider-actions">
          <Link
            href={`/integrations?provider=${bookingProvider?.provider === "calendly" ? "calendly" : "microsoft"}`}
            className="lr-btn lr-btn--secondary lr-btn--sm"
          >
            Manage connection
          </Link>
          {showBookingTargets && aiCfg && (
            <>
              <button type="button" className="lr-btn lr-btn--secondary lr-btn--sm" onClick={() => void runAvailabilityTest()}>
                Test availability
              </button>
            </>
          )}
        </div>
        {testSlots.length > 0 && (
          <p className="lr-hint">Sample slots: {testSlots.join(" · ")}</p>
        )}
      </div>
      )}

      {showBookingProvider && showBookingTargets && aiCfg && (
        <div className="lr-provider-targets">
          <h4 className="lr-provider-subtitle">Booking target</h4>
          <label className="lr-field">
            {aiCfg.provider === "calendly" ? "Event type" : "Calendar"}
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="lr-field">
            Duration
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </label>
          <button type="button" className="lr-btn lr-btn--primary lr-btn--sm" disabled={saving} onClick={() => void saveTarget()}>
            {saving ? "Saving…" : "Save booking target"}
          </button>
        </div>
      )}

      {showPaymentsProvider && (
      <div className="lr-provider-block">
        <div className="lr-provider-head">
          <strong>Stripe Text-to-Pay</strong>
          <span className={providers?.stripe.canCharge ? "lr-status--ready" : "lr-status--warn"}>
            {providers?.stripe.canCharge ? "Ready" : "Needs setup"}
          </span>
        </div>
        <Link href="/integrations?provider=stripe" className="lr-btn lr-btn--secondary lr-btn--sm">
          Manage connection
        </Link>
      </div>
      )}

      {showPaymentsProvider && (
      <Link href={MCTB_ROUTES.payments} className="lr-link-row">
        Payments <span>→</span>
      </Link>
      )}
    </div>
  );
}
