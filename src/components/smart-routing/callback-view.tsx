"use client";

import { AuthorizedCallersPanel } from "@/components/smart-routing/authorized-callers-panel";
import { BusinessCallbackGuide } from "@/components/smart-routing/business-callback-guide";
import { CallerIdVerificationPanel } from "@/components/smart-routing/caller-id-verification-panel";
import { SrPageShell, srCard } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { cn } from "@/lib/utils";
import { Check, PhoneForwarded } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SetupSlice = {
  settings: {
    publicBusinessE164: string | null;
    routingNumberE164: string | null;
    callbackNumberE164: string | null;
  };
  callerId: {
    status: string;
    publicBusinessE164: string | null;
    method: string | null;
  };
  authorizedCallers: Array<{
    id: string;
    name: string;
    phoneE164: string;
    active: boolean;
    outboundEnabled: boolean;
  }>;
  flows: Array<{ id: string; name: string; status: string }>;
  recentOutbound: {
    at: string;
    destination: string;
    businessCallerId: string | null;
  } | null;
};

export function SmartRoutingCallbackView() {
  const [data, setData] = useState<SetupSlice | null>(null);
  const [outboundActivity, setOutboundActivity] = useState<
    Array<{
      id: string;
      destinationE164: string;
      businessCallerIdE164: string | null;
      createdAt: string;
      authorizedCaller?: { name: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setupRes, outboundRes] = await Promise.all([
        fetch("/api/smart-routing/setup", { cache: "no-store" }),
        fetch("/api/smart-routing/outbound-calls?limit=20"),
      ]);
      const setupJson = await setupRes.json();
      const outboundJson = await outboundRes.json();
      if (setupRes.ok) setData(setupJson.data as SetupSlice);
      setOutboundActivity(outboundJson.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const businessNumber = data?.settings.publicBusinessE164 ?? "";
  const callbackE164 = data?.settings.callbackNumberE164 ?? "";
  const routingE164 = data?.settings.routingNumberE164 ?? "";
  const verified = data?.callerId.status === "verified";
  const activeFlow = data?.flows.find((f) => f.status === "active");

  return (
    <SrPageShell
      title="Business Call Back"
      description="Call customers back from your verified business number — not your personal cell or the hidden routing number. Team members can use the dashboard or call your access number with PIN."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading Business Callback…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={cn(srCard, "p-5")}>
              <h2 className="text-sm font-semibold text-[#111827]">Business Caller ID</h2>
              <p className="mt-2 text-lg font-semibold">
                {businessNumber ? fmtPhoneDisplay(businessNumber) : "Not set"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {verified ? (
                  <span className="text-emerald-700">Verified — customers see this number on callbacks.</span>
                ) : (
                  "Verify your business number below to enable outbound callbacks."
                )}
              </p>
            </div>
            <div className={cn(srCard, "p-5")}>
              <h2 className="text-sm font-semibold text-[#111827]">Callback Number</h2>
              <p className="mt-2 text-lg font-semibold">
                {callbackE164 ? fmtPhoneDisplay(callbackE164) : "Not assigned"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Team members call this number — not your Routing Number.
              </p>
              {!callbackE164 ? (
                <Link
                  href="/smart-routing/setup#callback-number"
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  Assign in Setup →
                </Link>
              ) : null}
            </div>
          </div>

          <div className={cn(srCard, "p-5")}>
            <CallerIdVerificationPanel
              businessNumber={businessNumber}
              callerId={
                data?.callerId ?? { status: "not_verified", publicBusinessE164: null, method: null }
              }
              onVerified={load}
            />
          </div>

          <div className={cn(srCard, "p-5")}>
            <AuthorizedCallersPanel callers={data?.authorizedCallers ?? []} onUpdated={load} />
          </div>

          {callbackE164 ? (
            <div className={cn(srCard, "p-5")}>
              <BusinessCallbackGuide
                businessNumber={businessNumber}
                routingNumber={routingE164}
                callbackNumber={callbackE164}
                verified={verified}
              />
            </div>
          ) : null}

          <div className={cn(srCard, "p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Recent outbound callbacks</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Business Callback activity from authorized team members.
                </p>
              </div>
              <Link
                href="/smart-routing/activity"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all activity →
              </Link>
            </div>
            {data?.recentOutbound ? (
              <p className="mt-3 flex items-center gap-1 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                Latest callback to {fmtPhoneDisplay(data.recentOutbound.destination)} (
                {new Date(data.recentOutbound.at).toLocaleString()})
              </p>
            ) : null}
            {outboundActivity.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No outbound callbacks yet.</p>
            ) : (
              <ul className="mt-4 divide-y rounded-lg border">
                {outboundActivity.slice(0, 8).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <PhoneForwarded className="h-4 w-4 text-[#6366f1]" />
                      <span>
                        {row.authorizedCaller?.name ?? "Team member"} →{" "}
                        {fmtPhoneDisplay(row.destinationE164)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {activeFlow ? (
              <Link
                href={`/smart-routing/${activeFlow.id}/test#test-callback`}
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Test Business Callback →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </SrPageShell>
  );
}
