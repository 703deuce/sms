"use client";

import {
  displayNumber,
  formatNumberTypeLabel,
  messagingUiLabel,
  type MctbNumberRow,
  type TfvUiStatus,
  tfvTone,
  voiceUiLabel,
} from "@/lib/mctb/number-management-model";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { postMctbSelectPhone } from "@/lib/mctb/numbers/post-select-phone";
import type { VoiceProductSwitchConflict } from "@/lib/phone/voice-product-switch-types";
import { useCallback, useEffect, useState } from "react";

export type MctbNumberDrawerMode = "manage" | "add" | "verify" | null;

/** Open the shared MCTB numbers drawer from Setup → Phone (same host as legacy forwarding view). */
export function openMctbNumberDrawer(mode: Exclude<MctbNumberDrawerMode, null>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mctb-open-drawer", { detail: mode }));
}

type NumbersPayload = {
  numbers: MctbNumberRow[];
  activePhoneNumberId: string | null;
  tfv: TfvUiStatus;
};

export type MctbNumberDrawerController = ReturnType<typeof useMctbNumberDrawerController>;

export function useMctbNumberDrawerController(options: {
  open: MctbNumberDrawerMode;
  onClose: () => void;
  onOpenMode?: (mode: MctbNumberDrawerMode) => void;
  onNumbersChanged?: () => void;
}) {
  const { open, onClose, onOpenMode, onNumbersChanged } = options;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NumbersPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addStep, setAddStep] = useState<"choose" | "search" | "provision">("choose");
  const [areaCode, setAreaCode] = useState("");
  const [numberType, setNumberType] = useState<"local" | "toll_free">("toll_free");
  const [searchResults, setSearchResults] = useState<
    Array<{ e164: string; locality?: string; searchLogId?: string }>
  >([]);
  const [searchLogId, setSearchLogId] = useState<string | null>(null);

  const [complianceActions, setComplianceActions] = useState<string[]>([]);
  const [complianceMeta, setComplianceMeta] = useState<{
    brandStatus?: string;
    campaignStatus?: string;
    messagingReady?: boolean;
  } | null>(null);

  const [voiceSwitchConflict, setVoiceSwitchConflict] =
    useState<VoiceProductSwitchConflict | null>(null);
  const [pendingSelectPhoneId, setPendingSelectPhoneId] = useState<string | null>(null);

  const loadNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/numbers", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load numbers");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompliance = useCallback(async () => {
    const res = await fetch("/api/mctb/setup", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const d = json.data;
    setComplianceActions(d.compliance?.requiredActions || []);
    setComplianceMeta({
      brandStatus: d.compliance?.brandStatus,
      campaignStatus: d.compliance?.campaignStatus,
      messagingReady: d.compliance?.messagingReady,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadNumbers();
    if (open === "verify") void loadCompliance();
    if (open === "add") setAddStep("choose");
  }, [open, loadNumbers, loadCompliance]);

  async function selectNumber(id: string, opts?: { confirmVoiceProductSwitch?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const result = await postMctbSelectPhone(id, {
        confirmVoiceProductSwitch: opts?.confirmVoiceProductSwitch,
      });
      if (!result.ok && "needSwitch" in result && result.needSwitch) {
        setPendingSelectPhoneId(id);
        setVoiceSwitchConflict(result.conflict);
        return;
      }
      if (!result.ok) {
        throw new Error(result.error);
      }
      setVoiceSwitchConflict(null);
      setPendingSelectPhoneId(null);
      await loadNumbers();
      onNumbersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select number");
    } finally {
      setBusy(false);
    }
  }

  function cancelVoiceProductSwitch() {
    setVoiceSwitchConflict(null);
    setPendingSelectPhoneId(null);
  }

  async function confirmVoiceProductSwitch() {
    if (!pendingSelectPhoneId) return;
    await selectNumber(pendingSelectPhoneId, { confirmVoiceProductSwitch: true });
  }

  async function provisionAuto() {
    setBusy(true);
    setAddStep("provision");
    setError(null);
    try {
      const res = await fetch("/api/mctb/numbers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "provision_auto" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign number");
      await loadNumbers();
      onNumbersChanged?.();
      setAddStep("choose");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign number");
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/numbers/premium/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          areaCode: areaCode.replace(/\D/g, "").slice(0, 3),
          numberType,
          limit: 8,
          stream: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      const logId = json.searchLogId as string | undefined;
      setSearchLogId(logId || null);
      const results = (json.results || []) as Array<{
        phoneNumber?: string;
        displayNumber?: string;
        headlineLabel?: string;
      }>;
      setSearchResults(
        results.slice(0, 8).map((r) => ({
          e164: r.phoneNumber || "",
          locality: r.headlineLabel,
        })),
      );
      setAddStep("search");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function purchaseResult(e164: string) {
    if (!searchLogId) {
      setError("Search session expired. Search again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reserveRes = await fetch("/api/numbers/premium/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: e164, searchLogId, searchMode: "business" }),
      });
      const reserveJson = await reserveRes.json();
      if (!reserveRes.ok) throw new Error(reserveJson.error || "Could not reserve number");

      const reservationId = reserveJson.reservationId || reserveJson.data?.reservationId;
      if (!reservationId) throw new Error("Reservation missing");

      const completeRes = await fetch("/api/numbers/premium/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reservationId,
          idempotencyKey: `mctb-drawer-${reservationId}`,
        }),
      });
      const completeJson = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeJson.error || "Purchase failed");

      const phoneId = completeJson.phoneNumberId || completeJson.data?.phoneNumberId;
      if (phoneId) await selectNumber(phoneId);
      else await loadNumbers();
      onNumbersChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get number");
    } finally {
      setBusy(false);
    }
  }

  async function submitVerification() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/tfv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submit failed");
      await loadNumbers();
      onNumbersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  function copyActiveNumber() {
    const active = data?.numbers.find((n) => n.id === data.activePhoneNumberId) || data?.numbers[0];
    if (!active) return;
    void navigator.clipboard.writeText(formatMctbPhoneLabel(active.e164));
  }

  const active = data?.numbers.find((n) => n.id === data.activePhoneNumberId) || data?.numbers[0];
  const tfv = data?.tfv;

  const title =
    open === "manage" ? "MCTB number" : open === "add" ? "Add a number" : "Messaging verification";
  const subtitle =
    open === "manage"
      ? "Manage the number Transovo uses for forwarded calls and recovery texting."
      : open === "add"
        ? "Search or assign a number for missed-call recovery."
        : "Complete toll-free or A2P registration so recovery texts can send.";

  return {
    open,
    onClose,
    onOpenMode,
    loading,
    data,
    error,
    busy,
    addStep,
    setAddStep,
    areaCode,
    setAreaCode,
    numberType,
    setNumberType,
    searchResults,
    complianceActions,
    complianceMeta,
    active,
    tfv,
    title,
    subtitle,
    loadNumbers,
    selectNumber,
    voiceSwitchConflict,
    cancelVoiceProductSwitch,
    confirmVoiceProductSwitch,
    provisionAuto,
    runSearch,
    purchaseResult,
    submitVerification,
    copyActiveNumber,
    displayNumber,
    formatNumberTypeLabel,
    messagingUiLabel,
    voiceUiLabel,
    tfvTone,
  };
}

export function useMctbNumberDrawerEvents(setOpen: (mode: MctbNumberDrawerMode) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MctbNumberDrawerMode>).detail;
      if (detail) setOpen(detail);
    };
    window.addEventListener("mctb-open-drawer", handler);
    return () => window.removeEventListener("mctb-open-drawer", handler);
  }, [setOpen]);
}
