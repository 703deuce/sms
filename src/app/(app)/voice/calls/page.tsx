"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type CallRow = {
  id: string;
  direction: string;
  status: string;
  fromE164: string;
  toE164: string;
  durationSeconds?: number | null;
  leadScore?: number | null;
  isTest: boolean;
  startedAt: string;
};

export default function VoiceCallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    const testParam = showTest ? "1" : "0";
    fetch(`/api/voice/calls?limit=100&test=${testParam}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined);
  }, [showTest]);

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Production call log with filters, outcomes, and drill-down detail."
        actions={
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 font-medium",
                !showTest ? "bg-muted" : "text-muted-foreground",
              )}
              onClick={() => setShowTest(false)}
            >
              Production
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 font-medium",
                showTest ? "bg-muted" : "text-muted-foreground",
              )}
              onClick={() => setShowTest(true)}
            >
              Test calls
            </button>
          </div>
        }
      />
      <VoiceSubNav />
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Direction</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Status</TH>
              <TH>Duration</TH>
              <TH>Lead</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD>{c.direction}</TD>
                <TD className="font-mono text-xs">{c.fromE164}</TD>
                <TD className="font-mono text-xs">{c.toE164}</TD>
                <TD>{c.status}</TD>
                <TD>{c.durationSeconds ?? "—"}s</TD>
                <TD>{c.leadScore ?? "—"}</TD>
                <TD>
                  <Link href={`/voice/calls/${c.id}`} className="text-sm text-primary">Detail</Link>
                </TD>
              </TR>
            ))}
            {!rows.length && (
              <TR>
                <TD colSpan={7} className="text-muted-foreground">
                  {showTest ? "No test calls yet. Run one from Testing lab." : "No production calls yet."}
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
