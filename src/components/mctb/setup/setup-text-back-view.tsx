"use client";

import { Textarea } from "@/components/ui/input";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [defaultLinkUrl, setDefaultLinkUrl] = useState("");
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
      setDefaultLinkUrl(r.defaultLinkUrl || "");
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

  const previewOpener = useMemo(
    () => messageTemplate.replace(/\{\{customer\.firstName\}\}/g, "there").replace(/\{\{business\.name\}\}/g, "Your Business"),
    [messageTemplate],
  );

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
          defaultLinkUrl: defaultLinkUrl.trim() || null,
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

      <div className="ref-card flex flex-wrap items-center justify-between gap-3 p-4 text-[13px]">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ref-card space-y-4 p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Recovery opener</h2>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-foreground">Message template</span>
            <Textarea
              className="min-h-[120px]"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-foreground">Delay before sending (seconds)</span>
            <input
              type="number"
              min={0}
              className="flex h-10 w-full max-w-[200px] rounded-lg border border-input bg-background px-3 text-sm"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value || 0))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-foreground">Default link URL</span>
            <input
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              placeholder="https://example.com/contact"
              value={defaultLinkUrl}
              onChange={(e) => setDefaultLinkUrl(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">Use {"{{link}}"} in your template.</span>
          </label>
        </div>

        <div className="ref-card space-y-3 p-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Preview</h2>
          <p className="text-[12px] text-muted-foreground">Canonical send order — production uses the same renderer.</p>
          {isPress1 ? (
            <div className="space-y-3">
              <div className="rounded-2xl rounded-tl-md bg-gray-100 px-4 py-3 text-[13px] text-gray-800">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  System compliance confirmation (locked)
                </p>
                {COMPLIANCE_PREVIEW}
              </div>
              <div className="rounded-2xl rounded-tl-md bg-indigo-600 px-4 py-3 text-[13px] text-white">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                  Recovery opener
                </p>
                {previewOpener || "Your recovery message preview…"}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl rounded-tl-md bg-indigo-600 px-4 py-3 text-[13px] text-white">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                Recovery message
              </p>
              {previewOpener || "Your recovery message preview…"}
            </div>
          )}
        </div>
      </div>
    </MctbSetupSectionLayout>
  );
}
