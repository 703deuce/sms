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

type SetupPhoneRow = {
  id: string;
  e164: string;
  messagingStatus?: { approved?: boolean; label?: string };
};

function resolveSenderMode(d: Record<string, unknown>): "PLATFORM" | "WORKSPACE" {
  const messaging = d.messaging as { senderMode?: string } | undefined;
  const runtime = d.runtime as { senderMode?: string } | undefined;
  const mode = messaging?.senderMode ?? runtime?.senderMode ?? "WORKSPACE";
  return mode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
}

export function useMctbSetupPhoneWiring(): {
  loading: boolean;
  wired: MctbSetupPhoneWired | undefined;
} {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [businessLineE164, setBusinessLineE164] = useState<string | null>(null);
  const [productionForwardE164, setProductionForwardE164] = useState<string | null>(null);
  const [senderMode, setSenderMode] = useState<"PLATFORM" | "WORKSPACE">("PLATFORM");
  const [selectedCustomerSenderId, setSelectedCustomerSenderId] = useState<string | null>(null);
  const [customerSenders, setCustomerSenders] = useState<
    Array<{
      phoneNumberId: string;
      displayNumber: string;
      complianceLabel: string;
      approved: boolean;
      selectable: boolean;
    }>
  >([]);
  const [ownSenderEntitled, setOwnSenderEntitled] = useState(false);
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

      const d = setupJson.data as Record<string, unknown>;
      const ob = onboardRes.ok ? await onboardRes.json().catch(() => null) : null;
      const { resolveMctbWorkspaceBusinessLineE164 } = await import(
        "@/lib/mctb/resolve-workspace-business-line"
      );
      const line =
        resolveMctbWorkspaceBusinessLineE164(
          (d.businessLineE164 as string) || null,
          (ob?.state?.businessNumberE164 as string) || null,
        ) || "";
      const runtime = d.runtime as { phoneNumberId?: string | null; smsPhoneNumberId?: string | null };
      const pid = runtime?.phoneNumberId ?? null;
      setPhoneNumberId(pid);
      setBusinessLineE164(line || null);
      setProductionForwardE164((d.productionForwardTargetE164 as string) || null);
      setMessagingReady(Boolean((d.compliance as { messagingReady?: boolean })?.messagingReady));
      setCampaignStatus(
        ((d.compliance as { campaignStatus?: string })?.campaignStatus as string) || null,
      );

      const resolvedMode = resolveSenderMode(d);
      setSenderMode(resolvedMode);

      const caps = d.capabilities as { ownSenderAddOnEntitled?: boolean } | undefined;
      const entitled = Boolean(caps?.ownSenderAddOnEntitled);
      setOwnSenderEntitled(entitled);

      const phones = (d.phoneNumbers || []) as SetupPhoneRow[];
      setCustomerSenders(
        phones
          .filter((p) => p.id !== pid)
          .map((p) => {
            const approved = Boolean(p.messagingStatus?.approved);
            return {
              phoneNumberId: p.id,
              displayNumber: formatMctbPhoneLabel(p.e164),
              complianceLabel: p.messagingStatus?.label || (approved ? "Verified" : "Not started"),
              approved,
              selectable: entitled && approved,
            };
          }),
      );

      const smsId = runtime?.smsPhoneNumberId ?? null;
      setSelectedCustomerSenderId(resolvedMode === "WORKSPACE" ? smsId : null);

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

  const saveSenderSelection = useCallback(
    async (mode: "PLATFORM" | "WORKSPACE", customerPhoneId?: string | null) => {
      if (mode === "PLATFORM") {
        await saveMctbSetup({ senderMode: "PLATFORM", activate: false });
      } else {
        const id = customerPhoneId ?? selectedCustomerSenderId;
        if (!id) throw new Error("Select a verified messaging number.");
        await saveMctbSetup({
          senderMode: "WORKSPACE",
          smsPhoneNumberId: id,
          activate: false,
        });
      }
      await load();
    },
    [selectedCustomerSenderId, load],
  );

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
      forwardTarget && businessLineE164
        ? [
            `Your business line: ${formatMctbPhoneLabel(businessLineE164)}`,
            `When unanswered, forward to your Transovo forwarding number: ${formatMctbPhoneLabel(forwardTarget)}`,
            ...carrierGuide.steps.map((s) =>
              formatCarrierStep(s, { transovoE164: forwardTarget, ringSeconds }),
            ),
          ]
        : forwardTarget
          ? carrierGuide.steps.map((s) =>
              formatCarrierStep(s, { transovoE164: forwardTarget, ringSeconds }),
            )
          : [];

    const workspaceSender = customerSenders.find((s) => s.phoneNumberId === selectedCustomerSenderId);
    const senderHeadline =
      senderMode === "PLATFORM"
        ? "Transovo Platform"
        : workspaceSender?.displayNumber || "Your verified number";
    const senderDetail =
      senderMode === "PLATFORM"
        ? "Managed by Transovo"
        : workspaceSender
          ? `${workspaceSender.complianceLabel}${workspaceSender.approved ? "" : " · Cannot activate yet"}`
          : "Select a verified messaging number";

    const senderOptions = [
      {
        id: "platform" as const,
        title: "Transovo Platform",
        description: "Transovo manages the sending number.",
        active: senderMode === "PLATFORM",
        selectable: true,
        statusLabel: senderMode === "PLATFORM" ? "Active" : undefined,
      },
      ...customerSenders.map((s) => ({
        id: s.phoneNumberId,
        title: s.displayNumber,
        description: s.complianceLabel,
        active: senderMode === "WORKSPACE" && selectedCustomerSenderId === s.phoneNumberId,
        selectable: s.selectable,
        statusLabel:
          senderMode === "WORKSPACE" && selectedCustomerSenderId === s.phoneNumberId
            ? "Active"
            : s.approved
              ? "Verified"
              : "Pending",
      })),
    ];

    return {
      businessLine: businessLineE164 ? formatMctbPhoneLabel(businessLineE164) : "Not configured",
      businessLineMeta: "Customers call this number",
      forwardingDestination: forwardTarget
        ? formatMctbPhoneLabel(forwardTarget)
        : phoneNumberId
          ? "Setting up forwarding number…"
          : "Not provisioned yet",
      forwardingMeta: "Forward unanswered calls here",
      callPathHint:
        businessLineE164 && forwardTarget
          ? `${formatMctbPhoneLabel(businessLineE164)} → ${formatMctbPhoneLabel(forwardTarget)}`
          : undefined,
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
      verificationDetail:
        verification?.verified && verification.detectedAt
          ? `Verified ${new Date(verification.detectedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`
          : verification?.testStarted
            ? "Waiting for test call…"
            : "Run a test call from another phone and let it ring unanswered.",
      senderHeadline,
      senderDetail,
      senderOptions,
      ownSenderEntitled,
      ownSenderLockedHint: ownSenderEntitled
        ? undefined
        : "Own Sender add-on required to text from your verified number.",
      ownSenderRegistrationHref: "/compliance",
      ownSenderLifecycleSteps: ownSenderEntitled
        ? [
            "Choose a verified workspace number below (TFN or 10DLC-approved).",
            "Complete messaging registration if status is Pending or Rejected.",
            "Select your number here to activate — runtime and custom opener unlock.",
            "Switch back to Transovo Platform anytime; policy reverts immediately.",
          ]
        : [
            "Unlock Own Sender on your plan.",
            "Register a toll-free or 10DLC sender under Compliance.",
            "Return here to activate the approved number as text-back sender.",
          ],
      senderRegistrationLabel:
        senderMode === "PLATFORM"
          ? "Platform sender"
          : messagingReady
            ? campaignStatus && campaignStatus !== "Not started"
              ? campaignStatus
              : "Registered"
            : "Pending",
      senderRegistrationTone:
        senderMode === "PLATFORM" || messagingReady ? "success" : "warning",
      onCarrierChange: (id: string) => setCarrier(id as MctbForwardingCarrier),
      onRingChange: (sec: string) => setRingSeconds(clampRingSeconds(Number(sec))),
      onSave: saveForwarding,
      onSelectSender: async (choice: "platform" | string) => {
        if (choice === "platform") {
          setSenderMode("PLATFORM");
          await saveSenderSelection("PLATFORM");
          return;
        }
        setSenderMode("WORKSPACE");
        setSelectedCustomerSenderId(choice);
        await saveSenderSelection("WORKSPACE", choice);
      },
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
    phoneNumberId,
    carrier,
    carrierGuide,
    ringSeconds,
    verification,
    senderMode,
    selectedCustomerSenderId,
    customerSenders,
    ownSenderEntitled,
    messagingReady,
    campaignStatus,
    saveForwarding,
    saveSenderSelection,
  ]);

  return { loading, wired };
}
