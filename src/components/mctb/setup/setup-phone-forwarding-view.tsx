"use client";

import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-phone.css";
import {
  formatCarrierStep,
  getCarrierGuide,
  MCTB_CARRIER_GUIDES,
} from "@/lib/mctb/onboarding/carriers";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  buildDialCodeCopyText,
  clampRingSeconds,
  connectionStatusLabel,
  displayPhone,
  formatCompactWhen,
  isPlausibleUsPhoneInput,
  normalizeBusinessLineInput,
  resolveConnectionUiStatus,
  RING_PRESETS,
  shouldShowVoicemailTimingWarning,
  snapshotsEqual,
  type ForwardingVerificationUi,
  type PhoneForwardingSnapshot,
} from "@/lib/mctb/setup-phone-forwarding-model";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Phone,
  PhoneForwarded,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MctbNumberDrawerHost,
  useMctbNumberDrawerEvents,
  type MctbNumberDrawerMode,
} from "@/components/mctb/numbers/mctb-number-drawer-host";

type PhoneOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  messagingStatus?: { approved: boolean; label: string };
};

function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  }, []);
  return { copiedKey, copy };
}

export function MctbSetupPhoneForwardingView() {
  const searchParams = useSearchParams();
  const [drawerMode, setDrawerMode] = useState<MctbNumberDrawerMode>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneOption[]>([]);
  const [businessLineE164, setBusinessLineE164] = useState("");
  const [productionForwardE164, setProductionForwardE164] = useState<string | null>(null);
  const [messagingReady, setMessagingReady] = useState(false);
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
  const [forwardRingSeconds, setForwardRingSeconds] = useState(15);
  const [ringCustom, setRingCustom] = useState(false);
  const [verification, setVerification] = useState<ForwardingVerificationUi>(null);
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [businessLineError, setBusinessLineError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<PhoneForwardingSnapshot | null>(null);
  const verifySectionRef = useRef<HTMLDivElement>(null);
  const { copiedKey, copy } = useCopyFeedback();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [setupRes, onboardRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
      ]);
      const setupJson = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupJson.error || "Failed to load setup");

      const d = setupJson.data;
      const line = d.businessLineE164 || d.adminTest?.businessLineE164 || "";

      let ring = 15;
      let carrierValue: MctbForwardingCarrier = "verizon";
      let verif: ForwardingVerificationUi = null;

      if (onboardRes.ok) {
        const ob = await onboardRes.json();
        if (ob.state?.forwardingCarrier) {
          carrierValue = ob.state.forwardingCarrier;
        }
        if (ob.state?.forwardingRingSeconds != null) {
          ring = clampRingSeconds(ob.state.forwardingRingSeconds);
        }
        verif = ob.forwardingVerification
          ? {
              testStarted: Boolean(ob.forwardingVerification.testStarted),
              callDetected: Boolean(ob.forwardingVerification.callDetected),
              verified: Boolean(ob.forwardingVerification.verified),
              detectedAt: ob.forwardingVerification.detectedAt || null,
              path: ob.forwardingVerification.path || null,
            }
          : null;
      }

      const pid = d.runtime.phoneNumberId as string | null;
      setPhoneNumberId(pid);
      setPhoneNumbers(d.phoneNumbers || []);
      setBusinessLineE164(line ? formatMctbPhoneLabel(line) : "");
      setProductionForwardE164(d.productionForwardTargetE164 || null);
      setMessagingReady(Boolean(d.compliance?.messagingReady));
      setPaused(Boolean(d.schedule?.paused));
      setPauseKind(d.schedule?.pauseKind ?? null);
      setPauseUntil(d.schedule?.pauseUntil ?? null);
      setCarrier(carrierValue);
      setForwardRingSeconds(ring);
      setRingCustom(!RING_PRESETS.includes(ring as 10 | 15 | 20));
      setVerification(verif);

      setBaseline({
        phoneNumberId: pid,
        businessLineE164: line ? formatMctbPhoneLabel(line) : "",
        carrier: carrierValue,
        forwardRingSeconds: ring,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useMctbNumberDrawerEvents(setDrawerMode);

  useEffect(() => {
    const open = searchParams.get("open");
    if (open === "manage" || open === "add" || open === "verify") {
      setDrawerMode(open);
    }
  }, [searchParams]);

  const selected = useMemo(
    () => phoneNumbers.find((n) => n.id === phoneNumberId) || null,
    [phoneNumbers, phoneNumberId],
  );

  const forwardTarget = selected?.e164 || productionForwardE164;
  const carrierGuide = useMemo(() => getCarrierGuide(carrier), [carrier]);

  const currentSnapshot: PhoneForwardingSnapshot = useMemo(
    () => ({
      phoneNumberId,
      businessLineE164,
      carrier,
      forwardRingSeconds,
    }),
    [phoneNumberId, businessLineE164, carrier, forwardRingSeconds],
  );

  const dirty = baseline ? !snapshotsEqual(baseline, currentSnapshot) : false;

  const connectionStatus = resolveConnectionUiStatus(
    verification,
    Boolean(businessLineE164.trim()),
    Boolean(forwardTarget),
  );

  const lastVerifiedLabel = formatCompactWhen(
    verification?.verified ? verification.detectedAt : null,
  );

  const voicemailWarn = shouldShowVoicemailTimingWarning(carrier, forwardRingSeconds);

  const pollVerification = useCallback(async () => {
    const res = await fetch("/api/mctb/onboarding", { cache: "no-store" });
    if (!res.ok) return;
    const ob = await res.json();
    if (ob.forwardingVerification) {
      setVerification({
        testStarted: Boolean(ob.forwardingVerification.testStarted),
        callDetected: Boolean(ob.forwardingVerification.callDetected),
        verified: Boolean(ob.forwardingVerification.verified),
        detectedAt: ob.forwardingVerification.detectedAt || null,
        path: ob.forwardingVerification.path || null,
      });
      if (ob.forwardingVerification.verified) setTestRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!verification?.testStarted || verification.verified) return;
    const id = window.setInterval(() => void pollVerification(), 3000);
    return () => window.clearInterval(id);
  }, [verification?.testStarted, verification?.verified, pollVerification]);

  function onCarrierPick(next: MctbForwardingCarrier) {
    if (next === carrier) return;
    if (verification?.verified) {
      const ok = window.confirm(
        "Changing carrier updates forwarding instructions. Your existing forwarding may still work, but you should re-verify after changing carriers.",
      );
      if (!ok) return;
    }
    setCarrier(next);
    setSaved(false);
  }

  function onRingPreset(sec: number) {
    setRingCustom(false);
    setForwardRingSeconds(sec);
    setSaved(false);
  }

  async function save() {
    setBusinessLineError(null);
    setError(null);
    setSaved(false);

    const line = businessLineE164.trim();
    if (line && !isPlausibleUsPhoneInput(line)) {
      setBusinessLineError("Enter a valid US business phone number.");
      return;
    }

    const normalized = line ? normalizeBusinessLineInput(line) : "";
    if (ringCustom && (forwardRingSeconds < 10 || forwardRingSeconds > 30)) {
      setError("Ring timing must be between 10 and 30 seconds.");
      return;
    }

    setSaving(true);
    try {
      const setupRes = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          businessLineE164: normalized || null,
          activate: false,
        }),
      });
      const setupJson = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupJson.error || "Save failed");

      const onboardRes = await fetch("/api/mctb/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          forwardingCarrier: carrier,
          businessNumberE164: normalized || undefined,
          forwardingRingSeconds: forwardRingSeconds,
        }),
      });
      const onboardJson = await onboardRes.json();
      if (!onboardRes.ok) throw new Error(onboardJson.error || "Failed to save forwarding settings");

      if (onboardJson.forwardingVerification) {
        setVerification({
          testStarted: Boolean(onboardJson.forwardingVerification.testStarted),
          callDetected: Boolean(onboardJson.forwardingVerification.callDetected),
          verified: Boolean(onboardJson.forwardingVerification.verified),
          detectedAt: onboardJson.forwardingVerification.detectedAt || null,
          path: onboardJson.forwardingVerification.path || null,
        });
      }

      setBaseline({
        phoneNumberId,
        businessLineE164: normalized || line,
        carrier,
        forwardRingSeconds,
      });
      setSaved(true);
      if (normalized) setBusinessLineE164(formatMctbPhoneLabel(normalized));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runForwardingTest() {
    setTestError(null);
    setTestRunning(true);
    try {
      if (dirty) await save();
      const res = await fetch("/api/mctb/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start_forwarding_test" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start forwarding test");
      setVerification({
        testStarted: true,
        callDetected: false,
        verified: false,
        detectedAt: null,
      });
      void pollVerification();
    } catch (err) {
      setTestRunning(false);
      setTestError(err instanceof Error ? err.message : "Test failed to start");
    }
  }

  function finishInstructions() {
    setInstructionsOpen(false);
    verifySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const dialCode =
    forwardTarget ? buildDialCodeCopyText(carrierGuide, forwardTarget, forwardRingSeconds) : null;

  const instructionSteps = useMemo(() => {
    if (!forwardTarget) return [];
    return carrierGuide.steps.map((s) =>
      formatCarrierStep(s, {
        transovoE164: forwardTarget,
        forwardRingSeconds,
      }),
    );
  }, [carrierGuide, forwardTarget, forwardRingSeconds]);

  const senderSecondary = selected
    ? selected.messagingStatus?.approved
      ? "Text-back sender · Ready"
      : selected.messagingStatus?.label
        ? `Text-back sender · ${selected.messagingStatus.label}`
        : messagingReady
          ? "Text-back sender · Ready"
          : "Verification pending"
    : "Assign a forwarding destination";

  const headerAction = (
    <div className="flex shrink-0 items-center gap-3">
      {saved && !saving && !dirty ? (
        <span className="mctb-phone-save-meta">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </span>
      ) : null}
      <button
        type="button"
        className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn"
        style={{ minWidth: "7.5rem" }}
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  const shellProps = {
    title: "Setup",
    description:
      "Configure missed-call recovery, forwarding, consent, voicemail, and operational controls.",
    showSectionNav: true,
  };

  if (loading) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-phone-page">
          <div className="mctb-setup-skel h-20 mb-4" />
          <div className="mctb-setup-skel h-14 mb-4" />
          <div className="mctb-setup-skel h-96" />
        </div>
      </MctbSetupShell>
    );
  }

  return (
    <MctbSetupShell {...shellProps}>
      <div className="mctb-phone-page">
        <header className="mctb-phone-section-header">
          <div className="mctb-phone-section-header__left">
            <div className="mctb-phone-section-header__icon">
              <PhoneForwarded className="h-4 w-4" strokeWidth={1.85} aria-hidden />
            </div>
            <div>
              <h2 className="mctb-phone-section-header__title">Phone &amp; Forwarding</h2>
              <p className="mctb-phone-section-header__desc">
                Connect your public business line and forward unanswered calls to Transovo.
              </p>
            </div>
          </div>
          {headerAction}
        </header>

        {error ? (
          <div
            className="mb-3 rounded-lg border border-[#f0d0d0] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#9b2c2c]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {paused ? (
          <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
        ) : null}

        <div className="mctb-phone-status-strip" aria-label="Connection overview">
          <div className="mctb-phone-status-strip__cell">
            <span className="mctb-phone-status-strip__label">
              <Phone className="inline h-3 w-3 mr-1 opacity-60" aria-hidden />
              Business line
            </span>
            <span className="mctb-phone-status-strip__value mctb-phone-status-strip__value--mono">
              {displayPhone(businessLineE164)}
            </span>
          </div>
          <div className="mctb-phone-status-strip__cell">
            <span className="mctb-phone-status-strip__label">Forwarding to</span>
            <span className="mctb-phone-status-strip__value mctb-phone-status-strip__value--mono">
              {displayPhone(forwardTarget)}
            </span>
          </div>
          <div className="mctb-phone-status-strip__cell">
            <span className="mctb-phone-status-strip__label">Carrier</span>
            <span className="mctb-phone-status-strip__value">{carrierGuide.label}</span>
          </div>
          <div className="mctb-phone-status-strip__cell">
            <span className="mctb-phone-status-strip__label">Connection</span>
            <span
              className={`mctb-phone-status-strip__value ${
                connectionStatus === "verified"
                  ? "text-[#1f6b42]"
                  : connectionStatus === "failed"
                    ? "text-[#9b2c2c]"
                    : connectionStatus === "pending"
                      ? "text-[#8a5a12]"
                      : ""
              }`}
            >
              {connectionStatusLabel(connectionStatus)}
            </span>
          </div>
        </div>

        <div className="mctb-phone-grid">
          <div className="mctb-phone-main">
            <section className="mctb-phone-module" aria-labelledby="mctb-phone-business">
              <div className="mctb-phone-module__head">
                <div className="mctb-phone-module__icon">
                  <Phone className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-phone-business" className="mctb-phone-module__title">
                    Public business number
                  </h3>
                  <p className="mctb-phone-module__desc">The number customers already call.</p>
                </div>
              </div>
              <label className="mctb-phone-field-label" htmlFor="mctb-business-line">
                Business line
              </label>
              <div className="mctb-phone-input-row">
                <input
                  id="mctb-business-line"
                  className={`mctb-phone-input ${businessLineError ? "mctb-phone-input--error" : ""}`}
                  value={businessLineE164}
                  onChange={(e) => {
                    setBusinessLineE164(e.target.value);
                    setBusinessLineError(null);
                    setSaved(false);
                  }}
                  placeholder="(555) 555-0188"
                  aria-invalid={Boolean(businessLineError)}
                  aria-describedby="mctb-business-line-help"
                />
                {verification?.verified ? (
                  <span className="mctb-phone-chip mctb-phone-chip--ok">Verified</span>
                ) : businessLineE164.trim() ? (
                  <span className="mctb-phone-chip mctb-phone-chip--muted">Not verified</span>
                ) : null}
              </div>
              {businessLineError ? (
                <p className="mt-1 text-[12px] text-[#9b2c2c]" role="alert">{businessLineError}</p>
              ) : null}
              <p id="mctb-business-line-help" className="mctb-phone-helper">
                This is the number customers continue to call. You do not need to port it to Transovo.
              </p>
            </section>

            <section className="mctb-phone-module" aria-labelledby="mctb-phone-dest">
              <div className="mctb-phone-module__head">
                <div className="mctb-phone-module__icon">
                  <PhoneForwarded className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-phone-dest" className="mctb-phone-module__title">
                    Forwarding destination
                  </h3>
                  <p className="mctb-phone-module__desc">
                    Unanswered calls from your business line forward here.
                  </p>
                </div>
              </div>
              <label className="mctb-phone-field-label" htmlFor="mctb-forward-dest">
                Transovo number
              </label>
              {forwardTarget ? (
                <div className="mctb-phone-dest-summary">
                  <p className="mctb-phone-dest-summary__number">{displayPhone(forwardTarget)}</p>
                  <p className="mctb-phone-helper mt-1">{senderSecondary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="mctb-phone-chip mctb-phone-chip--muted">Voice · Ready</span>
                    <button
                      type="button"
                      className={`mctb-phone-chip ${selected?.messagingStatus?.approved || messagingReady ? "mctb-phone-chip--ok" : "mctb-phone-chip--warn"}`}
                      onClick={() => setDrawerMode("verify")}
                    >
                      Messaging ·{" "}
                      {selected?.messagingStatus?.approved || messagingReady
                        ? "Ready"
                        : selected?.messagingStatus?.label || "Pending"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#626872]">No MCTB number yet.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn"
                  onClick={() => setDrawerMode(forwardTarget ? "manage" : "add")}
                >
                  {forwardTarget ? "Manage number" : "Choose number"}
                </button>
                {phoneNumbers.length > 1 ? (
                  <select
                    id="mctb-forward-dest"
                    className="mctb-phone-select max-w-[14rem]"
                    value={phoneNumberId || ""}
                    onChange={(e) => {
                      setPhoneNumberId(e.target.value || null);
                      setSaved(false);
                    }}
                    aria-label="Switch active MCTB number"
                  >
                    {phoneNumbers.map((n) => (
                      <option key={n.id} value={n.id}>
                        {displayPhone(n.e164)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </section>

            <section className="mctb-phone-module" aria-labelledby="mctb-phone-carrier">
              <div className="mctb-phone-module__head">
                <div className="mctb-phone-module__icon">
                  <Radio className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-phone-carrier" className="mctb-phone-module__title">
                    2. Phone service provider
                  </h3>
                  <p className="mctb-phone-module__desc">
                    Choose the carrier that services your public business number so we can show the
                    correct forwarding instructions.
                  </p>
                </div>
              </div>
              <div className="mctb-phone-carrier-grid" role="group" aria-label="Phone service provider">
                {MCTB_CARRIER_GUIDES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mctb-phone-carrier-opt"
                    aria-pressed={carrier === c.id}
                    onClick={() => onCarrierPick(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="mctb-phone-module" aria-labelledby="mctb-phone-forward-setup">
              <div className="mctb-phone-module__head">
                <div>
                  <h3 id="mctb-phone-forward-setup" className="mctb-phone-module__title">
                    3. Set up conditional forwarding
                  </h3>
                  <p className="mctb-phone-module__desc">
                    Current status:{" "}
                    <strong>{verification?.verified ? "Verified" : "Not verified"}</strong>
                  </p>
                </div>
              </div>
              <p className="text-[13px] text-[#3a3f47] mb-3">
                Forward unanswered calls from your business number to:{" "}
                <strong className="font-semibold">{displayPhone(forwardTarget)}</strong>
              </p>
              <div className="mctb-phone-actions">
                <button
                  type="button"
                  className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn"
                  disabled={!forwardTarget}
                  onClick={() => setInstructionsOpen(true)}
                >
                  View instructions
                </button>
                <button
                  type="button"
                  className="mctb-setup-btn mctb-setup-btn--outline mctb-phone-btn"
                  onClick={finishInstructions}
                >
                  I already set this up
                </button>
              </div>
            </section>

            <section className="mctb-phone-module" aria-labelledby="mctb-phone-ring">
              <div className="mctb-phone-module__head">
                <div>
                  <h3 id="mctb-phone-ring" className="mctb-phone-module__title">
                    4. Ring timing
                  </h3>
                  <p className="mctb-phone-module__desc">
                    Choose how long your business phone rings before the call is forwarded to
                    Transovo.
                  </p>
                </div>
              </div>
              <span className="mctb-phone-field-label">Ring before forwarding</span>
              <div className="mctb-phone-seg" role="group" aria-label="Ring before forwarding">
                {RING_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className="mctb-phone-seg-btn"
                    aria-pressed={!ringCustom && forwardRingSeconds === sec}
                    onClick={() => onRingPreset(sec)}
                  >
                    {sec} sec
                    {sec === carrierGuide.capabilities.recommendedForwardRingSeconds ? (
                      <span className="mctb-phone-seg-badge">Recommended</span>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  className="mctb-phone-seg-btn"
                  aria-pressed={ringCustom}
                  onClick={() => setRingCustom(true)}
                >
                  Custom
                </button>
              </div>
              {ringCustom ? (
                <div className="mt-3">
                  <label className="mctb-phone-field-label" htmlFor="mctb-ring-custom">
                    Custom seconds
                  </label>
                  <input
                    id="mctb-ring-custom"
                    type="number"
                    min={10}
                    max={30}
                    className="mctb-phone-input"
                    style={{ maxWidth: "6rem" }}
                    value={forwardRingSeconds}
                    onChange={(e) => {
                      setForwardRingSeconds(clampRingSeconds(Number(e.target.value) || 15));
                      setSaved(false);
                    }}
                  />
                </div>
              ) : null}
              <p className="mctb-phone-helper">
                Your carrier voicemail must answer later than this forwarding time.
              </p>
              {voicemailWarn ? (
                <p className="mctb-phone-inline-warn" role="status">
                  <span aria-hidden>⚠</span>
                  Your current voicemail timing may answer before forwarding occurs.
                </p>
              ) : null}
            </section>

            <section
              ref={verifySectionRef}
              className="mctb-phone-module mctb-phone-module--emphasis"
              aria-labelledby="mctb-phone-verify"
            >
              <div className="mctb-phone-module__head">
                <div>
                  <h3 id="mctb-phone-verify" className="mctb-phone-module__title">
                    5. Verify forwarding
                  </h3>
                  <p className="mctb-phone-module__desc">
                    Place a test call to confirm unanswered calls reach Transovo correctly.
                  </p>
                </div>
              </div>
              <div className="mctb-phone-verify-grid">
                <div className="text-[13px] text-[#3a3f47] leading-relaxed">
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Call your business number from another phone.</li>
                    <li>Do not answer.</li>
                    <li>Wait for the configured forwarding interval ({forwardRingSeconds} sec).</li>
                  </ol>
                </div>
                <div className="mctb-phone-test-panel">
                  {verification?.verified ? (
                    <>
                      <div className="mctb-phone-test-panel__title text-[#1f6b42]">
                        ✓ Forwarding verified
                      </div>
                      {lastVerifiedLabel ? (
                        <p className="mctb-phone-test-panel__sub">Last verified {lastVerifiedLabel}</p>
                      ) : null}
                      <button
                        type="button"
                        className="mctb-setup-btn mctb-setup-btn--outline mctb-phone-btn mt-3"
                        onClick={() => void runForwardingTest()}
                      >
                        Run again
                      </button>
                    </>
                  ) : testRunning || (verification?.testStarted && !verification.verified) ? (
                    <>
                      <div className="mctb-phone-test-panel__title">
                        <span className="mctb-phone-spinner" aria-hidden />
                        Listening for forwarded call…
                      </div>
                      <p className="mctb-phone-test-panel__sub">
                        We detect when your unanswered call reaches Transovo.
                      </p>
                    </>
                  ) : connectionStatus === "failed" ? (
                    <>
                      <div className="mctb-phone-test-panel__title text-[#9b2c2c]">
                        Could not confirm forwarding
                      </div>
                      <p className="mctb-phone-test-panel__sub">
                        {testError || "The test call did not match your business line forwarding."}
                      </p>
                      <div className="mctb-phone-actions mt-3">
                        <button
                          type="button"
                          className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn"
                          onClick={() => void runForwardingTest()}
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          className="mctb-setup-btn mctb-setup-btn--outline mctb-phone-btn"
                          onClick={() => setInstructionsOpen(true)}
                        >
                          View instructions
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mctb-phone-test-panel__title">Ready to test</div>
                      <p className="mctb-phone-test-panel__sub">
                        Save your settings, then run a live forwarding check.
                      </p>
                      {testError ? (
                        <p className="mt-2 text-[12px] text-[#9b2c2c]" role="alert">{testError}</p>
                      ) : null}
                      <button
                        type="button"
                        className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn mt-3"
                        disabled={!businessLineE164.trim() || !forwardTarget}
                        onClick={() => void runForwardingTest()}
                      >
                        Run forwarding test
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="mctb-phone-rail" aria-label="Connection details">
            <div className="mctb-phone-rail-panel">
              <h4 className="mctb-phone-rail-panel__title">Connection summary</h4>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Business line</span>
                <span className="mctb-phone-rail-row__value">
                  {displayPhone(businessLineE164)}
                  <br />
                  <span
                    className={`mctb-phone-chip mctb-phone-chip--${
                      verification?.verified ? "ok" : "warn"
                    }`}
                    style={{ marginTop: 4 }}
                  >
                    {verification?.verified ? "Verified" : "Pending"}
                  </span>
                </span>
              </div>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Carrier</span>
                <span className="mctb-phone-rail-row__value">{carrierGuide.label}</span>
              </div>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Forwarding destination</span>
                <span className="mctb-phone-rail-row__value">
                  {displayPhone(forwardTarget)}
                  <br />
                  <span className="mctb-phone-chip mctb-phone-chip--muted" style={{ marginTop: 4 }}>
                    {messagingReady ? "Ready" : "Pending"}
                  </span>
                </span>
              </div>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Ring time</span>
                <span className="mctb-phone-rail-row__value">{forwardRingSeconds} sec</span>
              </div>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Connection</span>
                <span className="mctb-phone-rail-row__value">
                  {connectionStatusLabel(connectionStatus)}
                </span>
              </div>
              <div className="mctb-phone-rail-row">
                <span className="mctb-phone-rail-row__label">Last tested</span>
                <span className="mctb-phone-rail-row__value">
                  {lastVerifiedLabel || "—"}
                </span>
              </div>
            </div>

            <div className="mctb-phone-rail-panel">
              <h4 className="mctb-phone-rail-panel__title">What happens when a call is missed</h4>
              <div className="mctb-phone-flow">
                <div className="mctb-phone-flow__step">Customer calls</div>
                <div className="mctb-phone-flow__arrow" aria-hidden>↓</div>
                <div className="mctb-phone-flow__step">
                  Business line rings
                  <span className="mctb-phone-flow__meta">{forwardRingSeconds} sec</span>
                </div>
                <div className="mctb-phone-flow__arrow" aria-hidden>↓</div>
                <div className="mctb-phone-flow__step">Unanswered call forwards</div>
                <div className="mctb-phone-flow__arrow" aria-hidden>↓</div>
                <div className="mctb-phone-flow__step">Transovo receives call</div>
                <div className="mctb-phone-flow__arrow" aria-hidden>↓</div>
                <div className="mctb-phone-flow__step">Consent / voicemail logic continues</div>
              </div>
            </div>

            <div className="mctb-phone-rail-panel">
              <h4 className="mctb-phone-rail-panel__title">Need help?</h4>
              <button
                type="button"
                className="mctb-phone-help-btn"
                onClick={() => setInstructionsOpen(true)}
              >
                View carrier instructions
                <ChevronRight className="h-4 w-4 shrink-0 text-[#8b939e]" aria-hidden />
              </button>
              <button
                type="button"
                className="mctb-phone-help-btn"
                onClick={() => void runForwardingTest()}
              >
                Run connection test
                <ChevronRight className="h-4 w-4 shrink-0 text-[#8b939e]" aria-hidden />
              </button>
              <Link href={MCTB_ROUTES.setupTest} className="mctb-phone-help-btn">
                Troubleshooting
                <ArrowRight className="h-4 w-4 shrink-0 text-[#8b939e]" aria-hidden />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {instructionsOpen ? (
        <>
          <div
            className="mctb-phone-drawer-backdrop"
            onClick={() => setInstructionsOpen(false)}
            aria-hidden
          />
          <div
            className="mctb-phone-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mctb-forward-drawer-title"
          >
            <div className="mctb-phone-drawer__head">
              <h2 id="mctb-forward-drawer-title" className="mctb-phone-drawer__title">
                Set up forwarding
              </h2>
              <p className="text-[13px] font-semibold text-[#1b1e23] mt-1">{carrierGuide.label}</p>
              <p className="mctb-phone-drawer__sub">
                Forward unanswered calls to Transovo while keeping your existing business number.
              </p>
            </div>
            <div className="mctb-phone-dest-box">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8b939e]">
                  Forward calls to
                </div>
                <div className="text-[15px] font-semibold text-[#1b1e23]">
                  {displayPhone(forwardTarget)}
                </div>
              </div>
              {forwardTarget ? (
                <button
                  type="button"
                  className="mctb-phone-copy-btn"
                  onClick={() => void copy("dest", forwardTarget)}
                >
                  {copiedKey === "dest" ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
            <ol className="mctb-phone-steps">
              {instructionSteps.map((text, i) => (
                <li key={i} className="mctb-phone-step">
                  <span className="mctb-phone-step__num">{i + 1}</span>
                  <span>
                    {text}
                    {i === 1 && dialCode ? (
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="rounded bg-[#f0f2f4] px-2 py-1 text-[12px]">{dialCode}</code>
                        <button
                          type="button"
                          className="mctb-phone-copy-btn inline-flex items-center gap-1"
                          onClick={() => void copy("dial", dialCode)}
                        >
                          <Copy className="h-3 w-3" aria-hidden />
                          {copiedKey === "dial" ? "Copied" : "Copy"}
                        </button>
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            {carrierGuide.capabilities.alternateSetupRequired ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
                {carrierGuide.capabilities.alternateSetupNote}
              </p>
            ) : null}
            <div className="mctb-phone-drawer__footer">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline mctb-phone-btn"
                onClick={() => setInstructionsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary mctb-phone-btn"
                onClick={finishInstructions}
              >
                I finished setup
              </button>
            </div>
          </div>
        </>
      ) : null}

      <MctbNumberDrawerHost
        open={drawerMode}
        onClose={() => setDrawerMode(null)}
        onOpenMode={setDrawerMode}
        onNumbersChanged={() => void load()}
      />
    </MctbSetupShell>
  );
}
