"use client";

import "./mctb-number-drawers.css";
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
import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { MctbNumberDrawerMode } from "@/lib/mctb/numbers/mctb-number-drawer-controller";
import { postMctbSelectPhone } from "@/lib/mctb/numbers/post-select-phone";
import type { VoiceProductSwitchConflict } from "@/lib/phone/voice-product-switch-types";
import { VoiceProductSwitchDialog } from "@/components/solutions/appointment-receptionist/voice-product-switch-dialog";

export type { MctbNumberDrawerMode } from "@/lib/mctb/numbers/mctb-number-drawer-controller";

type NumbersPayload = {
  numbers: MctbNumberRow[];
  activePhoneNumberId: string | null;
  tfv: TfvUiStatus;
};

type Props = {
  open: MctbNumberDrawerMode;
  onClose: () => void;
  onOpenMode?: (mode: MctbNumberDrawerMode) => void;
  onNumbersChanged?: () => void;
};

export function MctbNumberDrawerHost({ open, onClose, onOpenMode, onNumbersChanged }: Props) {
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
      const res = await fetch("/api/mctb/tfv", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
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

  if (!open) return null;

  const active = data?.numbers.find((n) => n.id === data.activePhoneNumberId) || data?.numbers[0];
  const tfv = data?.tfv;

  return (
    <>
      <div className="mctb-num-drawer-backdrop" role="presentation" onClick={onClose} />
      <aside className="mctb-num-drawer" role="dialog" aria-labelledby="mctb-num-drawer-title">
        <button type="button" className="mctb-num-drawer__close" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </button>
        <header className="mctb-num-drawer__head">
          <h2 id="mctb-num-drawer-title" className="mctb-num-drawer__title">
            {open === "manage" ? "MCTB number" : open === "add" ? "Add a number" : "Messaging verification"}
          </h2>
          <p className="mctb-num-drawer__sub">
            {open === "manage"
              ? "Manage the number Transovo uses for forwarded calls and recovery texting."
              : open === "add"
                ? "Search or assign a number for missed-call recovery."
                : "Complete toll-free or A2P registration so recovery texts can send."}
          </p>
        </header>

        <div className="mctb-num-drawer__body">
          {error ? (
            <p className="mb-3 rounded-lg border border-[#f5c4c4] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#9b1c1c]" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-[#3a3f47]" aria-label="Loading" />
            </div>
          ) : null}

          {open === "manage" && data && !loading ? (
            <>
              {active ? (
                <div className="mctb-num-summary">
                  <div className="mctb-num-summary__label">Current number</div>
                  <div className="mctb-num-summary__value">{displayNumber(active.e164)}</div>
                  <p className="mt-1 text-[12px] text-[#626872]">
                    {active.friendlyName || "MCTB main line"} · Used for forwarding ingress and text-back
                    sender
                  </p>
                  <div className="mctb-num-status-grid">
                    <div>
                      Voice{" "}
                      <span className={`mctb-num-pill mctb-num-pill--ready`}>{voiceUiLabel(active)}</span>
                    </div>
                    <div>
                      Messaging{" "}
                      <span
                        className={`mctb-num-pill mctb-num-pill--${messagingUiLabel(active).tone}`}
                      >
                        {messagingUiLabel(active).label}
                      </span>
                    </div>
                    <div>Provider {active.provider || "—"}</div>
                    <div>
                      Verification{" "}
                      {tfv ? (
                        <span className={`mctb-num-pill mctb-num-pill--${tfvTone(tfv.status, tfv.approved)}`}>
                          {tfv.approved ? "Verified" : tfv.statusLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="mctb-setup-btn mctb-setup-btn--outline"
                      onClick={() => void navigator.clipboard.writeText(formatMctbPhoneLabel(active.e164))}
                    >
                      Copy
                    </button>
                    {messagingUiLabel(active).tone !== "ready" ? (
                      <button
                        type="button"
                        className="mctb-setup-btn mctb-setup-btn--outline"
                        onClick={() => onOpenMode?.("verify")}
                      >
                        Complete verification
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#626872]">No MCTB number yet.</p>
              )}

              {data.numbers.length > 1 ? (
                <div className="mt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b939e]">
                    All numbers
                  </h3>
                  {data.numbers.slice(0, 5).map((n) => {
                    const msg = messagingUiLabel(n);
                    const selected = n.id === data.activePhoneNumberId;
                    return (
                      <div key={n.id} className="mctb-num-list-row">
                        <div>
                          <div className="font-semibold">{displayNumber(n.e164)}</div>
                          <div className="text-[12px] text-[#626872]">
                            {n.friendlyName || formatNumberTypeLabel(n.type)} · Voice {voiceUiLabel(n)} ·
                            SMS {msg.label}
                          </div>
                        </div>
                        {selected ? (
                          <span className="text-[12px] font-semibold text-[#1f6b42]">Selected</span>
                        ) : (
                          <button
                            type="button"
                            className="mctb-setup-btn mctb-setup-btn--outline"
                            disabled={busy}
                            onClick={() => void selectNumber(n.id)}
                          >
                            Use this number
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary mt-5 w-full"
                onClick={() => onOpenMode?.("add")}
              >
                Add another number
              </button>
            </>
          ) : null}

          {open === "add" && !loading ? (
            <>
              <div className="mctb-num-step-dots" aria-hidden>
                <span className={`mctb-num-step-dot ${addStep === "choose" ? "is-active" : ""}`} />
                <span className={`mctb-num-step-dot ${addStep === "search" ? "is-active" : ""}`} />
                <span className={`mctb-num-step-dot ${addStep === "provision" ? "is-active" : ""}`} />
              </div>
              {addStep === "choose" ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    className="mctb-setup-btn mctb-setup-btn--primary w-full"
                    disabled={busy}
                    onClick={() => void provisionAuto()}
                  >
                    Assign recommended MCTB number
                  </button>
                  <button
                    type="button"
                    className="mctb-setup-btn mctb-setup-btn--outline w-full"
                    onClick={() => setAddStep("search")}
                  >
                    Search for a number
                  </button>
                </div>
              ) : null}
              {addStep === "search" ? (
                <div>
                  <label className="block text-[12px] font-semibold mb-1">Area code</label>
                  <input
                    className="mb-3 h-10 w-full rounded-lg border border-[#dde1e6] px-3 text-[13px]"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder="703"
                  />
                  <label className="block text-[12px] font-semibold mb-1">Number type</label>
                  <select
                    className="mb-3 h-10 w-full rounded-lg border border-[#dde1e6] px-3 text-[13px]"
                    value={numberType}
                    onChange={(e) => setNumberType(e.target.value as "local" | "toll_free")}
                  >
                    <option value="toll_free">Toll-free</option>
                    <option value="local">Local</option>
                  </select>
                  <button
                    type="button"
                    className="mctb-setup-btn mctb-setup-btn--primary w-full"
                    disabled={busy}
                    onClick={() => void runSearch()}
                  >
                    Search
                  </button>
                  {searchResults.map((r) => (
                    <div key={r.e164} className="mctb-num-search-row mt-2">
                      <div>
                        <div className="font-semibold">{displayNumber(r.e164)}</div>
                        <div className="text-[12px] text-[#626872]">
                          {r.locality || "—"} · {formatNumberTypeLabel(numberType)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mctb-setup-btn mctb-setup-btn--outline"
                        disabled={busy}
                        onClick={() => void purchaseResult(r.e164)}
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {addStep === "provision" ? (
                <p className="text-[13px] text-[#626872]">Getting your number…</p>
              ) : null}
            </>
          ) : null}

          {open === "verify" && !loading ? (
            <>
              <div className="mctb-num-step-dots" aria-hidden>
                <span className="mctb-num-step-dot is-active" />
                <span className="mctb-num-step-dot is-active" />
                <span className="mctb-num-step-dot" />
              </div>
              <section className="mb-4">
                <h3 className="text-[13px] font-semibold">Business</h3>
                <p className="mt-1 text-[13px] text-[#626872]">
                  Brand {complianceMeta?.brandStatus || "—"} · Campaign{" "}
                  {complianceMeta?.campaignStatus || "—"}
                </p>
                <Link href="/compliance/business" className="mt-2 inline-block text-[12px] font-semibold underline">
                  Edit business profile
                </Link>
              </section>
              <section className="mb-4">
                <h3 className="text-[13px] font-semibold">Messaging use</h3>
                <p className="mt-1 text-[13px] text-[#626872]">
                  Customer care and missed-call recovery (MCTB).
                </p>
                {complianceActions.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-[12.5px] text-[#626872]">
                    {complianceActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[12px] text-[#1f6b42]">Registration requirements look complete.</p>
                )}
                <Link href="/compliance/campaign" className="mt-2 inline-block text-[12px] font-semibold underline">
                  Edit campaign & samples
                </Link>
              </section>
              <section>
                <h3 className="text-[13px] font-semibold">Review</h3>
                <p className="mt-1 text-[13px] text-[#626872]">
                  Number {active ? displayNumber(active.e164) : "—"}
                </p>
                {tfv && !tfv.approved ? (
                  <p className="mt-2 text-[12px]">
                    Status: <span className={`mctb-num-pill mctb-num-pill--${tfvTone(tfv.status, tfv.approved)}`}>{tfv.statusLabel}</span>
                  </p>
                ) : null}
                {tfv?.failureReason ? (
                  <p className="mt-2 text-[12px] text-[#9b1c1c]">{tfv.failureReason}</p>
                ) : null}
              </section>
            </>
          ) : null}
        </div>

        {open === "verify" ? (
          <footer className="mctb-num-drawer__foot">
            <button
              type="button"
              className="mctb-setup-btn mctb-setup-btn--primary w-full"
              disabled={busy || tfv?.approved}
              onClick={() => void submitVerification()}
            >
              {tfv?.approved ? "Verification complete" : "Submit verification"}
            </button>
          </footer>
        ) : null}
      </aside>
      <VoiceProductSwitchDialog
        open={Boolean(voiceSwitchConflict)}
        conflict={voiceSwitchConflict}
        onCancel={() => {
          setVoiceSwitchConflict(null);
          setPendingSelectPhoneId(null);
        }}
        onConfirm={() => void confirmVoiceProductSwitch()}
        busy={busy}
      />
    </>
  );
}

export { useMctbNumberDrawerEvents } from "@/lib/mctb/numbers/mctb-number-drawer-controller";
