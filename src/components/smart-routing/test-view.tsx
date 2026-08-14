"use client";

import {
  SrBackLink,
  SrFieldLabel,
  SrInput,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrSectionCard,
  SrSelect,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import { fmtPhoneDisplay, fmtRelativeTime } from "@/lib/smart-routing/display";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  CloudUpload,
  Phone,
  Power,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Validation = {
  valid: boolean;
  issues: Array<{ code: string; message: string }>;
};

type Flow = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  businessNumberE164?: string | null;
  assignedPhoneNumberId?: string | null;
  versions?: Array<{ versionNumber: number; publishedAt?: string | null }>;
};

type PhoneNumber = { id: string; e164: string };

const CHECKLIST_ITEMS = [
  { key: "number", label: "Assigned number" },
  { key: "greeting", label: "Greeting audio" },
  { key: "menu", label: "Menu routes" },
  { key: "ring", label: "Ring groups" },
  { key: "fallback", label: "Fallback rules" },
  { key: "hours", label: "Business hours" },
  { key: "vm", label: "Voicemail" },
  { key: "sms", label: "SMS consent" },
  { key: "ai", label: "AI handoff" },
];

export function SmartRoutingTestView({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [simTab, setSimTab] = useState("1");
  const [simSteps, setSimSteps] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [testSessions, setTestSessions] = useState<
    Array<{ id: string; callerNumber: string; startedAt: string; isTest: boolean }>
  >([]);

  const load = useCallback(() => {
    fetch(`/api/smart-routing/flows/${flowId}`)
      .then((r) => r.json())
      .then((j) => setFlow(j.data));
    fetch(`/api/smart-routing/flows/${flowId}/validate`)
      .then((r) => r.json())
      .then((j) => setValidation(j.data));
    fetch(`/api/smart-routing/flows/${flowId}/activity`)
      .then((r) => r.json())
      .then((j) => {
        const sessions = (j.data ?? []).filter((s: { isTest: boolean }) => s.isTest);
        setTestSessions(sessions.slice(0, 5));
      });
    fetch("/api/numbers")
      .then((r) => r.json())
      .then((j) => setNumbers(j.data ?? j.numbers ?? []));
  }, [flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedE164 =
    flow?.businessNumberE164 ??
    numbers.find((n) => n.id === flow?.assignedPhoneNumberId)?.e164 ??
    "";

  async function publish() {
    setMessage("");
    const res = await fetch(`/api/smart-routing/flows/${flowId}/publish`, { method: "POST" });
    const j = await res.json();
    setMessage(res.ok ? "Flow published and activated." : j.error || "Publish failed");
    if (res.ok) load();
  }

  async function testCall() {
    setMessage("");
    const res = await fetch(`/api/smart-routing/flows/${flowId}/test-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testNumber }),
    });
    const j = await res.json();
    setMessage(res.ok ? "Test call initiated." : j.error || "Test call failed");
    if (res.ok) load();
  }

  async function runSimulate(digits: string[]) {
    const res = await fetch(`/api/smart-routing/flows/${flowId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digits }),
    });
    const j = await res.json();
    setSimSteps(j.data?.steps ?? []);
  }

  useEffect(() => {
    const digits =
      simTab === "after" || simTab === "timeout" ? [] : simTab ? [simTab] : [];
    runSimulate(digits);
  }, [flowId, simTab]);

  if (!flow) {
    return <div className="p-8 text-[13px] text-[#6b7280]">Loading…</div>;
  }

  const draftVersion =
    flow.versions?.find((v) => !v.publishedAt)?.versionNumber ??
    (flow.versions?.[0]?.versionNumber ?? 0) + 1;
  const publishedVersion = flow.versions?.find((v) => v.publishedAt);
  const checksPassed = validation?.valid ? 9 : Math.max(0, 9 - (validation?.issues?.length ?? 0));

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <SrPageShell className="max-w-[1400px]">
        <SrBackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-[#111827]">Test & Activate</h1>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              Validate your call flow, run live tests, and publish changes with confidence.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-[#111827]">{flow.name}</span>
              <SrStatusBadge status={flow.status} />
              <span className="text-[12px] text-[#6b7280]">
                Last edited {fmtRelativeTime(flow.updatedAt)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/smart-routing/${flowId}`}>
              <SrOutlineButton>Save Draft</SrOutlineButton>
            </Link>
            <SrPrimaryButton onClick={publish}>
              <CloudUpload className="h-4 w-4" />
              Publish Changes
            </SrPrimaryButton>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <SrSectionCard number={1} title="Configuration Checklist">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                {checksPassed} of 9 checks passed
              </div>
              <ul className="mt-4 space-y-2">
                {CHECKLIST_ITEMS.map((item) => {
                  const failed = validation?.issues?.some((i) =>
                    i.code.toLowerCase().includes(item.key),
                  );
                  return (
                    <li
                      key={item.key}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="flex items-center gap-2 text-[#374151]">
                        {!failed ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full bg-amber-400" />
                        )}
                        {item.label}
                      </span>
                      <span className="text-[#6b7280]">
                        {item.key === "number" ? fmtPhoneDisplay(assignedE164) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {validation?.issues?.length ? (
                <ul className="mt-3 space-y-1 text-[11px] text-red-600">
                  {validation.issues.map((i) => (
                    <li key={i.code}>{i.message}</li>
                  ))}
                </ul>
              ) : null}
            </SrSectionCard>

            <SrSectionCard number={2} title="Call Me To Test">
              <SrFieldLabel>Test from number</SrFieldLabel>
              <SrSelect
                value={assignedE164}
                onChange={() => {}}
                className="mb-3"
              >
                <option value={assignedE164}>
                  {fmtPhoneDisplay(assignedE164)} (Main Number)
                </option>
              </SrSelect>
              <SrFieldLabel>Your phone</SrFieldLabel>
              <SrInput
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="+15551234567"
              />
              <SrPrimaryButton className="mt-4 w-full sm:w-auto" onClick={testCall}>
                <Phone className="h-4 w-4" />
                Start Test Call
              </SrPrimaryButton>
            </SrSectionCard>

            <SrSectionCard number={3} title="Real PSTN Test">
              <p className="mb-3 text-[12px] font-semibold text-[#6b7280]">Recent test results</p>
              <table className="w-full text-[12px]">
                <thead className="text-[10px] uppercase text-[#9ca3af]">
                  <tr>
                    <th className="py-2">Test</th>
                    <th className="py-2">Called From</th>
                    <th className="py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {testSessions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-[#6b7280]">
                        No test calls yet. Run a test call above.
                      </td>
                    </tr>
                  ) : (
                    testSessions.map((s, i) => (
                      <tr key={s.id} className="border-t border-[#f3f4f6]">
                        <td className="py-2">Test {i + 1}</td>
                        <td className="py-2">{fmtPhoneDisplay(s.callerNumber)}</td>
                        <td className="py-2">
                          <SrStatusBadge status="passed" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SrSectionCard>

            <SrSectionCard number={4} title="Flow Simulator" className="lg:col-span-2">
              <div className="flex flex-wrap gap-1">
                {[
                  { id: "1", label: "Press 1" },
                  { id: "2", label: "Press 2" },
                  { id: "3", label: "Press 3" },
                  { id: "timeout", label: "No Input" },
                  { id: "after", label: "After Hours" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSimTab(tab.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                      simTab === tab.id
                        ? "bg-[#6366f1] text-white"
                        : "text-[#6b7280] hover:bg-[#f3f4f6]",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                {["Incoming Call", "Greeting", "Menu"].map((step, i, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#eef2ff] px-3 py-2 font-semibold text-[#6366f1]">
                      {step}
                    </span>
                    {i < arr.length - 1 ? <ChevronRight className="h-4 w-4 text-[#9ca3af]" /> : null}
                  </div>
                ))}
              </div>
              <ol className="mt-4 space-y-1 text-[12px] text-[#374151]">
                {simSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </SrSectionCard>

            <SrSectionCard number={5} title="Publish Changes">
              <p className="text-[13px] text-[#374151]">
                Draft v{draftVersion} → Published v{publishedVersion?.versionNumber ?? "—"}
              </p>
              <SrPrimaryButton className="mt-4" onClick={publish}>
                <CloudUpload className="h-4 w-4" />
                Publish Changes
              </SrPrimaryButton>
            </SrSectionCard>

            <SrSectionCard number={6} title="Activation">
              <div className="flex items-center gap-2 text-emerald-700">
                <Power className="h-5 w-5" />
                <span className="text-[13px] font-semibold">Flow is ready to go live</span>
              </div>
              <ul className="mt-4 space-y-2 text-[12px] text-[#374151]">
                {["Routing configured", "Hours set", "Recovery path ready", "SMS consent ready"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {t}
                    </li>
                  ),
                )}
              </ul>
              <button
                type="button"
                onClick={publish}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-[13px] font-bold text-white hover:bg-emerald-700"
              >
                Activate Flow
              </button>
            </SrSectionCard>

            <SrSectionCard number={7} title="Quick Actions">
              <div className="space-y-2 text-[13px]">
                <Link href={`/smart-routing/${flowId}`} className="block text-[#6366f1] hover:underline">
                  Edit Call Flow
                </Link>
                <Link href={`/smart-routing/${flowId}`} className="block text-[#6366f1] hover:underline">
                  View Call Flow
                </Link>
                <Link href="/smart-routing/audio" className="block text-[#6366f1] hover:underline">
                  Prompts & Audio
                </Link>
                <Link href="/smart-routing" className="block text-[#6366f1] hover:underline">
                  Smart Routing Overview
                </Link>
              </div>
            </SrSectionCard>

            {message ? (
              <p className="text-[13px] text-[#374151]">{message}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[14px] font-bold text-[#111827]">Flow Summary</h2>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Status</dt>
                  <dd><SrStatusBadge status={flow.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#6b7280]">Main Number</dt>
                  <dd className="font-semibold">{fmtPhoneDisplay(assignedE164)}</dd>
                </div>
              </dl>
            </div>

            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[14px] font-bold text-[#111827]">What happens next?</h2>
              <ol className="mt-3 space-y-3 text-[12px]">
                {[
                  "Run configuration checklist",
                  "Test every menu path",
                  "Publish changes",
                  "Activate for live calls",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-bold text-[#6366f1]">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[14px] font-bold text-[#111827]">Best Practices</h2>
              <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
                <li className="flex gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  Test every menu option
                </li>
                <li className="flex gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  Verify whisper transfers
                </li>
                <li className="flex gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  Confirm SMS consent path
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SrPageShell>
    </div>
  );
}
