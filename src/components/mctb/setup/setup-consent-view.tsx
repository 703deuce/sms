"use client";

import { MctbConsentPromptEditor } from "@/components/mctb/consent-prompt-editor";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbConsentModeCards } from "@/components/mctb/wizard/mctb-wizard-ui";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { FileCheck, ShieldCheck } from "lucide-react";
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

  const uiMode = consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "press_1";

  if (loading) {
    return (
      <div className="mctb-page voice-theme">
        <div className="mctb-page-inner">
          <div className="voice-card p-12 text-center text-sm text-muted-foreground">Loading…</div>
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

      <div className="voice-card p-4 sm:p-6">
        <MctbConsentModeCards
          value={uiMode}
          onChange={(mode) =>
            setConsentMode(mode === "existing_consent" ? MCTB_CONSENT_MODE_EXISTING : MCTB_CONSENT_MODE_VERIFIED)
          }
          attested={existingConsentAttested}
          onAttestedChange={setExistingConsentAttested}
          options={[
            {
              id: "press_1",
              title: "Ask callers to press 1",
              subtitle: "Platform-captured consent via voice disclosure + DTMF 1.",
              audience: "Default for most businesses — strongest evidence per call.",
              badge: "Recommended",
              icon: ShieldCheck,
              nextSteps: [
                "Caller hears your Press-1 disclosure.",
                "Pressing 1 records consent for that call.",
                "Compliance SMS, then your recovery opener.",
              ],
            },
            {
              id: "existing_consent",
              title: "Use permission my business already has",
              subtitle: "Attestation-based — no Press 1 on the call.",
              audience: "Only when you already hold compliant permission for this texting use case.",
              icon: FileCheck,
              nextSteps: [
                "No voice consent prompt on missed calls.",
                "Eligibility engine must still pass before send.",
                "You maintain proof of existing permission.",
              ],
            },
          ]}
        />
      </div>

      {consentMode === MCTB_CONSENT_MODE_VERIFIED ? (
        <div className="voice-card p-5">
          <MctbConsentPromptEditor phoneNumberId={phoneNumberId} />
        </div>
      ) : null}

      <div className="voice-card space-y-2 p-5 text-[12px] text-muted-foreground">
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
