"use client";

import { PortNumberForm } from "@/components/numbers/port-number-form";
import { PersonalPortOutFlow } from "@/components/personal/personal-port-out-flow";
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
import Link from "next/link";
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
  portOutRequests: portOutRequestRows = [],
}: {
  numbers: PersonalNumberRow[];
  portRequests: Array<{ id: string; phoneNumber: string; status: string; direction?: string }>;
  portOutRequests?: Array<{
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
  }>;
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
  const legacyPortOutRequests = portRequests.filter(
    (p) =>
      (p as { notes?: string }).notes?.includes("direction:out") || p.direction === "out",
  );
  const portInRequests = portRequests.filter(
    (p) => !legacyPortOutRequests.some((out) => out.id === p.id),
  );

  const useWireframe = usePersonalWireframe(
    tab === "in" ? portInRequests.length : legacyPortOutRequests.length,
  );

  const summary = useMemo(() => {
    const live = statusSummary(tab === "in" ? portInRequests : legacyPortOutRequests);
    if (!useWireframe) return live;
    return WIREFRAME_PORTING_SUMMARY;
  }, [tab, portInRequests, legacyPortOutRequests, useWireframe]);

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
        <Link href="/contact" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          Learn more
        </Link>
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
        <Link href="/contact" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          View all tips &gt;
        </Link>
      </PersonalMockAsideCard>
      <PersonalMockAsideCard title="Need Help?" icon={HelpCircle} tone="info">
        <Link href="/contact">
          <PersonalMockBtn variant="outline" className="w-full gap-2">
            <Headphones className="h-4 w-4" />
            Contact Support
          </PersonalMockBtn>
        </Link>
        <Link
          href="/contact"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          View Porting Guide <ExternalLink className="h-3.5 w-3.5" />
        </Link>
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
        <p>
          Do not cancel or release your Transovo number before your new carrier completes the
          transfer.
        </p>
        <Link href="/contact" className="mt-2 text-[12px] font-semibold text-[#2563eb]">
          Learn more
        </Link>
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
        <Link href="/contact">
          <PersonalMockBtn variant="outline" className="w-full gap-2">
            <Headphones className="h-4 w-4" />
            Contact Support
          </PersonalMockBtn>
        </Link>
        <Link
          href="/contact"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          View Porting Guide <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
          onClick={() => portAction("sync")}
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
    : legacyPortOutRequests.map((p) => ({
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
                  eligible={false}
                  title="Check portability"
                  message="Enter your numbers and run Check Portability to confirm they can transfer."
                />
              )}
            </div>
            {eligibility?.eligible ? (
              <div className="border-t border-[#f3f4f6] pt-4">
                <PortNumberForm variant="personal" />
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
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-[#2563eb]"
                          onClick={() =>
                            setPortMessage(
                              `Port request ${row.status} for ${formatPhone(row.phone)}`,
                            )
                          }
                        >
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
        <PersonalPortOutFlow
          numbers={numbers}
          initialNumberId={selectedId}
          portOutRequests={portOutRequestRows}
        />
      )}
    </PersonalMockPage>
  );
}
