"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { portOutStatusLabel } from "@/lib/numbers/port-out-constants";
import { cn, formatPhone } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Copy, Lock, RefreshCw, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PersonalMockBtn,
  PersonalMockEligibilityBanner,
  PersonalMockInput,
  PersonalMockPill,
  PersonalMockSection,
  pm,
} from "./mockup/primitives";

type DestinationOption = {
  value: string;
  label: string;
  warningType: string;
  warningMessage: string | null;
  directPortSupport: string;
};

type PortOutRequestRow = {
  id: string;
  phoneNumberId: string;
  phone: string;
  status: string;
  statusLabel: string;
  destinationCarrier: string | null;
  destinationLabel: string | null;
  guaranteeEligible: boolean;
  customerActionRequired: boolean;
  initiatedAt: string | null;
  focDate: string | null;
  rejectionMessage: string | null;
};

type PacketField = { key: string; label: string; value: string; copyable: boolean };

type Packet = {
  phoneNumber: string;
  friendlyName: string | null;
  accountHolderName: string;
  accountNumber: string;
  portPin: string | null;
  billingPhone: string | null;
  serviceAddress: string | null;
  locked: boolean;
  fields: PacketField[];
};

export function PersonalPortOutFlow({
  numbers,
  initialNumberId,
  portOutRequests: initialRequests,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
  portOutRequests: PortOutRequestRow[];
}) {
  const [selectedId, setSelectedId] = useState(initialNumberId || numbers[0]?.id || "");
  const [step, setStep] = useState(0);
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [destinationType, setDestinationType] = useState("");
  const [destinationCarrier, setDestinationCarrier] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [packet, setPacket] = useState<Packet | null>(null);
  const [requests, setRequests] = useState<PortOutRequestRow[]>(initialRequests);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [startedAck, setStartedAck] = useState(false);

  const selected = numbers.find((n) => n.id === selectedId);
  const destination = destinations.find((d) => d.value === destinationType);
  const activeRequest = requests.find(
    (r) => r.phoneNumberId === selectedId && !["COMPLETED", "CANCELED"].includes(r.status),
  );

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/personal/port-out");
    const j = await res.json().catch(() => ({}));
    if (j.data?.destinations) setDestinations(j.data.destinations);
    if (j.data?.requests) setRequests(j.data.requests);
  }, []);

  const loadPacket = useCallback(async (numberId: string) => {
    if (!numberId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/personal/numbers/${numberId}/port-out`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not load port-out information.");
      setPacket(j.data as Packet);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed.");
      setPacket(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (selectedId) loadPacket(selectedId);
  }, [selectedId, loadPacket]);

  const destinationWarning = destination?.warningMessage;

  async function portAction(action: "unlock" | "lock" | "sync") {
    if (!selectedId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/personal/numbers/${selectedId}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Update failed.");
      if (j.data?.packet) setPacket(j.data.packet as Packet);
      setMessage(
        action === "lock"
          ? "Port-out PIN hidden. Unlock to share with your new carrier."
          : action === "unlock"
            ? "Credentials revealed. Share only with your gaining carrier."
            : "Port-out information refreshed.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function startTransfer() {
    if (!selectedId || !destinationType) {
      setMessage("Select where you are transferring this number.");
      return;
    }
    if (!startedAck) {
      setMessage("Confirm you have started the transfer with your new carrier.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/personal/port-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: selectedId,
          destinationType,
          destinationCarrier: destinationCarrier.trim() || destination?.label,
          authorizedContactEmail: authEmail.trim() || undefined,
          authorizedContactName: authName.trim() || undefined,
          authorizedContactPhone: authPhone.trim() || undefined,
          preferredTransferDate: transferDate || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not record your transfer.");
      if (j.data?.packet) setPacket(j.data.packet as Packet);
      await loadMeta();
      setMessage(
        "Transfer recorded. Your new carrier must submit the port request. Your Transovo number stays active until completion.",
      );
      setStep(3);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not record transfer.");
    } finally {
      setLoading(false);
    }
  }

  function copyValue(value: string) {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setMessage("Copied to clipboard.");
  }

  const stepLabels = ["Choose number", "Destination", "Porting info", "Status"];

  if (!numbers.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className={cn(pm.card, "p-5 bg-gradient-to-br from-[#f8fafc] to-white")}>
        <p className="text-[15px] font-semibold text-[#111827]">Your number. Use it where you want.</p>
        <p className="mt-1 text-[13px] text-[#6b7280]">
          Port out to another carrier, keep it in Transovo Vault, forward it, or use voicemail — you
          choose.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {stepLabels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold",
              step === i ? "bg-[#2563eb] text-white" : "bg-[#f3f4f6] text-[#6b7280]",
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-[13px] text-[#374151]">
          {message}
        </div>
      ) : null}

      {step === 0 && (
        <div className={cn(pm.card, "p-5 space-y-4")}>
          <h3 className="text-[16px] font-bold text-[#111827]">Select your number</h3>
          <select
            className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {formatPhone(n.number)}
                {n.friendlyName ? ` — ${n.friendlyName}` : ""}
              </option>
            ))}
          </select>
          {activeRequest ? (
            <PersonalMockEligibilityBanner
              eligible
              title="Transfer in progress"
              message={`Status: ${activeRequest.statusLabel}`}
            />
          ) : (
            <PersonalMockEligibilityBanner
              eligible
              title="Ready to transfer"
              message="This number can be ported to another carrier when you are ready."
            />
          )}
          <PersonalMockBtn onClick={() => setStep(1)} disabled={!selectedId}>
            Continue
          </PersonalMockBtn>
        </div>
      )}

      {step === 1 && (
        <div className={cn(pm.card, "p-5 space-y-4")}>
          <h3 className="text-[16px] font-bold text-[#111827]">
            Where are you transferring this number?
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {destinations.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDestinationType(d.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-[13px]",
                  destinationType === d.value
                    ? "border-[#2563eb] bg-[#eff6ff]"
                    : "border-[#e5e7eb] hover:border-[#cbd5e1]",
                )}
              >
                <span className="font-semibold text-[#111827]">{d.label}</span>
                {d.directPortSupport === "unsupported" ? (
                  <span className="mt-1 block text-[11px] text-[#ea580c]">Direct port may not work</span>
                ) : null}
              </button>
            ))}
          </div>
          {destinationWarning ? (
            <div className="flex gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3 text-[13px] text-[#9a3412]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{destinationWarning}</p>
            </div>
          ) : null}
          <PersonalMockInput
            className="mt-1"
            value={destinationCarrier}
            onChange={(e) => setDestinationCarrier(e.target.value)}
            placeholder="e.g. Verizon store #1234"
          />
          <div className="flex gap-2">
            <PersonalMockBtn variant="outline" onClick={() => setStep(0)}>Back</PersonalMockBtn>
            <PersonalMockBtn onClick={() => setStep(2)} disabled={!destinationType}>
              Continue
            </PersonalMockBtn>
          </div>
        </div>
      )}

      {step === 2 && packet && (
        <div className={cn(pm.card, "p-5 space-y-4")}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-[#111827]">Transovo port-out information</h3>
            <div className="flex gap-2">
              <PersonalMockBtn variant="outline" className="gap-1" onClick={() => portAction("sync")} disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </PersonalMockBtn>
              {packet.locked ? (
                <PersonalMockBtn variant="outline" className="gap-1" onClick={() => portAction("unlock")} disabled={loading}>
                  <Unlock className="h-3.5 w-3.5" /> Unlock PIN
                </PersonalMockBtn>
              ) : (
                <PersonalMockBtn variant="outline" className="gap-1" onClick={() => portAction("lock")} disabled={loading}>
                  <Lock className="h-3.5 w-3.5" /> Hide PIN
                </PersonalMockBtn>
              )}
            </div>
          </div>
          <p className="text-[13px] text-[#6b7280]">
            Give these details to your <strong>new carrier</strong>. Do not cancel or release your
            Transovo number before the transfer completes.
          </p>
          <div className="space-y-3">
            {packet.fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 rounded-lg border border-[#f3f4f6] px-3 py-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    {field.label}
                  </p>
                  <p className="text-[14px] font-semibold text-[#111827]">{field.value}</p>
                </div>
                {field.copyable ? (
                  <button
                    type="button"
                    className="rounded p-2 hover:bg-[#f3f4f6]"
                    onClick={() => copyValue(field.value)}
                    aria-label="Copy"
                  >
                    <Copy className="h-4 w-4 text-[#6b7280]" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] text-[#6b7280]">Authorized contact email</label>
              <PersonalMockInput className="mt-1" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] text-[#6b7280]">Authorized contact name</label>
              <PersonalMockInput className="mt-1" value={authName} onChange={(e) => setAuthName(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] text-[#6b7280]">Authorized contact phone</label>
              <PersonalMockInput className="mt-1" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] text-[#6b7280]">Preferred transfer date</label>
              <PersonalMockInput className="mt-1" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-[13px] text-[#374151]">
            <input type="checkbox" checked={startedAck} onChange={(e) => setStartedAck(e.target.checked)} className="mt-1" />
            <span>
              I have started my transfer with my new carrier using the information above.
            </span>
          </label>
          <div className="flex gap-2">
            <PersonalMockBtn variant="outline" onClick={() => setStep(1)}>Back</PersonalMockBtn>
            <PersonalMockBtn onClick={startTransfer} disabled={loading || !!activeRequest}>
              I&apos;ve Started My Transfer
            </PersonalMockBtn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={cn(pm.card, "p-5 space-y-4")}>
          <h3 className="text-[16px] font-bold text-[#111827]">Transfer status</h3>
          {activeRequest ? (
            <div className="space-y-3">
              <PersonalMockPill tone="blue">{activeRequest.statusLabel}</PersonalMockPill>
              <p className="text-[13px] text-[#6b7280]">
                Your new carrier must submit the transfer request. Your Transovo number remains
                active until the transfer completes.
              </p>
              {activeRequest.focDate ? (
                <p className="text-[13px] font-semibold text-[#111827]">
                  Scheduled: {new Date(activeRequest.focDate).toLocaleDateString()}
                </p>
              ) : null}
              {activeRequest.rejectionMessage ? (
                <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3 text-[13px]">
                  {activeRequest.rejectionMessage}
                </div>
              ) : null}
              {activeRequest.guaranteeEligible ? (
                <p className="text-[12px] text-[#6b7280]">
                  30-Day Portability Guarantee may apply if your carrier cannot accept this number.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-[#6b7280]">
              No active transfer on this number. Complete step 3 to record your transfer.
            </p>
          )}
        </div>
      )}

      <PersonalMockSection title="Your port-out requests">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                <th className="pb-3 pr-3">Number</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3 pr-3">Destination</th>
                <th className="pb-3 pr-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {requests.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-3 font-semibold">{formatPhone(row.phone)}</td>
                  <td className="py-3 pr-3">
                    <PersonalMockPill tone={row.customerActionRequired ? "orange" : "blue"}>
                      {row.statusLabel}
                    </PersonalMockPill>
                  </td>
                  <td className="py-3 pr-3 text-[#6b7280]">
                    {row.destinationLabel || row.destinationCarrier || "—"}
                  </td>
                  <td className="py-3 pr-3 text-[#6b7280]">
                    {row.initiatedAt ? new Date(row.initiatedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PersonalMockSection>
    </div>
  );
}
