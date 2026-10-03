"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MCTB_CARRIER_GUIDES, formatCarrierStep, getCarrierGuide } from "@/lib/mctb/onboarding/carriers";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import {
  buildDialCodeCopyText,
  clampRingSeconds,
  connectionStatusLabel,
  isPlausibleUsPhoneInput,
  normalizeBusinessLineInput,
  resolveConnectionUiStatus,
  type ForwardingVerificationUi,
} from "@/lib/mctb/setup-phone-forwarding-model";
import { resolveMctbForwardingVerifiedForUi } from "@/lib/mctb/forwarding-verified-ui";
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
  loadError: string | null;
  wired: MctbSetupPhoneWired | undefined;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [businessLineInput, setBusinessLineInput] = useState("");
  const [businessLineError, setBusinessLineError] = useState<string | null>(null);
  const [ownSenderCheckoutBusy, setOwnSenderCheckoutBusy] = useState(false);
  const [ingressProvisionError, setIngressProvisionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [setupRes, onboardRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
      ]);
      const setupJson = await setupRes.json();
      if (!setupRes.ok || !setupJson.data) {
        throw new Error((setupJson as { error?: string }).error || "Could not load phone settings");
      }

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
      setBusinessLineInput(line ? formatMctbPhoneLabel(line) : "");
      setProductionForwardE164((d.productionForwardTargetE164 as string) || null);
      const ingress = d.ingressProvisioning as { ok?: boolean; error?: string | null } | undefined;
      if (ingress && ingress.ok === false && ingress.error) {
        setIngressProvisionError(ingress.error);
      } else {
        setIngressProvisionError(null);
      }
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
        const forwardingVerifiedUi = resolveMctbForwardingVerifiedForUi({
          forwardingConnectedAt: ob.state?.forwardingConnectedAt as string | null | undefined,
          liveTestPassedAt: ob.state?.liveTestPassedAt as string | null | undefined,
          forwardingVerificationVerified: Boolean(ob.forwardingVerification?.verified),
        });
        const detectedAt =
          (ob.state?.forwardingConnectedAt as string | null | undefined) ||
          ob.forwardingVerification?.detectedAt ||
          (ob.state?.liveTestPassedAt as string | null | undefined) ||
          null;
        setVerification(
          ob.forwardingVerification || forwardingVerifiedUi
            ? {
                testStarted: Boolean(
                  ob.forwardingVerification?.testStarted ||
                    (ob.state?.liveTestSession as { startedAt?: string } | null)?.startedAt,
                ),
                callDetected: Boolean(
                  ob.forwardingVerification?.callDetected || forwardingVerifiedUi,
                ),
                verified: forwardingVerifiedUi,
                detectedAt,
                path: ob.forwardingVerification?.path || null,
              }
            : null,
        );
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load phone settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSetup = () => {
      void load();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [load]);

  const forwardTarget = productionForwardE164;
  const carrierGuide = useMemo(() => getCarrierGuide(carrier), [carrier]);

  const saveForwarding = useCallback(async () => {
    setBusinessLineError(null);
    const line = businessLineInput.trim();
    if (line && !isPlausibleUsPhoneInput(line)) {
      setBusinessLineError("Enter a valid US business phone number.");
      throw new Error("Enter a valid US business phone number.");
    }
    const normalized = line ? normalizeBusinessLineInput(line) : "";
    await saveMctbSetup({
      phoneNumberId,
      businessLineE164: normalized || null,
      activate: false,
    });
    const res = await fetch("/api/mctb/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        forwardingCarrier: carrier,
        forwardingRingSeconds: ringSeconds,
        businessNumberE164: normalized || undefined,
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
    if (normalized) {
      setBusinessLineE164(normalized);
      setBusinessLineInput(formatMctbPhoneLabel(normalized));
    }
    await load();
  }, [phoneNumberId, carrier, ringSeconds, businessLineInput, load]);

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
    if (loading || loadError) return undefined;

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
        ? "Platform sender"
        : workspaceSender?.displayNumber || "Your verified number";
    const senderDetail =
      senderMode === "PLATFORM"
        ? "Transovo manages the sending number for recovery texts"
        : workspaceSender
          ? `${workspaceSender.complianceLabel}${workspaceSender.approved ? "" : " · Cannot activate yet"}`
          : "Select a verified messaging number";

    const senderOptions = [
      {
        id: "platform" as const,
        title: "Platform sender",
        description: "Transovo manages the sending number for recovery texts.",
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

    const forwardReady = Boolean(forwardTarget);
    const forwardActionsReady = forwardReady && Boolean(businessLineE164);

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
      forwardingDestinationReady: forwardReady,
      forwardingInstructionsEnabled: forwardActionsReady,
      forwardingVerifyEnabled: forwardActionsReady,
      forwardingInstructionsPendingMessage: ingressProvisionError
        ? `We could not assign your forwarding number yet (${ingressProvisionError}). Refresh this page in a moment or contact support if it persists.`
        : !forwardReady
          ? phoneNumberId
            ? "Your Transovo forwarding number is still provisioning. Carrier instructions will appear when it is ready."
            : "Complete phone setup to receive a Transovo forwarding number before configuring call forwarding."
          : !businessLineE164
            ? "Save your business line to see carrier-specific forwarding instructions."
            : undefined,
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
        : "Own Local Number is $10/month on top of your MCTB plan (Free, Text Back, or AI Recovery), plus $19.50 one-time A2P at checkout.",
      showOwnSenderSubscribe: !ownSenderEntitled,
      ownSenderSubscribeBusy: ownSenderCheckoutBusy,
      onOwnSenderSubscribe: async () => {
        setOwnSenderCheckoutBusy(true);
        try {
          const { startPlatformProductCheckout } = await import("@/lib/mctb/start-platform-checkout");
          await startPlatformProductCheckout({
            productKey: "mctb_own_sender",
            successPath: "/mctb/phone",
          });
        } finally {
          setOwnSenderCheckoutBusy(false);
        }
      },
      ownSenderRegistrationHref: ownSenderEntitled ? "/compliance" : undefined,
      ownSenderLifecycleSteps: ownSenderEntitled
        ? [
            "Complete the A2P registration form below (Transovo submits to the carrier manually).",
            "Choose a verified workspace number (TFN or 10DLC-approved).",
            "Select your number here to activate — runtime and custom opener unlock when approved.",
            "Switch back to Transovo Platform anytime; policy reverts immediately.",
          ]
        : [
            "Subscribe to Own Local Number ($10/mo on top of your current plan + $19.50 one-time A2P).",
            "Complete the A2P intake form on this page after checkout.",
            "When the carrier approves messaging, select your number as text-back sender.",
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
      businessLineInput,
      businessLineError,
      onBusinessLineChange: setBusinessLineInput,
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
    loadError,
    businessLineE164,
    businessLineInput,
    businessLineError,
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
    ownSenderCheckoutBusy,
    messagingReady,
    campaignStatus,
    saveForwarding,
    saveSenderSelection,
  ]);

  return { loading, loadError, wired, reload: load };
}
