"use client";

import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbTextBackComposer, WizardQuestionBlock } from "@/components/mctb/wizard/mctb-wizard-ui";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const COMPLIANCE_PREVIEW =
  "Reply YES to confirm you want text messages from this business. Msg & data rates may apply. Reply STOP to opt out.";

export function MctbSetupTextBackView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [consentMode, setConsentMode] = useState<MctbConsentMode>(MCTB_CONSENT_MODE_VERIFIED);
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const r = json.data.runtime;
      setPhoneNumberId(r.phoneNumberId);
      setMessageTemplate(r.messageTemplate || "");
      setDelaySeconds(r.delaySeconds ?? 0);
      setConsentMode(json.data.consentMode);
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

  const isPress1 = consentMode === MCTB_CONSENT_MODE_VERIFIED;

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
          messageTemplate,
          delaySeconds,
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
      <div className="mctb-page voice-theme">
        <div className="mctb-page-inner">
          <div className="voice-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Text Back"
      description="Configure the recovery message sequence callers receive after a missed call."
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      {paused ? (
        <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
      ) : null}

      <div className="voice-card flex flex-wrap items-center justify-between gap-3 p-4 text-[13px]">
        <div>
          <span className="text-muted-foreground">Consent method:</span>{" "}
          <span className="font-semibold text-foreground">
            {consentMode === MCTB_CONSENT_MODE_EXISTING ? "Existing permission" : "Press 1"}
          </span>
        </div>
        <Link href={MCTB_ROUTES.setupConsent} className="font-semibold text-primary hover:underline">
          Change consent method
        </Link>
      </div>

      <div className="voice-card p-4 sm:p-6">
        <MctbTextBackComposer
          message={messageTemplate}
          onMessageChange={setMessageTemplate}
          press1Mode={isPress1}
          compliancePreview={COMPLIANCE_PREVIEW}
          variablesHint="{{customer.firstName}} · {{business.name}} · {{link}}"
        />
      </div>

      <div className="voice-card p-4 sm:p-6">
        <WizardQuestionBlock
          number={2}
          title="Delivery timing"
          subtitle="Optional — applies to future recovery sends only."
          optional
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#374151]">Delay before sending (seconds)</span>
            <input
              type="number"
              min={0}
              className="flex h-10 w-full max-w-[200px] rounded-lg border border-input bg-background px-3 text-sm"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value || 0))}
            />
          </label>
          <p className="mt-3 text-[13px] text-muted-foreground">
            Configure {"{{link}}"} and the public request form in{" "}
            <Link href={MCTB_ROUTES.setupLinks} className="font-semibold text-primary hover:underline">
              Links & request form
            </Link>
            .
          </p>
        </WizardQuestionBlock>
      </div>
    </MctbSetupSectionLayout>
  );
}
