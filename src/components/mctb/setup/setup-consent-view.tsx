"use client";

import { MctbConsentPromptEditor } from "@/components/mctb/consent-prompt-editor";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_LABELS,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function MctbSetupConsentView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [consentMode, setConsentMode] = useState<MctbConsentMode>(MCTB_CONSENT_MODE_VERIFIED);
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [campaignDescription, setCampaignDescription] = useState("");
  const [press1Consent, setPress1Consent] = useState("");
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setPhoneNumberId(json.data.runtime.phoneNumberId);
      setConsentMode(json.data.consentMode);
      setCampaignDescription(json.data.prefills?.campaignDescription || "");
      setPress1Consent(json.data.prefills?.press1Consent || "");
      setPaused(Boolean(json.data.schedule?.paused));
      setPauseKind(json.data.schedule?.pauseKind ?? null);
      setPauseUntil(json.data.schedule?.pauseUntil ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          consentMode,
          existingConsentAttested:
            consentMode === MCTB_CONSENT_MODE_EXISTING ? existingConsentAttested : undefined,
          activate: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Consent"
      description="Choose how permission to text missed callers is established or relied upon."
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      {paused ? (
        <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
      ) : null}

      <div className="ref-card space-y-4 p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Permission method</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED] as const).map((mode) => {
            const meta = MCTB_CONSENT_MODE_LABELS[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setConsentMode(mode)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  consentMode === mode
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {meta.productCode.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-[14px] font-semibold text-foreground">{meta.title}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{meta.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {consentMode === MCTB_CONSENT_MODE_VERIFIED ? (
        <div className="ref-card p-5">
          <MctbConsentPromptEditor phoneNumberId={phoneNumberId} />
        </div>
      ) : (
        <div className="ref-card space-y-4 p-5">
          <p className="text-[13px] text-muted-foreground">
            Missed calls proceed directly to your recovery text after eligibility checks — no voice
            prompt or DTMF capture.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={existingConsentAttested}
              onChange={(e) => setExistingConsentAttested(e.target.checked)}
            />
            <span>
              I certify that I have the required permission to send SMS messages to callers covered
              by this setup.
            </span>
          </label>
        </div>
      )}

      <div className="ref-card space-y-2 p-5 text-[12px] text-muted-foreground">
        <p className="font-semibold text-foreground">Messaging use case (toll-free verification)</p>
        <p>{campaignDescription}</p>
        <p className="pt-2 font-semibold text-foreground">Opt-in description</p>
        <p>{consentMode === MCTB_CONSENT_MODE_VERIFIED ? press1Consent : "Describe prior opt-in for your business."}</p>
        <Link href="/compliance/campaign" className="font-semibold text-primary hover:underline">
          Edit in Messaging Compliance →
        </Link>
      </div>
    </MctbSetupSectionLayout>
  );
}
