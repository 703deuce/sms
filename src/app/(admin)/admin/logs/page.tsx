import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Server } from "lucide-react";

const systemLogs = [
  {
    id: "sl_1",
    at: "2026-07-27T16:45:00Z",
    level: "INFO",
    service: "api-gateway",
    message: "Campaign send completed for camp_1 (1204 recipients)",
  },
  {
    id: "sl_2",
    at: "2026-07-27T16:42:00Z",
    level: "INFO",
    service: "webhook-dispatcher",
    message: "Delivered message.delivered to hooks.harborhome.co (201)",
  },
  {
    id: "sl_3",
    at: "2026-07-27T14:22:00Z",
    level: "WARN",
    service: "a2p-worker",
    message: "Brand submission pending review > 7 days for ac_1",
  },
  {
    id: "sl_4",
    at: "2026-07-27T12:00:00Z",
    level: "ERROR",
    service: "message-sender",
    message: "Twilio error 30007 for +14155550166 — carrier filtered",
  },
  {
    id: "sl_5",
    at: "2026-07-27T09:00:00Z",
    level: "INFO",
    service: "billing-cron",
    message: "Monthly subscription invoices generated (3 accounts)",
  },
  {
    id: "sl_6",
    at: "2026-07-26T23:00:00Z",
    level: "INFO",
    service: "monitoring",
    message: "High opt-out alert triggered for QuickMove Logistics",
  },
  {
    id: "sl_7",
    at: "2026-07-26T18:30:00Z",
    level: "ERROR",
    service: "api-gateway",
    message: "Rate limit exceeded for key trnv_test_9b1c (429)",
  },
];

function levelStatus(level: string) {
  if (level === "ERROR") return "Failed";
  if (level === "WARN") return "Pending";
  return "Delivered";
}

export default function AdminLogsPage() {
  const errors = systemLogs.filter((l) => l.level === "ERROR").length;
  const warnings = systemLogs.filter((l) => l.level === "WARN").length;

  return (
    <div>
      <PageHeader
        title="System logs"
        description="Platform service logs for API, messaging, billing, and compliance workers."
        actions={<Button variant="outline">Export logs</Button>}
      />

      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <Label htmlFor="logLevel">Level</Label>
            <Select id="logLevel" defaultValue="all">
              <option value="all">All levels</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="logService">Service</Label>
            <Select id="logService" defaultValue="all">
              <option value="all">All services</option>
              <option value="api-gateway">api-gateway</option>
              <option value="message-sender">message-sender</option>
              <option value="a2p-worker">a2p-worker</option>
              <option value="billing-cron">billing-cron</option>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="logSearch">Search</Label>
            <Input id="logSearch" placeholder="Filter by message..." />
          </div>
          <Button type="button" variant="outline">
            Apply filters
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{systemLogs.length} entries</span>
        <span>{errors} errors</span>
        <span>{warnings} warnings</span>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <CardTitle>Log stream</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Time</TH>
              <TH>Level</TH>
              <TH>Service</TH>
              <TH>Message</TH>
            </TR>
          </THead>
          <TBody>
            {systemLogs.map((log) => (
              <TR key={log.id}>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(log.at).toLocaleString()}
                </TD>
                <TD>
                  <StatusChip status={levelStatus(log.level)} />
                  <span className="ml-2 font-mono text-xs">{log.level}</span>
                </TD>
                <TD className="font-mono text-sm">{log.service}</TD>
                <TD className="max-w-[480px] text-sm">{log.message}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
