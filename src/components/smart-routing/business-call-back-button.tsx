"use client";

import { SrOutlineButton, SrPrimaryButton } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { isActiveEntitlement } from "@/lib/products/types";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import { PhoneForwarded } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AuthorizedCaller = {
  id: string;
  name: string;
  phoneE164: string;
  preferredCallbackPhoneE164?: string | null;
  active: boolean;
  outboundEnabled: boolean;
  userId?: string | null;
};

type SetupMeta = {
  businessLabel: string;
  callerIdVerified: boolean;
  outboundEnabled: boolean;
};

type UiStatus =
  | "idle"
  | "calling_employee"
  | "awaiting_confirmation"
  | "calling_customer"
  | "connected"
  | "completed"
  | "employee_no_answer"
  | "employee_confirmation_timeout"
  | "employee_rejected"
  | "customer_no_answer"
  | "customer_busy"
  | "customer_rejected"
  | "failed"
  | "cancelled"
  | "mock";

function callbackPhone(caller: AuthorizedCaller) {
  return caller.preferredCallbackPhoneE164?.trim() || caller.phoneE164;
}

function phoneEnding(e164: string) {
  const d = e164.replace(/\D/g, "");
  return d.slice(-4);
}

export function BusinessCallBackButton({
  destinationE164,
  contextType = "manual",
  contextRefId,
  destinationContactName,
  className,
  size = "default",
  employeeToken,
  businessCallerIdE164,
  label: customLabel,
  variant = "default",
  disabled: disabledProp,
  authorizedCallerId: fixedAuthorizedCallerId,
}: {
  destinationE164: string;
  contextType?:
    | "last_call"
    | "missed_call"
    | "voicemail"
    | "callback_request"
    | "manual"
    | "activity"
    | "conversation";
  contextRefId?: string | null;
  destinationContactName?: string | null;
  className?: string;
  size?: "default" | "sm";
  employeeToken?: string;
  businessCallerIdE164?: string;
  label?: string;
  variant?: "default" | "compact";
  disabled?: boolean;
  authorizedCallerId?: string;
}) {
  const [callers, setCallers] = useState<AuthorizedCaller[]>([]);
  const [meta, setMeta] = useState<SetupMeta | null>(null);
  const [callerId, setCallerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiStatus, setUiStatus] = useState<UiStatus>("idle");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smartRoutingActive, setSmartRoutingActive] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outboundIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (outboundCallId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/smart-routing/outbound-calls/${outboundCallId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const status = json.data as {
          uiStatus: UiStatus;
          statusLabel: string;
          durationSeconds?: number | null;
        };
        setUiStatus(status.uiStatus);
        if (status.durationSeconds && status.uiStatus === "completed") {
          setStatusLabel(`Completed — ${status.durationSeconds}s`);
        } else {
          setStatusLabel(status.statusLabel);
        }
        const terminal = [
          "completed",
          "employee_no_answer",
          "employee_confirmation_timeout",
          "employee_rejected",
          "customer_no_answer",
          "customer_busy",
          "customer_rejected",
          "failed",
          "cancelled",
          "mock",
        ];
        if (terminal.includes(status.uiStatus)) {
          stopPolling();
          setLoading(false);
        }
      }, 2000);
    },
    [stopPolling],
  );

  const load = useCallback(async () => {
    if (employeeToken) return;
    const featRes = await fetch("/api/platform/features", { cache: "no-store" });
    const featJson = await featRes.json().catch(() => ({}));
    const features = featJson.data as WorkspaceFeatureSnapshot | undefined;
    const srActive = features ? isActiveEntitlement(features.smart_routing) : true;
    setSmartRoutingActive(srActive);

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
    setCallerId((prev) => prev || fixedAuthorizedCallerId || active[0]?.id || "");
    setMeta({
      businessLabel: data.workspaceName?.trim() || "your business",
      callerIdVerified: data.callerId?.status === "verified",
      outboundEnabled: Boolean(data.settings?.outboundEnabled),
    });
  }, [fixedAuthorizedCallerId]);

  useEffect(() => {
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  async function startCallBack() {
    setLoading(true);
    setError(null);
    setStatusLabel(null);
    setUiStatus("calling_employee");
    try {
      const endpoint = employeeToken
        ? `/api/e/call/${employeeToken}/callback`
        : "/api/smart-routing/business-callback";
      const sourceTypeMap: Record<string, string> = {
        last_call: "routing_activity",
        missed_call: "missed_call",
        voicemail: "voicemail",
        callback_request: "callback_request",
        manual: "manual",
        activity: "routing_activity",
        conversation: "conversation",
      };
      const body = employeeToken
        ? {
            destinationE164,
            businessCallerIdE164,
            sourceType: sourceTypeMap[contextType] ?? "manual",
            sourceId: contextRefId,
            destinationContactName,
          }
        : {
            destinationE164,
            authorizedCallerId: callerId,
            contextType,
            contextRefId,
            destinationContactName,
            businessCallerIdE164,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not start business call back");
        setUiStatus("idle");
        setLoading(false);
        return;
      }
      const outboundCallId = json.data?.outboundCallId as string;
      const status = json.data?.status as { uiStatus?: UiStatus; statusLabel?: string } | null;
      if (json.data?.mock) {
        setUiStatus("mock");
        setStatusLabel(status?.statusLabel ?? "Simulated — Telnyx not configured.");
        setLoading(false);
        return;
      }
      outboundIdRef.current = outboundCallId;
      setUiStatus(status?.uiStatus ?? "calling_employee");
      setStatusLabel(status?.statusLabel ?? "Calling your phone…");
      if (outboundCallId) pollStatus(outboundCallId);
    } catch {
      setError("Could not start business call back");
      setUiStatus("idle");
      setLoading(false);
    }
  }

  const terminalStatuses: UiStatus[] = [
    "idle",
    "completed",
    "mock",
    "employee_no_answer",
    "employee_confirmation_timeout",
    "employee_rejected",
    "customer_no_answer",
    "customer_busy",
    "customer_rejected",
    "failed",
    "cancelled",
  ];

  if (employeeToken) {
    const inProgress = loading || !terminalStatuses.includes(uiStatus);
    const btnLabel = customLabel ?? "Call Back";
    return (
      <div className={className}>
        <button
          type="button"
          disabled={inProgress || disabledProp}
          onClick={() => void startCallBack()}
          className="rounded-lg bg-[#6366f1] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {inProgress ? statusLabel ?? "Calling your phone…" : btnLabel}
        </button>
        {statusLabel && !inProgress ? (
          <p className="mt-1 text-[11px] text-emerald-700">{statusLabel}</p>
        ) : null}
        {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (!smartRoutingActive) {
    return (
      <p className="text-xs text-muted-foreground">
        Business Call Back requires{" "}
        <a
          href="/settings/billing?upgrade=smart_routing"
          className="font-semibold text-primary hover:underline"
        >
          Smart Routing
        </a>
        .
      </p>
    );
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

  const label = customLabel ?? `Call Back as ${meta.businessLabel}`;
  const selected = callers.find((c) => c.id === callerId);
  const inProgress = loading || !terminalStatuses.includes(uiStatus);

  if (variant === "compact") {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={inProgress || !callerId || disabledProp}
          onClick={() => void startCallBack()}
          className="rounded-md border border-[#e5e7eb] px-2 py-1 text-[11px] font-semibold text-[#6366f1]"
        >
          {inProgress ? "…" : customLabel ?? "Call"}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {callers.length > 1 ? (
        <select
          className="mb-2 w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-[12px]"
          value={callerId}
          onChange={(e) => setCallerId(e.target.value)}
          aria-label="Callback phone"
          disabled={inProgress}
        >
          {callers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · ending {phoneEnding(callbackPhone(c))}
            </option>
          ))}
        </select>
      ) : selected ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Call me on {selected.name} · {fmtPhoneDisplay(callbackPhone(selected))}
        </p>
      ) : null}
      {size === "sm" ? (
        <SrOutlineButton
          type="button"
          disabled={inProgress || !callerId}
          onClick={() => void startCallBack()}
          className="text-[12px]"
        >
          <PhoneForwarded className="h-3.5 w-3.5" />
          {inProgress ? statusLabel ?? "Calling…" : label}
        </SrOutlineButton>
      ) : (
        <SrPrimaryButton
          type="button"
          disabled={inProgress || !callerId}
          onClick={() => void startCallBack()}
          className="w-full"
        >
          <PhoneForwarded className="h-4 w-4" />
          {inProgress ? statusLabel ?? "Calling your phone…" : label}
        </SrPrimaryButton>
      )}
      {statusLabel && !inProgress ? (
        <p className="mt-2 text-[11px] text-emerald-700">{statusLabel}</p>
      ) : null}
      {inProgress && statusLabel ? (
        <p className="mt-2 text-[11px] text-[#6366f1]">{statusLabel}</p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
