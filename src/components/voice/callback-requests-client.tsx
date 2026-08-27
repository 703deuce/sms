"use client";

import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { useEffect, useState } from "react";

type CallbackRow = {
  id: string;
  callerE164: string;
  sourceRoute: string | null;
  status: string;
  requestedAt: string;
  reason: string | null;
};

export function CallbackRequestsClient() {
  const [rows, setRows] = useState<CallbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBridgeId, setActiveBridgeId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/callback-requests")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: string) {
    const res = await fetch("/api/callback-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        title="Callback Requests"
        description="Callers who asked to be contacted later — from your phone menu, queue overflow, or your team. Use Business Call Back so customers see your business number, not a personal cell."
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Caller</TH>
              <TH>Route / source</TH>
              <TH>Status</TH>
              <TH>Requested</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs">{r.callerE164}</TD>
                <TD>{r.sourceRoute || "—"}</TD>
                <TD>{r.status}</TD>
                <TD>{new Date(r.requestedAt).toLocaleString()}</TD>
                <TD className="align-top">
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {activeBridgeId === r.id ? (
                      <BusinessCallBackButton
                        destinationE164={r.callerE164}
                        contextType="callback_request"
                        contextRefId={r.id}
                        size="sm"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#6366f1]"
                        onClick={() => setActiveBridgeId(r.id)}
                      >
                        Call Back with business caller ID
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/conversations`} className="text-[#6366f1] font-semibold text-xs">
                        Text
                      </Link>
                      {r.status === "new" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#374151]"
                          onClick={() => setStatus(r.id, "contacted")}
                        >
                          Mark contacted
                        </button>
                      ) : null}
                      {r.status !== "completed" && r.status !== "dismissed" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#374151]"
                          onClick={() => setStatus(r.id, "completed")}
                        >
                          Complete
                        </button>
                      ) : null}
                      {r.status !== "dismissed" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-muted-foreground"
                          onClick={() => setStatus(r.id, "dismissed")}
                        >
                          Dismiss
                        </button>
                      ) : null}
                    </div>
                  </div>
                </TD>
              </TR>
            ))}
            {!loading && !rows.length ? (
              <TR>
                <TD colSpan={5} className="text-muted-foreground">
                  No callback requests yet.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
