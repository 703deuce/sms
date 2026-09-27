"use client";

import Link from "next/link";
import { EmptyState, Panel, Pill } from "@/newui-transplant/components/app/kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
import { titleCaseStatus } from "@/lib/mappers";
import { Terminal } from "lucide-react";

type LogEvent = {
  id: string;
  at: string;
  endpointName: string;
  status: string;
  error: string | null;
};

function logStatus(status: string) {
  if (status === "failed") return "Failed";
  if (status === "processed") return "Delivered";
  return "Pending";
}

function logTone(status: string): "success" | "danger" | "warning" {
  if (status === "failed") return "danger";
  if (status === "processed") return "success";
  return "warning";
}

export function IntegrationsLogsOpus({ events }: { events: LogEvent[] }) {
  const errors = events.filter((e) => e.status === "failed").length;

  return (
    <Panel title="Developer logs" description="API request history, response codes, and latency for debugging integrations.">
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{events.length} webhook events</span>
        <span>{errors} errors</span>
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No developer logs"
          description="Incoming webhook events and API activity will appear here for debugging."
          action={
            <Link href="/integrations/webhooks" className="text-sm font-medium text-primary hover:underline">
              Configure webhooks
            </Link>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(log.at).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{log.endpointName}</TableCell>
                <TableCell>
                  <Pill tone={logTone(log.status)}>{logStatus(log.status)}</Pill>
                  <span className="ml-2 text-sm text-muted-foreground">{titleCaseStatus(log.status)}</span>
                </TableCell>
                <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                  {log.error || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
