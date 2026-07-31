"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { useEffect, useState } from "react";

type CallRow = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  disposition?: string | null;
  startedAt: string;
  endedAt?: string | null;
  agentUserId?: string | null;
};

export default function PhoneCallsPage() {
  const [rows, setRows] = useState<CallRow[]>([]);

  useEffect(() => {
    fetch("/api/phone/calls?limit=100")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader
        title="Call history"
        description="Human agent calls placed and received through the softphone."
      />
      <PhoneSubNav />
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Direction</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Status</TH>
              <TH>Disposition</TH>
              <TH>Started</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={6} className="text-center text-muted-foreground py-8">
                  No calls yet
                </TD>
              </TR>
            ) : (
              rows.map((c) => (
                <TR key={c.id}>
                  <TD className="capitalize">{c.direction}</TD>
                  <TD className="font-mono text-xs">{c.from}</TD>
                  <TD className="font-mono text-xs">{c.to}</TD>
                  <TD>{c.status}</TD>
                  <TD>{c.disposition || "—"}</TD>
                  <TD className="text-muted-foreground text-xs">
                    {new Date(c.startedAt).toLocaleString()}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
