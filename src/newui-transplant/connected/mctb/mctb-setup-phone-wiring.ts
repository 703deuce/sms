"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MCTB_CARRIER_GUIDES, formatCarrierStep, getCarrierGuide } from "@/lib/mctb/onboarding/carriers";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  buildDialCodeCopyText,
  clampRingSeconds,
  connectionStatusLabel,
  resolveConnectionUiStatus,
  type ForwardingVerificationUi,
} from "@/lib/mctb/setup-phone-forwarding-model";
import { saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import type { MctbSetupPhoneWired } from "@/newui-transplant/mirror/routes/mctb/setup/phone/page";

const RING_OPTIONS = ["10", "15", "20", "25", "30"];

export function useMctbSetupPhoneWiring(senderFallback: string): {
  loading: boolean;
  wired: MctbSetupPhoneWired | undefined;
} {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [businessLineE164, setBusinessLineE164] = useState<string | null>(null);
  const [productionForwardE164, setProductionForwardE164] = useState<string | null>(null);
  const [selectedSenderE164, setSelectedSenderE164] = useState<string | null>(null);
  const [messagingReady, setMessagingReady] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
  const [ringSeconds, setRingSeconds] = useState(15);
  const [verification, setVerification] = useState<ForwardingVerificationUi>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setupRes, onboardRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
      ]);
      const setupJson = await setupRes.json();
      if (!setupRes.ok || !setupJson.data) return;

      const d = setupJson.data;
      const ob = onboardRes.ok ? await onboardRes.json().catch(() => null) : null;
      const { resolveMctbWorkspaceBusinessLineE164 } = await import(
        "@/lib/mctb/resolve-workspace-business-line"
      );
      const line =
        resolveMctbWorkspaceBusinessLineE164(
          (d.businessLineE164 as string) || null,
          (ob?.state?.businessNumberE164 as string) || null,
        ) || "";
      const pid = d.runtime?.phoneNumberId as string | null;
      setPhoneNumberId(pid);
      setBusinessLineE164(line || null);
      setProductionForwardE164(d.productionForwardTargetE164 || null);
      setMessagingReady(Boolean(d.compliance?.messagingReady));
      setCampaignStatus(d.compliance?.campaignStatus || null);

      const smsId = d.runtime?.smsPhoneNumberId || pid;
      const phones = (d.phoneNumbers || []) as Array<{ id: string; e164: string }>;
      const smsPhone = phones.find((p) => p.id === smsId);
      setSelectedSenderE164(smsPhone?.e164 || phones[0]?.e164 || null);

      if (ob?.state) {
        if (ob.state?.forwardingCarrier) setCarrier(ob.state.forwardingCarrier);
        if (ob.state?.forwardingRingSeconds != null) {
          setRingSeconds(clampRingSeconds(ob.state.forwardingRingSeconds));
        }
        setVerification(
          ob.forwardingVerification
            ? {
                testStarted: Boolean(ob.forwardingVerification.testStarted),
                callDetected: Boolean(ob.forwardingVerification.callDetected),
                verified: Boolean(ob.forwardingVerification.verified),
                detectedAt: ob.forwardingVerification.detectedAt || null,
                path: ob.forwardingVerification.path || null,
              }
            : null,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const forwardTarget = productionForwardE164;
  const carrierGuide = useMemo(() => getCarrierGuide(carrier), [carrier]);

  const saveForwarding = useCallback(async () => {
    await saveMctbSetup({ phoneNumberId, activate: false });
    const res = await fetch("/api/mctb/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        forwardingCarrier: carrier,
        forwardingRingSeconds: ringSeconds,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to save forwarding settings");
    if (json.forwardingVerification) {
      setVerification({
        testStarted: Boolean(json.forwardingVerification.testStarted),
        callDetected: Boolean(json.forwardingVerification.callDetected),
        verified: Boolean(json.forwardingVerification.verified),
        detectedAt: json.forwardingVerification.detectedAt || null,
        path: json.forwardingVerification.path || null,
      });
    }
    await load();
  }, [phoneNumberId, carrier, ringSeconds, load]);

  const wired = useMemo((): MctbSetupPhoneWired | undefined => {
    if (loading) return undefined;

    const connection = resolveConnectionUiStatus(
      verification,
      Boolean(businessLineE164),
      Boolean(forwardTarget),
    );
    const dialCode =
      forwardTarget ? buildDialCodeCopyText(carrierGuide, forwardTarget, ringSeconds) : null;
    const instructionSteps =
      forwardTarget
        ? carrierGuide.steps.map((s) =>
            formatCarrierStep(s, {
              transovoE164: forwardTarget,
              ringSeconds,
            }),
          )
        : [];

    const verifiedDetail =
      verification?.verified && verification.detectedAt
        ? `Verified ${new Date(verification.detectedAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : verification?.testStarted
          ? "Waiting for test call…"
          : "Run a test call from another phone and let it ring unanswered.";

    return {
      businessLine: businessLineE164 ? formatMctbPhoneLabel(businessLineE164) : "—",
      businessLineMeta: `${carrierGuide.label} · conditional forwarding`,
      forwardingDestination: forwardTarget ? formatMctbPhoneLabel(forwardTarget) : "—",
      carrierId: carrier,
      carrierOptions: MCTB_CARRIER_GUIDES.map((g) => ({ value: g.id, label: g.label })),
      ringSeconds: String(ringSeconds),
      ringOptions: RING_OPTIONS,
      instructionTitle: `${carrierGuide.label} · conditional call forwarding`,
      instructionSteps,
      dialCode: dialCode || "—",
      verificationPillLabel: connectionStatusLabel(connection),
      verificationPillTone:
        connection === "verified" ? "success" : connection === "failed" ? "warning" : "warning",
      verificationTitle: verification?.verified ? "Test call received" : "Forwarding not verified",
      verificationDetail: verifiedDetail,
      senderNumber: selectedSenderE164 ? formatMctbPhoneLabel(selectedSenderE164) : senderFallback,
      senderRegistrationLabel: messagingReady
        ? campaignStatus && campaignStatus !== "Not started"
          ? campaignStatus
          : "Registered"
        : "Pending",
      senderRegistrationTone: messagingReady ? "success" : "warning",
      onCarrierChange: (id: string) => setCarrier(id as MctbForwardingCarrier),
      onRingChange: (sec: string) => setRingSeconds(clampRingSeconds(Number(sec))),
      onSave: saveForwarding,
      onVerifyAgain: async () => {
        await saveForwarding();
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
      },
    };
  }, [
    loading,
    businessLineE164,
    forwardTarget,
    carrier,
    carrierGuide,
    ringSeconds,
    verification,
    selectedSenderE164,
    senderFallback,
    messagingReady,
    campaignStatus,
    saveForwarding,
  ]);

  return { loading, wired };
}
