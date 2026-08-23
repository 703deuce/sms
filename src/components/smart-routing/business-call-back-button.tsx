"use client";

import { SrOutlineButton, SrPrimaryButton } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { PhoneForwarded } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AuthorizedCaller = {
  id: string;
  name: string;
  phoneE164: string;
  active: boolean;
  outboundEnabled: boolean;
};

type SetupMeta = {
  businessLabel: string;
  callerIdVerified: boolean;
  outboundEnabled: boolean;
};

export function BusinessCallBackButton({
  destinationE164,
  contextType = "manual",
  contextRefId,
  className,
  size = "default",
}: {
  destinationE164: string;
  contextType?: "last_call" | "missed_call" | "voicemail" | "callback_request" | "manual";
  contextRefId?: string | null;
  className?: string;
  size?: "default" | "sm";
}) {
  const [callers, setCallers] = useState<AuthorizedCaller[]>([]);
  const [meta, setMeta] = useState<SetupMeta | null>(null);
  const [callerId, setCallerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/smart-routing/setup", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) return;
    const data = json.data as {
      settings?: { outboundEnabled?: boolean };
      callerId?: { status: string };
      authorizedCallers?: AuthorizedCaller[];
      workspaceName?: string;
    };
    const active = (data.authorizedCallers ?? []).filter(
      (c) => c.active && c.outboundEnabled,
    );
    setCallers(active);
    setCallerId((prev) => prev || active[0]?.id || "");
    setMeta({
      businessLabel: data.workspaceName?.trim() || "your business",
      callerIdVerified: data.callerId?.status === "verified",
      outboundEnabled: Boolean(data.settings?.outboundEnabled),
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCallBack() {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/smart-routing/outbound-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationE164,
          authorizedCallerId: callerId,
          contextType,
          contextRefId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not start business call back");
        return;
      }
      if (json.data?.mock) {
        setStatus("Simulated — Telnyx voice is not configured in this environment.");
        return;
      }
      const employee = callers.find((c) => c.id === callerId);
      setStatus(
        employee
          ? `Calling ${employee.name} at ${fmtPhoneDisplay(employee.phoneE164)}. Answer your phone to connect to ${fmtPhoneDisplay(destinationE164)} with your business caller ID.`
          : "Calling your team phone. Answer to connect the customer with your business caller ID.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!meta?.outboundEnabled) {
    return (
      <p className="text-xs text-muted-foreground">
        Enable business call back in{" "}
        <a href="/smart-routing/setup" className="font-semibold text-primary hover:underline">
          Smart Routing setup
        </a>
        .
      </p>
    );
  }

  if (!meta.callerIdVerified) {
    return (
      <p className="text-xs text-muted-foreground">
        Verify your business caller ID in{" "}
        <a href="/smart-routing/callback" className="font-semibold text-primary hover:underline">
          Business Call Back
        </a>
        .
      </p>
    );
  }

  if (!callers.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Add an authorized team phone in{" "}
        <a href="/smart-routing/setup" className="font-semibold text-primary hover:underline">
          Setup
        </a>
        .
      </p>
    );
  }

  const label = `Call Back as ${meta.businessLabel}`;

  return (
    <div className={className}>
      {callers.length > 1 ? (
        <select
          className="mb-2 w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-[12px]"
          value={callerId}
          onChange={(e) => setCallerId(e.target.value)}
          aria-label="Team member phone"
        >
          {callers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {fmtPhoneDisplay(c.phoneE164)}
            </option>
          ))}
        </select>
      ) : null}
      {size === "sm" ? (
        <SrOutlineButton
          type="button"
          disabled={loading || !callerId}
          onClick={() => void startCallBack()}
          className="text-[12px]"
        >
          <PhoneForwarded className="h-3.5 w-3.5" />
          {loading ? "Calling…" : label}
        </SrOutlineButton>
      ) : (
        <SrPrimaryButton
          type="button"
          disabled={loading || !callerId}
          onClick={() => void startCallBack()}
          className="w-full"
        >
          <PhoneForwarded className="h-4 w-4" />
          {loading ? "Calling team phone…" : label}
        </SrPrimaryButton>
      )}
      {status ? <p className="mt-2 text-[11px] text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
