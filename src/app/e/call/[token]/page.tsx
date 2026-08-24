"use client";

import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { useCallback, useEffect, useState } from "react";

type EmployeeCallData = {
  workspaceName: string;
  employeeName: string;
  businessCallerIdE164: string | null;
  callerIdentities: Array<{ e164: string; label: string; verified: boolean }>;
  selectedCallerIdE164: string | null;
  availabilityStatus: string;
  lastCaller: { callerE164: string; sessionId: string } | null;
  recentCallers: Array<{ callerE164: string; sessionId: string; calledAt: string }>;
  deepLink?: {
    callerE164: string;
    contactName?: string | null;
    sessionId?: string | null;
  } | null;
};

export default function EmployeeCallPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<EmployeeCallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualNumber, setManualNumber] = useState("");
  const [callerId, setCallerId] = useState<string>("");
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    void params.then((p) => setToken(p.token));
  }, [params]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/e/call/${token}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Link invalid or expired");
      return;
    }
    setData(json.data as EmployeeCallData);
    setCallerId(json.data.selectedCallerIdE164 || json.data.businessCallerIdE164 || "");
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [load, token]);

  const togglePause = async () => {
    setPausing(true);
    try {
      await fetch(`/api/e/call/${token}/availability`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: data?.availabilityStatus === "paused" ? "resume" : "pause",
        }),
      });
      await load();
    } finally {
      setPausing(false);
    }
  };

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-bold">Business Calls</h1>
        <p className="mt-4 text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!data) {
    return <main className="p-6 text-sm text-muted-foreground">Loading…</main>;
  }

  const businessLabel = data.workspaceName || "Business";
  const deepLink = data.deepLink;

  return (
    <main className="mx-auto max-w-md space-y-6 p-4 pb-10">
      <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6366f1]">Business Calls</p>
        <h1 className="mt-1 text-2xl font-bold">{businessLabel}</h1>
        <p className="text-sm text-[#6b7280]">{data.employeeName}</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">Calling as</h2>
        <select
          className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
          value={callerId}
          onChange={(e) => setCallerId(e.target.value)}
        >
          {data.callerIdentities.map((id) => (
            <option key={id.e164} value={id.e164}>
              {id.label} — {fmtPhoneDisplay(id.e164)}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-[#9ca3af]">
          Caller-name display may vary by receiving carrier or device.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          disabled={pausing}
          onClick={() => void togglePause()}
          className="w-full rounded-xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white"
        >
          {data.availabilityStatus === "paused" ? "Resume Calls to Me" : "Pause Calls to Me"}
        </button>
      </section>

      {deepLink ? (
        <section className="rounded-2xl bg-[#eef2ff] p-5 ring-1 ring-[#c7d2fe]">
          <p className="text-sm font-semibold">
            Call {deepLink.contactName || fmtPhoneDisplay(deepLink.callerE164)} back as {businessLabel}?
          </p>
          <div className="mt-3">
            <BusinessCallBackButton
              destinationE164={deepLink.callerE164}
              contextType="activity"
              contextRefId={deepLink.sessionId ?? undefined}
              destinationContactName={deepLink.contactName}
              employeeToken={token}
              businessCallerIdE164={callerId}
              label={`Call Back`}
            />
          </div>
        </section>
      ) : null}

      {data.lastCaller ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">Last caller</h2>
          <p className="mt-1 text-lg font-semibold">{fmtPhoneDisplay(data.lastCaller.callerE164)}</p>
          <div className="mt-3">
            <BusinessCallBackButton
              destinationE164={data.lastCaller.callerE164}
              contextType="last_call"
              contextRefId={data.lastCaller.sessionId}
              employeeToken={token}
              businessCallerIdE164={callerId}
              label={`Call Back as ${businessLabel}`}
            />
          </div>
        </section>
      ) : null}

      {data.recentCallers.length > 0 ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-semibold">Recent callers</h2>
          <ul className="mt-3 space-y-3">
            {data.recentCallers.map((c) => (
              <li key={c.sessionId} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{fmtPhoneDisplay(c.callerE164)}</span>
                <BusinessCallBackButton
                  destinationE164={c.callerE164}
                  contextType="activity"
                  contextRefId={c.sessionId}
                  employeeToken={token}
                  businessCallerIdE164={callerId}
                  label="Call"
                  variant="compact"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold">Manual number</h2>
        <input
          type="tel"
          className="mt-2 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
          placeholder="7035551234"
          value={manualNumber}
          onChange={(e) => setManualNumber(e.target.value)}
        />
        <div className="mt-3">
          <BusinessCallBackButton
            destinationE164={manualNumber}
            contextType="manual"
            employeeToken={token}
            businessCallerIdE164={callerId}
            label={`Call as ${businessLabel}`}
            disabled={manualNumber.replace(/\D/g, "").length < 10}
          />
        </div>
      </section>
    </main>
  );
}
