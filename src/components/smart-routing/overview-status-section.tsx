"use client";

import { srCard } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import type { SetupReadiness } from "@/lib/smart-routing/setup-readiness";
import { cn } from "@/lib/utils";
import {
  Check,
  Copy,
  Phone,
  PhoneForwarded,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type WorkspaceStatus = {
  publicBusinessE164: string | null;
  routingNumberE164: string | null;
  callbackNumberE164: string | null;
  callerIdStatus: string;
  authorizedCallerCount: number;
  outboundBusinessCallbacks?: number;
  primaryFlow?: { id: string; name: string; status: string; type: string } | null;
  readiness: SetupReadiness;
};

const ROUTING_STATUS_LABELS: Record<SetupReadiness["routingStatus"], string> = {
  live: "Live",
  setup_incomplete: "Setup incomplete",
  paused: "Paused",
  after_hours: "After hours",
  temporary_closure: "Temporary override active",
};

export function OverviewStatusSection({ status }: { status: WorkspaceStatus }) {
  const [copied, setCopied] = useState(false);
  const verified = status.callerIdStatus === "verified";
  const callbackReady = verified && status.authorizedCallerCount > 0 && status.callbackNumberE164;

  function copyRouting() {
    if (!status.routingNumberE164) return;
    void navigator.clipboard.writeText(status.routingNumberE164);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div className={cn(srCard, "p-5")}>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <Phone className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Business number</span>
        </div>
        <p className="mt-3 text-xl font-bold text-[#111827]">
          {status.publicBusinessE164
            ? fmtPhoneDisplay(status.publicBusinessE164)
            : "Not set"}
        </p>
        <p className="mt-2 text-sm">
          {verified ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <Check className="h-4 w-4" /> Verified
            </span>
          ) : (
            <span className="text-amber-600 font-semibold">Verification required</span>
          )}
        </p>
        {!verified ? (
          <Link
            href="/smart-routing/setup#verify-caller-id"
            className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
          >
            Verify number →
          </Link>
        ) : null}
      </div>

      <div className={cn(srCard, "p-5")}>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <PhoneForwarded className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Routing number</span>
        </div>
        <p className="mt-3 text-xl font-bold text-[#111827]">
          {status.routingNumberE164 ? fmtPhoneDisplay(status.routingNumberE164) : "Not assigned"}
        </p>
        <p className="mt-2 text-xs text-[#6b7280]">
          Forward your existing business number here. Incoming customer calls only.
        </p>
        {status.routingNumberE164 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyRouting}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#6366f1] hover:underline"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy number"}
            </button>
            <Link
              href="/smart-routing/setup#forwarding"
              className="text-sm font-semibold text-[#6366f1] hover:underline"
            >
              Forwarding instructions
            </Link>
          </div>
        ) : (
          <Link
            href="/smart-routing/setup"
            className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
          >
            Assign routing number →
          </Link>
        )}
      </div>

      <div className={cn(srCard, "p-5")}>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <Settings className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Routing status</span>
        </div>
        <p className="mt-3 text-xl font-bold text-[#111827]">
          {ROUTING_STATUS_LABELS[status.readiness.routingStatus]}
        </p>
        {status.primaryFlow ? (
          <p className="mt-2 text-sm text-[#6b7280]">
            Current flow:{" "}
            <Link
              href={`/smart-routing/${status.primaryFlow.id}`}
              className="font-semibold text-[#111827] hover:text-[#6366f1]"
            >
              {status.primaryFlow.name}
            </Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#6b7280]">No published call flow yet.</p>
        )}
        <Link
          href={status.primaryFlow ? `/smart-routing/${status.primaryFlow.id}` : "/smart-routing/new"}
          className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
        >
          {status.primaryFlow ? "Edit routing →" : "Create call flow →"}
        </Link>
      </div>

      <div className={cn(srCard, "p-5")}>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <Users className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Business callback</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#111827]">
          {callbackReady ? "Ready" : "Setup required"}
        </p>
        <p className="mt-2 text-xl font-bold text-[#111827]">
          {status.callbackNumberE164
            ? fmtPhoneDisplay(status.callbackNumberE164)
            : "Not assigned"}
        </p>
        <p className="mt-2 text-xs text-[#6b7280]">
          Authorized team calls this number to return customer calls. Do not forward customers here.
        </p>
        {status.callbackNumberE164 ? (
          <Link
            href="/smart-routing/setup#callback-number"
            className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
          >
            Copy / manage →
          </Link>
        ) : (
          <Link
            href="/smart-routing/setup#callback-number"
            className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
          >
            Assign Callback Number →
          </Link>
        )}
        <ul className="mt-3 space-y-1 text-xs text-[#6b7280]">
          <li>
            Caller ID:{" "}
            {verified && status.publicBusinessE164
              ? fmtPhoneDisplay(status.publicBusinessE164)
              : "Not verified"}
          </li>
          <li>{status.authorizedCallerCount} authorized users</li>
          {status.outboundBusinessCallbacks != null ? (
            <li>{status.outboundBusinessCallbacks} business callbacks (30 days)</li>
          ) : null}
        </ul>
        <Link
          href="/smart-routing/setup#business-callback"
          className="mt-3 text-sm font-semibold text-[#6366f1] hover:underline"
        >
          Manage business callback →
        </Link>
      </div>
    </div>
  );
}
