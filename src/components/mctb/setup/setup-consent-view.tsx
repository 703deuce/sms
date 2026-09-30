"use client";

import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-consent.css";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { existingConsentIneligibleReason } from "@/lib/mctb/setup-consent-eligibility";
import {
  CALL_FLOW_EXISTING,
  CALL_FLOW_PRESS_1,
  consentPageHealth,
  consentSnapshotsEqual,
  evidenceLabel,
  EXISTING_CONSENT_CALLER_FLOW,
  formatAttestationWhen,
  methodLabel,
  PRESS_1_CALLER_FLOW,
  recoveryActiveLabel,
  senderStatusLabel,
  textBackConfiguredLabel,
  type ConsentSnapshot,
} from "@/lib/mctb/setup-consent-model";
import {
  Check,
  ChevronRight,
  FileCheck,
  MessageSquare,
  Phone,
  Play,
  RefreshCw,
  Shield,
  ShieldCheck,
  Voicemail,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

type PhoneOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  messagingStatus?: { approved: boolean; label: string };
};

type ConsentAttestationMeta = {
  attestedAt: string;
  attestedByUserId: string;
  version: string;
} | null;

type ConsentPromptSlice = {
  scriptText: string;
  playbackUrl: string | null;
};

export function MctbSetupConsentView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneOption[]>([]);
  const [draftMode, setDraftMode] = useState<MctbConsentMode>(MCTB_CONSENT_MODE_VERIFIED);
  const [baseline, setBaseline] = useState<ConsentSnapshot | null>(null);
  const [savedAttestation, setSavedAttestation] = useState<ConsentAttestationMeta>(null);
  const [messagingReady, setMessagingReady] = useState(false);
  const [existingConsentEligible, setExistingConsentEligible] = useState(false);
  const [platformSenderActive, setPlatformSenderActive] = useState(false);
  const [mctbProductActive, setMctbProductActive] = useState(true);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [paused, setPaused] = useState(false);
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  const [consentPrompt, setConsentPrompt] = useState<ConsentPromptSlice | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [existingModalOpen, setExistingModalOpen] = useState(false);
  const [press1ModalOpen, setPress1ModalOpen] = useState(false);
  const [modalAttestChecked, setModalAttestChecked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadPrompt = useCallback(async () => {
    setPromptLoading(true);
    try {
      const res = await fetch("/api/mctb/consent-prompt", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load disclosure");
      const cfg = json.data?.config;
      setConsentPrompt({
        scriptText: String(cfg?.scriptText || ""),
        playbackUrl: json.data?.playbackUrl || null,
      });
    } catch {
      setConsentPrompt(null);
    } finally {
      setPromptLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      const data = json.data;
      const mode = (data.consentMode as MctbConsentMode) || MCTB_CONSENT_MODE_VERIFIED;
      setPhoneNumberId(data.runtime?.phoneNumberId ?? null);
      setPhoneNumbers(data.phoneNumbers || []);
      setDraftMode(mode);
      setBaseline({ mode });
      setMessagingReady(Boolean(data.compliance?.messagingReady));
      setPlatformSenderActive(Boolean(data.capabilities?.platformSenderActive));
      setMctbProductActive(Boolean(data.capabilities?.pressOneConsent ?? true));
      setExistingConsentEligible(Boolean(data.consentMeta?.existingConsentEligible));
      setSavedAttestation(data.consentMeta?.existingConsentAttestation ?? null);
      setRecoveryEnabled(Boolean(data.runtime?.enabled));
      setMessageTemplate(String(data.runtime?.messageTemplate || data.solution?.config?.firstMessage || ""));
      setPaused(Boolean(data.schedule?.paused));
      setPauseKind(data.schedule?.pauseKind ?? null);
      setPauseUntil(data.schedule?.pauseUntil ?? null);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (draftMode === MCTB_CONSENT_MODE_VERIFIED) {
      void loadPrompt();
    }
  }, [draftMode, loadPrompt]);

  const currentSnapshot = useMemo(() => ({ mode: draftMode }), [draftMode]);
  const dirty = baseline ? !consentSnapshotsEqual(baseline, currentSnapshot) : false;

  const selectedPhone = useMemo(
    () => phoneNumbers.find((p) => p.id === phoneNumberId) || phoneNumbers[0] || null,
    [phoneNumbers, phoneNumberId],
  );

  const senderLabel = selectedPhone
    ? formatMctbPhoneLabel(selectedPhone.e164, selectedPhone.friendlyName)
    : "MCTB line";

  const health = consentPageHealth({
    mode: baseline?.mode ?? draftMode,
    existingConsentEligible:
      baseline?.mode === MCTB_CONSENT_MODE_EXISTING ? existingConsentEligible : true,
  });

  const ineligibleCopy = existingConsentEligible
    ? null
    : existingConsentIneligibleReason(messagingReady, platformSenderActive, mctbProductActive);
  const callerFlow =
    draftMode === MCTB_CONSENT_MODE_VERIFIED ? PRESS_1_CALLER_FLOW : EXISTING_CONSENT_CALLER_FLOW;
  const miniFlow =
    draftMode === MCTB_CONSENT_MODE_VERIFIED ? CALL_FLOW_PRESS_1 : CALL_FLOW_EXISTING;

  function requestMode(mode: MctbConsentMode) {
    if (mode === draftMode) return;
    if (mode === MCTB_CONSENT_MODE_EXISTING) {
      if (!existingConsentEligible) return;
      if (baseline?.mode === MCTB_CONSENT_MODE_EXISTING) {
        setDraftMode(mode);
        setSaved(false);
        return;
      }
      setModalAttestChecked(false);
      setExistingModalOpen(true);
      return;
    }
    if (baseline?.mode === MCTB_CONSENT_MODE_EXISTING) {
      setPress1ModalOpen(true);
      return;
    }
    setDraftMode(MCTB_CONSENT_MODE_VERIFIED);
    setSaved(false);
  }

  function confirmExistingMode() {
    if (!modalAttestChecked) return;
    setDraftMode(MCTB_CONSENT_MODE_EXISTING);
    setExistingModalOpen(false);
    setSaved(false);
  }

  function confirmPress1Mode() {
    setDraftMode(MCTB_CONSENT_MODE_VERIFIED);
    setPress1ModalOpen(false);
    setSaved(false);
  }

  async function save() {
    if (!phoneNumberId) {
      setError("Select an MCTB forwarding number on Phone & Forwarding before saving consent.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          consentMode: draftMode,
          existingConsentAttested:
            draftMode === MCTB_CONSENT_MODE_EXISTING
              ? Boolean(savedAttestation || modalAttestChecked)
              : undefined,
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

  function playDisclosure() {
    const url = consentPrompt?.playbackUrl;
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
    } else {
      audioRef.current.src = url;
    }
    void audioRef.current.play();
  }

  const shellProps = {
    title: "Setup",
    description:
      "Configure missed-call recovery, forwarding, consent, voicemail, and operational controls.",
  };

  const headerAction = (
    <div className="mctb-consent-header-actions">
      {saved && !saving && !dirty ? (
        <span className="mctb-consent-save-meta">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </span>
      ) : null}
      <button
        type="button"
        className="mctb-setup-btn mctb-setup-btn--primary"
        style={{ minWidth: "7.5rem", height: "2.375rem" }}
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-consent-page">
          <div className="mctb-setup-skel h-[4.5rem] mb-3" />
          <div className="mctb-setup-skel h-14 mb-4" />
          <div className="mctb-consent-grid">
            <div className="mctb-setup-skel h-[28rem]" />
            <div className="mctb-setup-skel h-[22rem]" />
          </div>
        </div>
      </MctbSetupShell>
    );
  }

  return (
    <MctbSetupShell {...shellProps}>
      <div className="mctb-consent-page">
        <header className="mctb-consent-section-header">
          <div className="mctb-consent-section-header__left">
            <div className="mctb-consent-section-header__icon" aria-hidden>
              <Shield className="h-[18px] w-[18px]" strokeWidth={1.85} />
            </div>
            <div>
              <h2 className="mctb-consent-section-header__title">Consent</h2>
              <p className="mctb-consent-section-header__desc">
                Choose how permission to text missed callers is established.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] font-medium text-[#8b939e]">
              {health === "configured" ? "Configured" : "Needs attention"}
            </span>
            {headerAction}
          </div>
        </header>

        {paused ? (
          <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
        ) : null}

        {error ? (
          <div
            className="mb-3 rounded-lg border border-[#f0d0d0] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#9b2c2c]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mctb-consent-status-strip" aria-label="Consent summary">
          <div className="mctb-consent-status-strip__cell">
            <span className="mctb-consent-status-strip__label">Status</span>
            <span
              className={`mctb-consent-status-strip__value mctb-consent-status-dot${
                health === "needs_attention" ? " mctb-consent-status-dot--warn" : ""
              }`}
            >
              {health === "configured" ? "Consent configured" : "Review required"}
            </span>
          </div>
          <div className="mctb-consent-status-strip__cell">
            <span className="mctb-consent-status-strip__label">Method</span>
            <span className="mctb-consent-status-strip__value">{methodLabel(draftMode)}</span>
          </div>
          <div className="mctb-consent-status-strip__cell">
            <span className="mctb-consent-status-strip__label">Text-back sender</span>
            <span className="mctb-consent-status-strip__value">{senderLabel}</span>
          </div>
          <div className="mctb-consent-status-strip__cell">
            <span className="mctb-consent-status-strip__label">Evidence</span>
            <span className="mctb-consent-status-strip__value">{evidenceLabel(draftMode)}</span>
          </div>
        </div>

        <div className="mctb-consent-grid">
          <div className="mctb-consent-main">
            <section className="mctb-consent-module" aria-labelledby="consent-mode-heading">
              <div className="mctb-consent-module__head">
                <ShieldCheck className="mctb-consent-module__head-icon h-4 w-4" aria-hidden />
                <div>
                  <h3 id="consent-mode-heading" className="mctb-consent-module__title">
                    How should permission to text missed callers be established?
                  </h3>
                  <p className="mctb-consent-module__sub">
                    Choose the consent method used before automatic recovery texts can be sent. A
                    missed call alone is not consent to text.
                  </p>
                </div>
              </div>

              <div
                className="mctb-consent-mode-row"
                role="radiogroup"
                aria-label="Consent method"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={draftMode === MCTB_CONSENT_MODE_VERIFIED}
                  className={`mctb-consent-mode-card${
                    draftMode === MCTB_CONSENT_MODE_VERIFIED ? " mctb-consent-mode-card--selected" : ""
                  }`}
                  onClick={() => requestMode(MCTB_CONSENT_MODE_VERIFIED)}
                >
                  <span className="mctb-consent-mode-card__icon" aria-hidden>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <p className="mctb-consent-mode-card__title">Ask callers to press 1</p>
                  <p className="mctb-consent-mode-card__body">
                    Transovo asks the caller for permission during the call.
                  </p>
                  <div className="mctb-consent-mode-card__meta">
                    <span className="mctb-consent-badge">Recommended</span>
                    <span className="mctb-consent-badge mctb-consent-badge--neutral">
                      Per-call consent
                    </span>
                    <span className="mctb-consent-badge mctb-consent-badge--neutral">
                      Works with: Transovo MCTB line
                    </span>
                  </div>
                  {draftMode === MCTB_CONSENT_MODE_VERIFIED ? (
                    <Check className="mctb-consent-mode-card__check h-4 w-4" aria-hidden />
                  ) : null}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={draftMode === MCTB_CONSENT_MODE_EXISTING}
                  aria-disabled={!existingConsentEligible}
                  disabled={!existingConsentEligible}
                  className={`mctb-consent-mode-card${
                    draftMode === MCTB_CONSENT_MODE_EXISTING ? " mctb-consent-mode-card--selected" : ""
                  }${!existingConsentEligible ? " mctb-consent-mode-card--disabled" : ""}`}
                  onClick={() => requestMode(MCTB_CONSENT_MODE_EXISTING)}
                >
                  <span className="mctb-consent-mode-card__icon" aria-hidden>
                    <FileCheck className="h-4 w-4" />
                  </span>
                  <p className="mctb-consent-mode-card__title">
                    Use permission my business already has
                  </p>
                  <p className="mctb-consent-mode-card__body">
                    Use this only when the business already has valid permission to text these
                    callers.
                  </p>
                  <div className="mctb-consent-mode-card__meta">
                    <span className="mctb-consent-badge mctb-consent-badge--neutral">
                      Business attestation
                    </span>
                    <span className="mctb-consent-badge mctb-consent-badge--neutral">
                      Eligible sender required
                    </span>
                  </div>
                  {draftMode === MCTB_CONSENT_MODE_EXISTING ? (
                    <Check className="mctb-consent-mode-card__check h-4 w-4" aria-hidden />
                  ) : null}
                </button>
              </div>

              {!existingConsentEligible && ineligibleCopy ? (
                <div className="mctb-consent-inline-warn" role="status">
                  {ineligibleCopy}{" "}
                  <Link href={`${MCTB_ROUTES.setupPhone}?open=manage`}>Manage messaging number →</Link>
                </div>
              ) : null}
            </section>

            <section className="mctb-consent-module" aria-labelledby="caller-experience-heading">
              <div className="mctb-consent-module__head">
                <Phone className="mctb-consent-module__head-icon h-4 w-4" aria-hidden />
                <div>
                  <h3 id="caller-experience-heading" className="mctb-consent-module__title">
                    Caller experience
                  </h3>
                  <p className="mctb-consent-module__sub">
                    What a caller experiences with the selected consent method.
                  </p>
                </div>
              </div>
              <div className="mctb-consent-flow">
                {callerFlow.map((step, index) => (
                  <Fragment key={step.id}>
                    <div className="mctb-consent-flow__step">
                      <div className="mctb-consent-flow__circle">{index + 1}</div>
                      <div>
                        <div className="mctb-consent-flow__title">{step.title}</div>
                        <div className="mctb-consent-flow__detail">{step.detail}</div>
                      </div>
                    </div>
                    {index < callerFlow.length - 1 ? (
                      <span className="mctb-consent-flow__arrow" aria-hidden>→</span>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </section>

            {draftMode === MCTB_CONSENT_MODE_VERIFIED ? (
              <section className="mctb-consent-module" aria-labelledby="disclosure-heading">
                <div className="mctb-consent-module__head">
                  <Volume2 className="mctb-consent-module__head-icon h-4 w-4" aria-hidden />
                  <div>
                    <h3 id="disclosure-heading" className="mctb-consent-module__title">
                      What callers hear
                    </h3>
                    <p className="mctb-consent-module__sub">
                      System disclosure · Locked compliance portion
                    </p>
                  </div>
                </div>
                <div className="mctb-consent-disclosure-grid">
                  <div>
                    <p className="mctb-consent-disclosure-text">
                      {promptLoading
                        ? "Loading disclosure…"
                        : consentPrompt?.scriptText ||
                          "Disclosure will use your published Press 1 consent prompt."}
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="mctb-consent-preview-btn"
                      disabled={!consentPrompt?.playbackUrl}
                      onClick={() => playDisclosure()}
                      aria-label="Preview disclosure audio"
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      Preview disclosure
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="mctb-consent-module">
                <p className="mctb-consent-info-row m-0">
                  Press 1 disclosure is not used in existing-consent mode. Your business relies on
                  permission obtained before this missed call and must maintain evidence outside this
                  prompt.
                </p>
              </section>
            )}

            {draftMode === MCTB_CONSENT_MODE_VERIFIED ? (
              <section className="mctb-consent-module">
                <h3 className="mctb-consent-module__title m-0 mb-2">If the caller does not press 1</h3>
                <div className="mctb-consent-info-row">
                  <ul>
                    <li>No automatic recovery text is sent under this consent mode.</li>
                    <li>
                      The call continues to your configured voicemail or fallback behavior where
                      applicable.
                    </li>
                  </ul>
                  <p className="mt-2 mb-0">
                    <Link href={MCTB_ROUTES.setupVoicemail}>View voicemail settings →</Link>
                  </p>
                </div>
              </section>
            ) : null}

            <section className="mctb-consent-module" aria-labelledby="evidence-heading">
              <div className="mctb-consent-module__head">
                <FileCheck className="mctb-consent-module__head-icon h-4 w-4" aria-hidden />
                <div>
                  <h3 id="evidence-heading" className="mctb-consent-module__title">
                    Consent evidence
                  </h3>
                </div>
              </div>
              {draftMode === MCTB_CONSENT_MODE_VERIFIED ? (
                <>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Method</span>
                    <span className="mctb-consent-kv__value">Press 1</span>
                  </div>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Captured</span>
                    <span className="mctb-consent-kv__value">Per qualifying call</span>
                  </div>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Stored with</span>
                    <span className="mctb-consent-kv__value">Call / recovery event</span>
                  </div>
                  <p className="mt-2 mb-0 text-[12.5px]">
                    <Link href={MCTB_ROUTES.complianceConsent}>View consent history →</Link>
                  </p>
                </>
              ) : (
                <>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Method</span>
                    <span className="mctb-consent-kv__value">Business-provided consent</span>
                  </div>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Basis</span>
                    <span className="mctb-consent-kv__value">Business attestation</span>
                  </div>
                  <div className="mctb-consent-kv">
                    <span className="mctb-consent-kv__label">Attested</span>
                    <span className="mctb-consent-kv__value">
                      {formatAttestationWhen(savedAttestation?.attestedAt) || "On save"}
                    </span>
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="mctb-consent-rail" aria-label="Consent context">
            <div className="mctb-consent-rail-panel">
              <h4 className="mctb-consent-rail-panel__title">Consent summary</h4>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">Method</span>
                <span className="mctb-consent-kv__value">{methodLabel(draftMode)}</span>
              </div>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">Evidence</span>
                <span className="mctb-consent-kv__value">
                  {draftMode === MCTB_CONSENT_MODE_VERIFIED ? "Per call" : "Attestation"}
                </span>
              </div>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">MCTB sender</span>
                <span className="mctb-consent-kv__value">{senderLabel}</span>
              </div>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">Sender status</span>
                <span className="mctb-consent-kv__value">{senderStatusLabel(messagingReady)}</span>
              </div>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">Recovery</span>
                <span className="mctb-consent-kv__value">
                  {recoveryActiveLabel(recoveryEnabled, paused)}
                </span>
              </div>
              <div className="mctb-consent-kv">
                <span className="mctb-consent-kv__label">Text back</span>
                <span className="mctb-consent-kv__value">
                  {textBackConfiguredLabel(messageTemplate)}
                </span>
              </div>
            </div>

            <div className="mctb-consent-rail-panel">
              <h4 className="mctb-consent-rail-panel__title">Best for</h4>
              {draftMode === MCTB_CONSENT_MODE_VERIFIED ? (
                <ul className="mctb-consent-best-for list-none p-0 m-0">
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    Businesses using the Transovo MCTB forwarding/text-back line
                  </li>
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    Consent collected per call — no prior SMS consent assumed
                  </li>
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    Recommended default for standard MCTB sender path
                  </li>
                </ul>
              ) : (
                <ul className="mctb-consent-best-for list-none p-0 m-0">
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    Documented permission with eligible business messaging setup
                  </li>
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    No Press 1 prompt on the call
                  </li>
                  <li>
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#2d8a5e]" aria-hidden />
                    You maintain consent evidence outside Transovo
                  </li>
                </ul>
              )}
            </div>

            <div className="mctb-consent-rail-panel">
              <h4 className="mctb-consent-rail-panel__title">Current call flow</h4>
              <div className="mctb-consent-mini-flow">
                {miniFlow.map((label, i) => (
                  <Fragment key={label}>
                    <div>{label}</div>
                    {i < miniFlow.length - 1 ? (
                      <div className="mctb-consent-mini-flow__arrow" aria-hidden>↓</div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="mctb-consent-rail-panel">
              <h4 className="mctb-consent-rail-panel__title">Related settings</h4>
              <Link href={MCTB_ROUTES.setupRecovery} className="mctb-consent-related-row">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Recovery
                </span>
                <span className="mctb-consent-related-row__meta">
                  {recoveryActiveLabel(recoveryEnabled, paused)}
                  <ChevronRight className="inline h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
              <Link href={MCTB_ROUTES.setupTextBack} className="mctb-consent-related-row">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Text back
                </span>
                <span className="mctb-consent-related-row__meta">
                  {textBackConfiguredLabel(messageTemplate)}
                  <ChevronRight className="inline h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
              <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-consent-related-row">
                <span className="inline-flex items-center gap-2">
                  <Voicemail className="h-3.5 w-3.5" aria-hidden />
                  Voicemail
                </span>
                <span className="mctb-consent-related-row__meta">
                  Configure
                  <ChevronRight className="inline h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
              <Link href={MCTB_ROUTES.complianceConsent} className="mctb-consent-related-row">
                <span className="inline-flex items-center gap-2">
                  <FileCheck className="h-3.5 w-3.5" aria-hidden />
                  Consent log
                </span>
                <span className="mctb-consent-related-row__meta">
                  View records
                  <ChevronRight className="inline h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {existingModalOpen ? (
        <div
          className="mctb-consent-modal-backdrop"
          role="presentation"
          onClick={() => setExistingModalOpen(false)}
        >
          <div
            className="mctb-consent-modal"
            role="dialog"
            aria-labelledby="existing-consent-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="existing-consent-title" className="mctb-consent-modal__title">
              Use existing consent
            </h3>
            <p className="mctb-consent-modal__body">
              This mode relies on permission your business obtained before the missed call. It does
              not treat an inbound missed call as consent to text.
            </p>
            <label className="mctb-consent-modal__check">
              <input
                type="checkbox"
                checked={modalAttestChecked}
                onChange={(e) => setModalAttestChecked(e.target.checked)}
              />
              <span>
                I confirm that my business is responsible for having valid permission to send these
                text messages.
              </span>
            </label>
            <div className="mctb-consent-modal__actions">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setExistingModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                disabled={!modalAttestChecked}
                onClick={() => confirmExistingMode()}
              >
                Use existing consent
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {press1ModalOpen ? (
        <div
          className="mctb-consent-modal-backdrop"
          role="presentation"
          onClick={() => setPress1ModalOpen(false)}
        >
          <div
            className="mctb-consent-modal"
            role="dialog"
            aria-labelledby="press1-switch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="press1-switch-title" className="mctb-consent-modal__title">
              Switch to Press 1?
            </h3>
            <p className="mctb-consent-modal__body">
              Callers will need to actively press 1 before an automatic recovery text can be sent.
            </p>
            <div className="mctb-consent-modal__actions">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setPress1ModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                onClick={() => confirmPress1Mode()}
              >
                Switch to Press 1
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MctbSetupShell>
  );
}
