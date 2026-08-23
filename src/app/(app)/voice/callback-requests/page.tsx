"use client";

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

export default function CallbackRequestsPage() {
  const [rows, setRows] = useState<CallbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/callback-requests")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/callback-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        title="Callback Requests"
        description="Callers who asked for a callback from your phone menu or queue overflow."
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Caller</TH>
              <TH>Route</TH>
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
                <TD className="space-x-2">
                  <a href={`tel:${r.callerE164}`} className="text-[#6366f1] font-semibold text-xs">
                    Call
                  </a>
                  <Link href={`/inbox`} className="text-[#6366f1] font-semibold text-xs">
                    Text
                  </Link>
                  {r.status === "new" ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#374151]"
                      onClick={() => setStatus(r.id, "completed")}
                    >
                      Complete
                    </button>
                  ) : null}
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
