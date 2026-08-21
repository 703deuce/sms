"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { useEffect, useState } from "react";

type Conversation = {
  contactId: string | null;
  phone: string;
  callCount: number;
  lastCallAt: string;
  lastOutcome: string | null;
  totalDuration: number;
};

export default function VoiceConversationsPage() {
  const [rows, setRows] = useState<Conversation[]>([]);

  useEffect(() => {
    fetch("/api/voice/conversations")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }, []);

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Talk to callers who replied to your missed-call text back messages."
        actions={
          <Link
            href="/inbox"
            className="inline-flex h-9 items-center rounded-[10px] border border-[#e5e7eb] bg-white px-4 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
          >
            Open SMS inbox
          </Link>
        }
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Phone</TH>
              <TH>Calls</TH>
              <TH>Last outcome</TH>
              <TH>Total duration</TH>
              <TH>Last call</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.phone}>
                <TD className="font-mono text-xs">
                  {r.contactId ? (
                    <Link href={`/contacts/${r.contactId}`} className="underline">{r.phone}</Link>
                  ) : r.phone}
                </TD>
                <TD>{r.callCount}</TD>
                <TD>{r.lastOutcome || "—"}</TD>
                <TD>{r.totalDuration}s</TD>
                <TD>{new Date(r.lastCallAt).toLocaleString()}</TD>
              </TR>
            ))}
            {!rows.length && (
              <TR>
                <TD colSpan={5} className="text-muted-foreground">
                  No conversations yet. When someone replies to a missed-call text, threads
                  appear here and in{" "}
                  <Link href="/inbox" className="font-semibold text-primary underline">
                    Inbox
                  </Link>
                  .
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
