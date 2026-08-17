"use client";

import { PortNumberForm } from "@/components/numbers/port-number-form";
import { EmptyState } from "@/components/ui/empty-state";
import { personalPortInStatusLabel } from "@/lib/numbers/port-constants";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PersonalMockAsideCard,
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockTabs,
  PersonalMockInput,
  pm,
} from "./mockup/primitives";

const PORT_IN_STEPS = [
  "Enter Numbers",
  "Check Eligibility",
  "Account Information",
  "Upload Documents",
  "Authorize Transfer",
  "Review & Submit",
  "Carrier Review",
  "Schedule Port Date",
  "Activation Complete",
];

const PORT_OUT_STEPS = [
  "Select Number",
  "Unlock Credentials",
  "New Carrier Details",
  "Submit Request",
  "Transfer Window",
  "Port Complete",
];

function providerLabel(provider?: string) {
  if (provider === "twilio") return "Twilio";
  if (provider === "telnyx") return "Telnyx";
  return "carrier";
}

function statusSummary(requests: Array<{ status: string }>) {
  const inProgress = requests.filter((p) =>
    ["submitted", "in_progress", "pending"].includes(p.status),
  ).length;
  const actionRequired = requests.filter((p) =>
    ["docs_needed", "rejected"].includes(p.status),
  ).length;
  const scheduled = requests.filter((p) => p.status === "foc_confirmed").length;
  const completed = requests.filter((p) => p.status === "completed").length;
  return { inProgress, actionRequired, scheduled, completed };
}

function StepAccordion({
  steps,
  activeStep,
  children,
}: {
  steps: string[];
  activeStep: number;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(activeStep);

  return (
    <div className="space-y-2">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === activeStep;
        const isDone = stepNum < activeStep;
        const isOpen = expanded === stepNum;
        return (
          <div
            key={label}
            className={cn(
              pm.card,
              "overflow-hidden",
              isActive && "ring-2 ring-[#6366f1]/30",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setExpanded(isOpen ? 0 : stepNum)}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  isDone
                    ? "bg-[#059669] text-white"
                    : isActive
                      ? "bg-[#6366f1] text-white"
                      : "bg-[#f3f4f6] text-[#9ca3af]",
                )}
              >
                {isDone ? <CheckCircle className="h-4 w-4" /> : stepNum}
              </span>
              <span
                className={cn(
                  "flex-1 text-[14px] font-semibold",
                  isActive ? "text-[#6366f1]" : "text-[#111827]",
                )}
              >
                {label}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
              )}
            </button>
            {isOpen && isActive && children ? (
              <div className="border-t border-[#f3f4f6] px-4 py-4">{children}</div>
            ) : null}
            {isOpen && !isActive ? (
              <div className="border-t border-[#f3f4f6] px-4 py-3 text-[12px] text-[#9ca3af]">
                {isDone ? "Completed" : "Complete previous steps first"}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PersonalPortingClient({
  numbers,
  portRequests,
}: {
  numbers: PersonalNumberRow[];
  portRequests: Array<{ id: string; phoneNumber: string; status: string; direction?: string }>;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "out" ? "out" : "in";
  const [tab, setTab] = useState<"in" | "out">(initialTab);
  const initialNumberId = searchParams.get("numberId") || numbers[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initialNumberId);
  const [accountNumber, setAccountNumber] = useState("");
  const [portPin, setPortPin] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [provider, setProvider] = useState<string>("telnyx");
  const [gainingCarrier, setGainingCarrier] = useState("");
  const [gainingAccountNumber, setGainingAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [portMessage, setPortMessage] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [eligibility, setEligibility] = useState<{
    checked: boolean;
    eligible: boolean;
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [portInStep, setPortInStep] = useState(1);

  const selected = numbers.find((n) => n.id === selectedId);
  const portOutRequests = portRequests.filter(
    (p) =>
      (p as { notes?: string }).notes?.includes("direction:out") || p.direction === "out",
  );
  const portInRequests = portRequests.filter(
    (p) => !portOutRequests.some((out) => out.id === p.id),
  );

  const summary = useMemo(
    () => statusSummary(tab === "in" ? portInRequests : portOutRequests),
    [tab, portInRequests, portOutRequests],
  );

  useEffect(() => {
    if (!selectedId) return;
    setLoadingCreds(true);
    fetch(`/api/personal/numbers/${selectedId}/port-out`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
        setPortPin(j.data?.locked ? null : j.data?.pin || null);
        setLocked(j.data?.locked ?? true);
        if (j.data?.provider) setProvider(j.data.provider);
      })
      .catch(() => undefined)
      .finally(() => setLoadingCreds(false));
  }, [selectedId]);

  async function checkPortability() {
    const phones = phoneInput
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      setEligibility({
        checked: true,
        eligible: false,
        message: "Enter at least one phone number to check.",
      });
      return;
    }
    setChecking(true);
    await new Promise((r) => setTimeout(r, 600));
    const valid = phones.every((p) => p.replace(/\D/g, "").length >= 10);
    setEligibility({
      checked: true,
      eligible: valid,
      message: valid
        ? `${phones.length} number(s) appear eligible for porting. Complete the form below to submit.`
        : "One or more numbers could not be validated. Check formatting and try again.",
    });
    setChecking(false);
  }

  async function portAction(action: "unlock" | "lock" | "sync") {
    if (!selectedId) return;
    setSubmitting(true);
    setPortMessage(null);
    try {
      const res = await fetch(`/api/personal/numbers/${selectedId}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Port-out update failed.");
      if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
      if (j.data?.pin) setPortPin(j.data.pin);
      if (action === "lock") {
        setLocked(true);
        setPortPin(null);
        setPortMessage("Number locked for port-out.");
      } else if (action === "unlock") {
        setLocked(false);
        setPortPin(j.data?.pin || null);
        setPortMessage("Port-out credentials revealed. Share with your new carrier.");
      } else {
        setPortMessage(`Synced from ${providerLabel(j.data?.provider || provider)}.`);
        if (j.data?.provider) setProvider(j.data.provider);
      }
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function initiatePortOut() {
    if (!selectedId) return;
    if (!gainingCarrier.trim()) {
      setPortMessage("Enter your new carrier name before submitting.");
      return;
    }
    setSubmitting(true);
    setPortMessage(null);
    try {
      const res = await fetch(`/api/personal/numbers/${selectedId}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          gainingCarrier: gainingCarrier.trim(),
          gainingAccountNumber: gainingAccountNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not start port-out.");
      if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
      if (j.data?.pin) {
        setPortPin(j.data.pin);
        setLocked(false);
      }
      if (j.data?.provider) setProvider(j.data.provider);
      setPortMessage(
        "Port-out started. Use the account number and PIN below with your new carrier. Transfer window is open for 7 days.",
      );
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Could not start port-out.");
    } finally {
      setSubmitting(false);
    }
  }

  const sidebar = (
    <>
      <PersonalMockAsideCard title="What You'll Need" icon={CheckCircle}>
        <ul className="list-inside list-disc space-y-1">
          <li>Current carrier account number</li>
          <li>Account PIN or passcode</li>
          <li>Billing phone number on file</li>
          <li>Authorized contact name</li>
          <li>Service address (for landlines)</li>
        </ul>
      </PersonalMockAsideCard>

      <PersonalMockAsideCard title="Important" icon={AlertTriangle} tone="warning">
        <p>
          <strong>Do not cancel</strong> service with your current carrier until your port to
          Transovo is completed. Cancelling first can cause the number to be lost.
        </p>
      </PersonalMockAsideCard>

      <PersonalMockAsideCard title="Tips" icon={Lightbulb}>
        <ul className="list-inside list-disc space-y-1">
          <li>Ports typically take 3–10 business days</li>
          <li>Keep your old phone active during the transfer</li>
          <li>Set up a temporary forward number if needed</li>
          <li>Double-check account details match your carrier bill</li>
        </ul>
      </PersonalMockAsideCard>

      <PersonalMockAsideCard title="Need Help?" icon={HelpCircle} tone="info">
        <p>Our support team can help with port status and carrier issues.</p>
        <Link href="/support" className="mt-2 inline-block font-semibold text-[#6366f1]">
          Contact Support →
        </Link>
      </PersonalMockAsideCard>
    </>
  );

  return (
    <PersonalMockPage right={sidebar}>
      <PersonalMockHeader
        title="Porting"
        description="Bring your existing numbers to Transovo or transfer your Transovo numbers elsewhere."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalMockKpi
          label="In Progress"
          value={summary.inProgress}
          icon={Clock}
          iconClass="bg-[#eef2ff] text-[#6366f1]"
        />
        <PersonalMockKpi
          label="Action Required"
          value={summary.actionRequired}
          icon={AlertTriangle}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Scheduled"
          value={summary.scheduled}
          icon={Calendar}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Completed"
          value={summary.completed}
          icon={CheckCircle}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
      </div>

      <PersonalMockTabs
        tabs={[
          { id: "in", label: "Port In", icon: ArrowDownToLine },
          { id: "out", label: "Port Out", icon: ArrowUpFromLine },
        ]}
        active={tab}
        onChange={(id) => setTab(id as "in" | "out")}
      />

      {tab === "in" ? (
        <div className="space-y-6">
          <StepAccordion steps={PORT_IN_STEPS} activeStep={portInStep}>
            {portInStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-semibold text-[#374151]">
                    Phone numbers to port
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#6366f1]"
                    rows={4}
                    placeholder="Enter one number per line, e.g.&#10;+1 (555) 123-4567&#10;+1 (555) 987-6543"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setEligibility(null);
                      setPortInStep(1);
                    }}
                  />
                </div>
                <PersonalMockBtn onClick={checkPortability} disabled={checking}>
                  {checking ? "Checking…" : "Check Portability"}
                </PersonalMockBtn>
                {eligibility?.checked ? (
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-[13px]",
                      eligibility.eligible
                        ? "border-[#bbf7d0] bg-[#ecfdf5] text-[#059669]"
                        : "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]",
                    )}
                  >
                    {eligibility.message}
                    {eligibility.eligible ? (
                      <PersonalMockBtn
                        className="mt-3"
                        onClick={() => setPortInStep(3)}
                      >
                        Continue to account details
                      </PersonalMockBtn>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : portInStep === 3 ? (
              <div className="space-y-3">
                <p className={pm.muted}>
                  Complete carrier account details to submit your port-in request.
                </p>
                <PortNumberForm />
              </div>
            ) : null}
          </StepAccordion>

          <PersonalMockSection title="Existing Port Requests">
            {portInRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                      <th className="pb-2 text-left">Number</th>
                      <th className="pb-2 text-left">Status</th>
                      <th className="pb-2 text-left">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portInRequests.map((p) => (
                      <tr key={p.id} className="border-b border-[#f9fafb]">
                        <td className="py-2.5 font-medium text-[#111827]">
                          {formatPhone(p.phoneNumber)}
                        </td>
                        <td className="py-2.5">
                          <PersonalMockPill
                            tone={
                              p.status === "completed"
                                ? "green"
                                : p.status === "rejected" || p.status === "docs_needed"
                                  ? "orange"
                                  : "blue"
                            }
                          >
                            {personalPortInStatusLabel(p.status)}
                          </PersonalMockPill>
                        </td>
                        <td className="py-2.5 text-[#6b7280]">
                          {personalPortInStatusLabel(p.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={pm.muted}>No port-in requests yet.</p>
            )}
          </PersonalMockSection>
        </div>
      ) : (
        <div className="space-y-6">
          {numbers.length === 0 ? (
            <EmptyState
              title="No numbers"
              description="Add a number before starting a port away."
            />
          ) : (
            <>
              <StepAccordion steps={PORT_OUT_STEPS} activeStep={1}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] font-semibold text-[#374151]">
                      Number to port out
                    </label>
                    <select
                      className="mt-2 block w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
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
                  </div>

                  {selected ? (
                    <p className="text-[12px] text-[#6b7280]">
                      Carrier: {providerLabel(provider)} · Status: {selected.serviceLabel}
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-[#f9fafb] p-3">
                      <p className="text-[11px] text-[#9ca3af]">Account number</p>
                      <p className="font-mono text-[13px] font-semibold text-[#111827]">
                        {loadingCreds ? "Loading…" : accountNumber || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f9fafb] p-3">
                      <p className="text-[11px] text-[#9ca3af]">Port-out PIN</p>
                      <p className="font-mono text-[13px] font-semibold text-[#111827]">
                        {locked ? "Locked — unlock to reveal" : portPin || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {locked ? (
                      <PersonalMockBtn
                        variant="outline"
                        onClick={() => portAction("unlock")}
                        disabled={submitting}
                      >
                        Unlock for port-out
                      </PersonalMockBtn>
                    ) : (
                      <PersonalMockBtn
                        variant="outline"
                        onClick={() => portAction("lock")}
                        disabled={submitting}
                      >
                        Lock number
                      </PersonalMockBtn>
                    )}
                    <PersonalMockBtn
                      variant="ghost"
                      onClick={() => portAction("sync")}
                      disabled={submitting}
                    >
                      Sync from {providerLabel(provider)}
                    </PersonalMockBtn>
                  </div>

                  <div className="border-t border-[#f3f4f6] pt-4 space-y-3">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      New carrier details
                    </p>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">New carrier name</label>
                      <PersonalMockInput
                        className="mt-1"
                        placeholder="Verizon, AT&T, T-Mobile…"
                        value={gainingCarrier}
                        onChange={(e) => setGainingCarrier(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">
                        Account number at new carrier (optional)
                      </label>
                      <PersonalMockInput
                        className="mt-1"
                        placeholder="If your new carrier gave you an account number"
                        value={gainingAccountNumber}
                        onChange={(e) => setGainingAccountNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Notes (optional)</label>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                    <PersonalMockBtn
                      onClick={initiatePortOut}
                      disabled={submitting || !selectedId}
                    >
                      {submitting ? "Submitting…" : "Submit port-out request"}
                    </PersonalMockBtn>
                    {provider === "twilio" ? (
                      <p className="text-[11px] text-[#9ca3af]">
                        US local Twilio numbers may require a carrier-specific PIN from Twilio
                        support.
                      </p>
                    ) : null}
                  </div>
                </div>
              </StepAccordion>

              {portMessage ? (
                <div className="rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3 text-[13px] text-[#4338ca]">
                  {portMessage}
                </div>
              ) : null}

              <PersonalMockSection title="Existing Port-Out Requests">
                {portOutRequests.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                          <th className="pb-2 text-left">Number</th>
                          <th className="pb-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portOutRequests.map((p) => (
                          <tr key={p.id} className="border-b border-[#f9fafb]">
                            <td className="py-2.5 font-medium text-[#111827]">
                              {formatPhone(p.phoneNumber)}
                            </td>
                            <td className="py-2.5">
                              <PersonalMockPill tone="blue">
                                {personalPortInStatusLabel(p.status)}
                              </PersonalMockPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={pm.muted}>No port-out requests yet.</p>
                )}
              </PersonalMockSection>

              {selectedId ? (
                <p className={pm.muted}>
                  <Link href={`/personal/numbers/${selectedId}`} className="text-[#6366f1]">
                    View number details →
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </PersonalMockPage>
  );
}