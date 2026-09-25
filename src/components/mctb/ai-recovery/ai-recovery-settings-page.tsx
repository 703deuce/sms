"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { MctbPageContainer } from "@/components/mctb/shell/mctb-page-container";
import { MctbPageHeader } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import { Button } from "@/components/ui/button";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  AI_RECOVERY_SIMPLIFIED_FIELDS,
  deriveSimplifiedFieldEnabled,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import type { MctbBookingLinkDto } from "@/lib/mctb/booking-links/service";
import type { LeadRecoveryCollectField } from "@/lib/mctb/lead-recovery/types";
import { validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";
import "../kimi-ui/reference.css";

type ContextData = {
  business: {
    name: string;
    hours: string | null;
    services: string[];
    serviceArea: string | null;
    website: string | null;
    editHref: string;
    knowledgeEditHref: string;
  };
  messaging: { ready: boolean; senderLabel: string; setupHref: string };
  recovery: { enabled: boolean; bookingLinkId: string | null };
  booking: {
    configAvailable: boolean;
    links: MctbBookingLinkDto[];
    entitled: boolean;
    paid: boolean;
  };
  copy: { senderExplanation: string };
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-white px-4 py-3 hover:bg-muted/20"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#1b1e23]">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[#626872]">{description}</span>
      </span>
    </label>
  );
}

function SectionSkeleton() {
  return (
    <div className="ref-card animate-pulse space-y-3 p-5" aria-hidden>
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-3 w-full max-w-md rounded bg-muted" />
      <div className="h-10 rounded bg-muted" />
    </div>
  );
}

const DEFAULT_TOGGLES: Record<AiRecoverySimplifiedField, boolean> = {
  NAME: true,
  REASON: true,
  ADDRESS: true,
  URGENCY: true,
  CALLBACK_TIME: true,
};

export function AiRecoverySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [fields, setFields] = useState<Record<AiRecoverySimplifiedField, boolean>>(DEFAULT_TOGGLES);
  const [bookingLinkEnabled, setBookingLinkEnabled] = useState(false);
  const [bookingLinkId, setBookingLinkId] = useState<string | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("Booking");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ctxRes, cfgRes] = await Promise.all([
        fetch("/api/mctb/ai-recovery/context", { cache: "no-store" }),
        fetch("/api/mctb/lead-recovery/config", { cache: "no-store" }),
      ]);
      const ctxJson = await ctxRes.json();
      const cfgJson = await cfgRes.json();
      if (!ctxRes.ok) throw new Error(ctxJson.error || "Could not load AI Recovery");
      if (!cfgRes.ok) throw new Error(cfgJson.error || "Could not load settings");

      const context = ctxJson.data as ContextData;
      setCtx(context);
      setEnabled(Boolean(context.recovery.enabled));
      const caps = (cfgJson.data?.config?.collectCapabilities || []) as LeadRecoveryCollectField[];
      const derived = deriveSimplifiedFieldEnabled(caps);
      const anyOn = Object.values(derived).some(Boolean);
      setFields(anyOn ? derived : DEFAULT_TOGGLES);

      const linkId = context.recovery.bookingLinkId;
      const hasLink = Boolean(
        linkId && context.booking.links.some((l) => l.id === linkId && l.active),
      );
      setBookingLinkEnabled(hasLink);
      setBookingLinkId(linkId);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load AI Recovery settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bookingLinks = ctx?.booking.links ?? [];
  const bookingAvailable = ctx?.booking.configAvailable ?? false;

  const selectedLink = useMemo(
    () => bookingLinks.find((l) => l.id === bookingLinkId) ?? null,
    [bookingLinks, bookingLinkId],
  );

  async function ensureBookingLink(): Promise<string | null> {
    if (bookingLinkId && bookingLinks.some((l) => l.id === bookingLinkId)) {
      return bookingLinkId;
    }
    const url = newLinkUrl.trim();
    if (!url) return null;
    const validation = validateBookingLinkUrl(url);
    if (!validation.ok) {
      setSaveError(validation.error || "Enter a valid booking URL");
      return null;
    }
    const res = await fetch("/api/mctb/booking-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: newLinkLabel.trim() || "Booking",
        url,
        active: true,
        isDefault: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not save booking link");
    const created = json.data as MctbBookingLinkDto;
    setBookingLinkId(created.id);
    return created.id;
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      let linkId = bookingLinkId;
      if (enabled && bookingAvailable && bookingLinkEnabled) {
        linkId = await ensureBookingLink();
        if (!linkId) {
          setSaveError("Add a booking URL or turn off booking link.");
          setSaving(false);
          return;
        }
      }

      const res = await fetch("/api/mctb/ai-recovery/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          fields,
          bookingLinkEnabled: bookingAvailable && bookingLinkEnabled,
          bookingLinkId: bookingAvailable && bookingLinkEnabled ? linkId : bookingLinkId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <MctbPageContainer>
        <div className="mctb-page voice-theme">
          <div className="mctb-page-inner max-w-2xl space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      </MctbPageContainer>
    );
  }

  if (loadError) {
    return (
      <MctbPageContainer>
        <div className="mctb-page voice-theme">
          <div className="mctb-page-inner max-w-2xl">
            <MctbPageHeader title="AI Recovery" description="Help Transovo collect useful information after a missed call." />
            <div className="ref-card mt-6 p-6" role="alert">
              <p className="text-[13px] text-[#9b2c2c]">{loadError}</p>
              <Button className="mt-4" type="button" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </MctbPageContainer>
    );
  }

  return (
    <MctbPageContainer>
      <div className="mctb-page voice-theme">
        <div className="mctb-page-inner max-w-2xl">
          <MctbPageHeader
            title="AI Recovery"
            description="Help Transovo collect useful information after a missed call."
            action={
              <div className="flex items-center gap-3">
                {saved && !saving ? (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1f6b42]">
                    <Check className="h-4 w-4" aria-hidden />
                    Saved
                  </span>
                ) : null}
                <Button onClick={() => void save()} disabled={saving} size="md">
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            }
          />

          {saveError ? (
            <div
              className="mt-4 rounded-lg border border-[#f0d0d0] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#9b2c2c]"
              role="alert"
            >
              {saveError}
            </div>
          ) : null}

          {!ctx?.messaging.ready && enabled ? (
            <div
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950"
              role="status"
            >
              Messaging needs attention before AI Recovery can send messages.{" "}
              <Link href={ctx?.messaging.setupHref ?? MCTB_ROUTES.setupPhone} className="font-semibold underline">
                Fix in Setup
              </Link>
            </div>
          ) : null}

          <section className="mt-8 space-y-3" aria-labelledby="ai-recovery-status-heading">
            <h2 id="ai-recovery-status-heading" className="text-[15px] font-semibold text-[#1b1e23]">
              AI Recovery
            </h2>
            <p className="text-[13px] text-[#626872]">
              When AI Recovery is on, Transovo can respond to eligible customer replies, collect useful
              information, and prepare the conversation for your team. {ctx?.copy.senderExplanation}
            </p>
            <label
              htmlFor="ai-recovery-enabled"
              className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-white px-4 py-3"
            >
              <span className="text-[13px] font-semibold">AI Recovery</span>
              <input
                id="ai-recovery-enabled"
                type="checkbox"
                role="switch"
                aria-checked={enabled}
                className="h-5 w-5"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            </label>
            <p className="text-[12px] text-muted-foreground">
              Sender: {ctx?.messaging.senderLabel}. Captured details appear in{" "}
              <Link href={MCTB_ROUTES.conversations} className="font-semibold text-primary hover:underline">
                Inbox
              </Link>{" "}
              and{" "}
              <Link href={MCTB_ROUTES.missedCalls} className="font-semibold text-primary hover:underline">
                Missed Calls
              </Link>
              .
            </p>
          </section>

          <hr className="my-8 border-border/60" />

          <section className="space-y-3" aria-labelledby="ai-recovery-business-heading">
            <h2 id="ai-recovery-business-heading" className="text-[15px] font-semibold text-[#1b1e23]">
              Business information
            </h2>
            <p className="text-[13px] text-[#626872]">What Transovo should know about your business.</p>
            <div className="ref-card space-y-2 p-5 text-[13px] text-[#1b1e23]">
              <p className="font-semibold">{ctx?.business.name || "Your business"}</p>
              {ctx?.business.services.length ? (
                <p className="text-[#626872]">{ctx.business.services.join(" · ")}</p>
              ) : (
                <p className="text-[#626872]">Add services so recovery answers stay accurate.</p>
              )}
              {ctx?.business.serviceArea ? (
                <p className="text-[#626872]">Serves {ctx.business.serviceArea}</p>
              ) : null}
              {ctx?.business.hours ? (
                <p className="text-[#626872]">{ctx.business.hours}</p>
              ) : null}
              <Link
                href={ctx?.business.editHref ?? "/settings/business"}
                className="inline-block pt-2 text-[13px] font-semibold text-primary hover:underline"
              >
                Edit business information
              </Link>
            </div>
          </section>

          <hr className="my-8 border-border/60" />

          <section className="space-y-3" aria-labelledby="ai-recovery-collect-heading">
            <h2 id="ai-recovery-collect-heading" className="text-[15px] font-semibold text-[#1b1e23]">
              Information to collect
            </h2>
            <p className="text-[13px] text-[#626872]">
              What information would be useful before you follow up with this caller?
            </p>
            <div className="space-y-2">
              {AI_RECOVERY_SIMPLIFIED_FIELDS.map((def) => (
                <ToggleRow
                  key={def.field}
                  id={`collect-${def.field}`}
                  label={def.label}
                  description={def.description}
                  checked={fields[def.field]}
                  onChange={(on) => setFields((prev) => ({ ...prev, [def.field]: on }))}
                />
              ))}
            </div>
          </section>

          {bookingAvailable ? (
            <>
              <hr className="my-8 border-border/60" />
              <section className="space-y-3" aria-labelledby="ai-recovery-booking-heading">
                <h2 id="ai-recovery-booking-heading" className="text-[15px] font-semibold text-[#1b1e23]">
                  Booking link
                </h2>
                <p className="text-[13px] text-[#626872]">
                  Let Transovo send your booking link when a caller wants to schedule.
                </p>
                <label
                  htmlFor="booking-link-enabled"
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-white px-4 py-3"
                >
                  <span className="text-[13px] font-semibold">Enable booking link</span>
                  <input
                    id="booking-link-enabled"
                    type="checkbox"
                    checked={bookingLinkEnabled}
                    onChange={(e) => setBookingLinkEnabled(e.target.checked)}
                  />
                </label>
                {bookingLinkEnabled ? (
                  <div className="space-y-3 ref-card p-5">
                    {bookingLinks.length > 0 ? (
                      <div>
                        <label htmlFor="booking-link-select" className="text-[12px] font-medium text-[#626872]">
                          Booking URL
                        </label>
                        <select
                          id="booking-link-select"
                          className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px]"
                          value={bookingLinkId ?? ""}
                          onChange={(e) => setBookingLinkId(e.target.value || null)}
                        >
                          {bookingLinks.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.label} — {l.url}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {!selectedLink ? (
                      <div className="space-y-2">
                        <label htmlFor="booking-url" className="text-[12px] font-medium text-[#626872]">
                          Booking URL
                        </label>
                        <input
                          id="booking-url"
                          type="url"
                          className="w-full rounded-lg border border-border px-3 py-2 text-[13px]"
                          placeholder="https://"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                        />
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground break-all">{selectedLink.url}</p>
                    )}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </MctbPageContainer>
  );
}
