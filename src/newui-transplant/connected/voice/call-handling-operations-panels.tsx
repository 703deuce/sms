"use client";

import { useEffect, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import type { RecentTransferRow } from "@/lib/newui-transplant/adapters/voice-call-handling";
import { fmtCallPhone } from "@/lib/voice/calls/display";
import { OpusCallRoutingIngressPanel } from "@/newui-transplant/components/voice/call-routing-ingress-panel";

function formatTransferTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useVoiceCallHandlingRecentTransfers(limit = 10) {
  const [recent, setRecent] = useState<RecentTransferRow[]>([]);

  useEffect(() => {
    fetch(`/api/voice/call-handling/recent-transfers?limit=${limit}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRecent((j.data ?? []) as RecentTransferRow[]))
      .catch(() => setRecent([]));
  }, [limit]);

  const rows = recent.map((t) => ({
    caller: t.callerE164 ? fmtCallPhone(t.callerE164) : "Unknown caller",
    to: t.destination,
    reason: t.transferType || "Transfer",
    time: formatTransferTime(t.createdAt),
    result: t.answered ? "Answered" : "No answer → voicemail",
  }));

  return { rows };
}

export function VoiceCallHandlingRecentTransfersPanel() {
  const { rows } = useVoiceCallHandlingRecentTransfers(10);

  return (
    <Panel title="Recent transfers" bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">No recent transfers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Transferred to</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reason</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.caller}-${r.time}`}>
                  <td className="px-5 py-3 font-medium">{r.caller}</td>
                  <td className="px-3 py-3">{r.to}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.reason}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{r.time}</td>
                  <td className="px-3 py-3">
                    <Pill tone={r.result === "Answered" ? "success" : "warning"}>{r.result}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function VoiceCallHandlingRoutingPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Phone routing and ingress status for your workspace. Change call-handling behavior in Setup.
      </p>
      <OpusCallRoutingIngressPanel />
    </div>
  );
}
