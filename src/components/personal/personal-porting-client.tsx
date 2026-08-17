"use client";

import { PortNumberForm } from "@/components/numbers/port-number-form";
import { EmptyState } from "@/components/ui/empty-state";
import { personalPortInStatusLabel } from "@/lib/numbers/port-constants";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_PORT_IN_STEPS,
  WIREFRAME_PORT_IN_STEPPER,
  WIREFRAME_PORT_OUT_REQUESTS,
  WIREFRAME_PORT_OUT_STEPS,
  WIREFRAME_PORT_OUT_STEPPER,
  WIREFRAME_PORT_REQUESTS,
  WIREFRAME_PORTING_SUMMARY,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Headphones,
  HelpCircle,
  Lightbulb,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PersonalMockAsideCard,
  PersonalMockBtn,
  PersonalMockCollapsedSteps,
  PersonalMockEligibilityBanner,
  PersonalMockHeader,
  PersonalMockHorizontalStepper,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockTabs,
  pm,
} from "./mockup/primitives";

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

function toneFromStatus(status: string): "blue" | "green" | "orange" | "purple" | "gray" {
  const s = status.toLowerCase();
  if (s.includes("complete") || s.includes("done")) return "green";
  if (s.includes("action") || s.includes("await")) return "orange";
  if (s.includes("schedule")) return "purple";
  if (s.includes("review") || s.includes("pending")) return "blue";
  return "gray";
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
  const [showPin, setShowPin] = useState(false);
  const [locked, setLocked] = useState(true);
  const [provider, setProvider] = useState<string>("telnyx");
  const [gainingCarrier, setGainingCarrier] = useState("");
  const [gainingAccountNumber, setGainingAccountNumber] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [portAck, setPortAck] = useState(false);
  const [notes, setNotes] = useState("");
  const [portMessage, setPortMessage] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [eligibility, setEligibility] = useState<{
    checked: boolean;
    eligible: boolean;
    count: number;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [portInStep, setPortInStep] = useState(0);

  const selected = numbers.find((n) => n.id === selectedId);
  const portOutRequests = portRequests.filter(
    (p) =>
      (p as { notes?: string }).notes?.includes("direction:out") || p.direction === "out",
  );
  const portInRequests = portRequests.filter(
    (p) => !portOutRequests.some((out) => out.id === p.id),
  );

  const useWireframe = usePersonalWireframe(
    tab === "in" ? portInRequests.length : portOutRequests.length,
  );

  const summary = useMemo(() => {
    const live = statusSummary(tab === "in" ? portInRequests : portOutRequests);
    if (!useWireframe) return live;
    return WIREFRAME_PORTING_SUMMARY;
  }, [tab, portInRequests, portOutRequests, useWireframe]);

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
      setEligibility({ checked: true, eligible: false, count: 0 });
      return;
    }
    setChecking(true);
    await new Promise((r) => setTimeout(r, 600));
    const valid = phones.every((p) => p.replace(/\D/g, "").length >= 10);
    setEligibility({ checked: true, eligible: valid, count: phones.length });
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
        "Port-out started. Use the account number and PIN below with your new carrier.",
      );
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Could not start port-out.");
    } finally {
      setSubmitting(false);
    }
  }

  const portInSidebar = (
    <>
      <PersonalMockAsideCard title="What You'll Need" icon={CheckCircle}>
        <ul className="space-y-2">
          {[
            "Recent bill or invoice",
            "Account number",
            "Porting PIN / passcode",
            "Service / billing address",
            "Authorized signature",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
              {item}
            </li>
          ))}
        </ul>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Important" icon={AlertTriangle} tone="warning">
        <p>
          <strong>Do not cancel</strong> your current service until your transfer completes.
        </p>
        <button type="button" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          Learn more
        </button>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Porting Tips" icon={Lightbulb}>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            Keep your account active until the port finishes
          </li>
          <li className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            PINs can expire — request a fresh one if needed
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
            Double-check account holder name matches your bill
          </li>
        </ul>
        <button type="button" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          View all tips &gt;
        </button>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Need Help?" icon={HelpCircle} tone="info">
        <PersonalMockBtn variant="outline" className="w-full gap-2">
          <Headphones className="h-4 w-4" />
          Contact Support
        </PersonalMockBtn>
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          View Porting Guide <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </PersonalMockAsideCard>
    </>
  );

  const portOutSidebar = (
    <>
      <PersonalMockAsideCard title="What You'll Need" icon={CheckCircle}>
        <ul className="space-y-2">
          {[
            "Destination carrier name",
            "Authorized contact info",
            "Port-out PIN",
            "Account verification",
            "Timing preferences",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#059669]" />
              {item}
            </li>
          ))}
        </ul>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Important" icon={AlertTriangle} tone="warning">
        <p>Porting out may interrupt service on your Transovo number until the transfer completes.</p>
        <button type="button" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          Learn more
        </button>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Port-Out Tips" icon={Lightbulb}>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            Verify PIN before submitting
          </li>
          <li className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            Confirm number is unlocked
          </li>
          <li className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            Keep access to authorized email
          </li>
        </ul>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Need Help?" icon={HelpCircle} tone="info">
        <PersonalMockBtn variant="outline" className="w-full gap-2">
          <Headphones className="h-4 w-4" />
          Contact Support
        </PersonalMockBtn>
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          View Porting Guide <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          Check PIN Status <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </PersonalMockAsideCard>
    </>
  );

  const portInTableRows = useWireframe
    ? WIREFRAME_PORT_REQUESTS
    : portInRequests.map((p) => ({
        id: p.id,
        phone: p.phoneNumber,
        status: personalPortInStatusLabel(p.status),
        statusTone: toneFromStatus(p.status),
        submitted: "—",
        confirmed: "—",
        action: "None",
        isDemo: false,
      }));

  const portOutTableRows = useWireframe
    ? WIREFRAME_PORT_OUT_REQUESTS
    : portOutRequests.map((p) => ({
        id: p.id,
        phone: p.phoneNumber,
        status: personalPortInStatusLabel(p.status),
        statusTone: toneFromStatus(p.status),
        submitted: "—",
        scheduled: "—",
        action: "None",
        isDemo: false,
      }));

  return (
    <PersonalMockPage right={tab === "in" ? portInSidebar : portOutSidebar}>
      <PersonalMockHeader
        title="Porting"
        description="Bring your existing numbers to Transovo or transfer your Transovo numbers elsewhere."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalMockKpi
          label="In Progress"
          value={summary.inProgress}
          sub="Requests"
          icon={Clock}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Action Required"
          value={summary.actionRequired}
          sub="Requests"
          icon={AlertTriangle}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Scheduled"
          value={summary.scheduled}
          sub="Requests"
          icon={Calendar}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Completed"
          value={summary.completed}
          sub={useWireframe ? WIREFRAME_PORTING_SUMMARY.completedSub : "Requests"}
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
          <div className={cn(pm.card, "p-5 space-y-5")}>
            <PersonalMockHorizontalStepper steps={WIREFRAME_PORT_IN_STEPPER} activeIndex={portInStep} />
            <div>
              <h3 className="text-[16px] font-bold text-[#111827]">1. Bring Your Number</h3>
              <p className="mt-1 text-[13px] text-[#6b7280]">
                Enter one or more numbers you want to port to Transovo.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <label className="flex items-center gap-1 text-[13px] font-semibold text-[#374151]">
                  Phone number(s)
                  <HelpCircle className="h-3.5 w-3.5 text-[#9ca3af]" />
                </label>
                <textarea
                  className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#2563eb]"
                  rows={5}
                  placeholder="Paste numbers here, one per line or comma separated"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setEligibility(null);
                  }}
                />
                <p className="mt-2 text-[11px] text-[#9ca3af]">
                  Example: +1 (571) 407-3615, +1 (866) 346-4256
                </p>
                <PersonalMockBtn className="mt-3" onClick={checkPortability} disabled={checking}>
                  {checking ? "Checking…" : "Check Portability"}
                </PersonalMockBtn>
              </div>
              {eligibility?.checked && eligibility.eligible ? (
                <PersonalMockEligibilityBanner
                  eligible
                  title="Eligible to transfer"
                  message={`All ${eligibility.count} number(s) can be ported to Transovo`}
                  linkLabel="View eligibility details"
                />
              ) : eligibility?.checked ? (
                <PersonalMockEligibilityBanner
                  eligible={false}
                  title="Not eligible"
                  message="One or more numbers could not be validated. Check formatting and try again."
                />
              ) : (
                <PersonalMockEligibilityBanner
                  eligible
                  title="Eligible to transfer"
                  message="All 1 number(s) can be ported to Transovo"
                  linkLabel="View eligibility details"
                />
              )}
            </div>
            {eligibility?.eligible ? (
              <div className="border-t border-[#f3f4f6] pt-4">
                <PortNumberForm />
              </div>
            ) : null}
          </div>

          <PersonalMockCollapsedSteps steps={WIREFRAME_PORT_IN_STEPS.slice(1)} />

          <PersonalMockSection title="Existing Port Requests">
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-3">Number</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Submitted</th>
                    <th className="pb-3 pr-3">Confirmed Date</th>
                    <th className="pb-3 pr-3">Action Required</th>
                    <th className="pb-3 pr-3">View Details</th>
                    <th className="pb-3 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {portInTableRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 pr-3 font-semibold text-[#111827]">
                        {formatPhone(row.phone)}
                      </td>
                      <td className="py-3 pr-3">
                        <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.submitted}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.confirmed}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.action}</td>
                      <td className="py-3 pr-3">
                        <button type="button" className="text-[12px] font-semibold text-[#2563eb]">
                          View Details
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" className="rounded p-1 hover:bg-[#f3f4f6]">
                          <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="mt-4 text-[13px] font-semibold text-[#2563eb]">
              View all port requests &gt;
            </button>
          </PersonalMockSection>
        </div>
      ) : (
        <div className="space-y-6">
          {numbers.length === 0 ? (
            <EmptyState title="No numbers" description="Add a number before starting a port away." />
          ) : (
            <>
              <div className={cn(pm.card, "p-5 space-y-5")}>
                <PersonalMockHorizontalStepper steps={WIREFRAME_PORT_OUT_STEPPER} activeIndex={0} />
                <div>
                  <h3 className="text-[16px] font-bold text-[#111827]">1. Transfer Your Number</h3>
                  <p className="mt-1 text-[13px] text-[#6b7280]">
                    Provide credentials and new carrier details to port out.
                  </p>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[13px] font-semibold text-[#374151]">
                        Phone Number(s) to Port Out
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e7eb] p-2">
                        {selected ? (
                          <span className="rounded-md bg-[#eff6ff] px-2.5 py-1 text-[12px] font-semibold text-[#2563eb]">
                            {formatPhone(selected.number)}
                          </span>
                        ) : null}
                        {numbers.length > 1 ? (
                          <select
                            className="min-w-[140px] flex-1 border-0 bg-transparent text-[12px] text-[#6b7280] outline-none"
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
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">
                        Account Number (Transfer Account Reference)
                      </label>
                      <PersonalMockInput
                        className="mt-1 font-mono"
                        value={loadingCreds ? "Loading…" : accountNumber || "ACME-654321"}
                        readOnly
                      />
                      <p className="mt-1 text-[11px] text-[#9ca3af]">
                        Used to validate your account for the transfer.
                      </p>
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Port-Out PIN (Transfer PIN)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <PersonalMockInput
                          className="font-mono"
                          type={showPin && portPin ? "text" : "password"}
                          value={locked ? "••••••" : portPin || "—"}
                          readOnly
                        />
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-[#2563eb]"
                          onClick={() => setShowPin((v) => !v)}
                        >
                          Show
                        </button>
                        <PersonalMockBtn
                          variant="ghost"
                          className="h-8 px-2 text-[12px]"
                          disabled={submitting}
                          onClick={() => {
                            if (locked) portAction("unlock");
                            else portAction("sync");
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Regenerate
                        </PersonalMockBtn>
                      </div>
                      <p className="mt-1 text-[11px] text-[#9ca3af]">
                        Required by your new carrier to authorize the transfer.
                      </p>
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Authorized Contact Email</label>
                      <PersonalMockInput
                        className="mt-1"
                        placeholder="name@company.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">
                        Preferred Transfer Date (Optional)
                      </label>
                      <PersonalMockInput
                        className="mt-1"
                        type="date"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                      />
                    </div>
                    <label className="flex items-start gap-2 text-[12px] text-[#6b7280]">
                      <input
                        type="checkbox"
                        checked={portAck}
                        onChange={(e) => setPortAck(e.target.checked)}
                        className="mt-0.5"
                      />
                      I understand that porting out may interrupt service on this number until the
                      transfer completes.
                    </label>
                    <PersonalMockBtn
                      className="w-full"
                      onClick={initiatePortOut}
                      disabled={submitting || !portAck}
                    >
                      {submitting ? "Submitting…" : "Start Port Out Request"}
                    </PersonalMockBtn>
                  </div>
                  <div className="space-y-4">
                    <PersonalMockEligibilityBanner
                      eligible
                      title="Eligible to transfer"
                      message="Selected number(s) are eligible to be ported out."
                      linkLabel="View eligibility details"
                    />
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Destination (New Carrier)</label>
                      <PersonalMockInput
                        className="mt-1"
                        placeholder="Enter new carrier name"
                        value={gainingCarrier}
                        onChange={(e) => setGainingCarrier(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Authorized Contact Name</label>
                      <PersonalMockInput
                        className="mt-1"
                        placeholder="Enter full name"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6b7280]">Authorized Contact Phone</label>
                      <div className="relative mt-1">
                        <span
                          className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[12px] text-[#6b7280]"
                          aria-hidden
                        >
                          <span className="text-[14px] leading-none">🇺🇸</span>
                        </span>
                        <PersonalMockInput
                          className="pl-10"
                          placeholder="+1 (555) 123-4567"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <PersonalMockCollapsedSteps steps={WIREFRAME_PORT_OUT_STEPS.slice(1)} />

              {portMessage ? (
                <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[13px] text-[#1d4ed8]">
                  {portMessage}
                </div>
              ) : null}

              <PersonalMockSection title="Existing Port-Out Requests">
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                        <th className="pb-3 pr-3">Number</th>
                        <th className="pb-3 pr-3">Status</th>
                        <th className="pb-3 pr-3">Submitted</th>
                        <th className="pb-3 pr-3">Scheduled Transfer</th>
                        <th className="pb-3 pr-3">Action Required</th>
                        <th className="pb-3 pr-3">View Details</th>
                        <th className="pb-3 text-right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {portOutTableRows.map((row) => (
                        <tr key={row.id}>
                          <td className="py-3 pr-3 font-semibold text-[#111827]">
                            {formatPhone(row.phone)}
                          </td>
                          <td className="py-3 pr-3">
                            <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">{row.submitted}</td>
                          <td className="py-3 pr-3 text-[#6b7280]">{row.scheduled}</td>
                          <td className="py-3 pr-3 text-[#6b7280]">{row.action}</td>
                          <td className="py-3 pr-3">
                            <button type="button" className="text-[12px] font-semibold text-[#2563eb]">
                              View Details
                            </button>
                          </td>
                          <td className="py-3 text-right">
                            <button type="button" className="rounded p-1 hover:bg-[#f3f4f6]">
                              <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="mt-4 text-[13px] font-semibold text-[#2563eb]">
                  View all port-out requests &gt;
                </button>
              </PersonalMockSection>
            </>
          )}
        </div>
      )}
    </PersonalMockPage>
  );
}
