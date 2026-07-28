import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { qrCodes } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import { Download, Plus, QrCode } from "lucide-react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

export default function QrCodesPage() {
  const totalScans = qrCodes.reduce((sum, q) => sum + q.scans, 0);
  const activeCount = qrCodes.filter((q) => q.status === "Active").length;

  return (
    <div>
      <PageHeader
        title="QR codes"
        description="Generate scannable codes that link to signup forms or text-to-join keywords."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create QR code
          </Button>
        }
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active codes" value={formatNumber(activeCount)} />
        <StatCard label="Total scans" value={formatNumber(totalScans)} />
        <StatCard label="Scans this month" value={formatNumber(48)} hint="+12% vs last month" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {qrCodes.map((qr) => (
          <Card key={qr.id} className="flex gap-4">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
              <QrCode className="h-16 w-16 text-foreground/20" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{qr.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{qr.destination}</p>
                </div>
                <StatusChip status={qr.status} />
              </div>
              <dl className="mt-3 flex gap-6 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Scans</dt>
                  <dd className="font-display font-semibold">{formatNumber(qr.scans)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </Button>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>All QR codes</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Destination</TH>
                <TH>Scans</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {qrCodes.map((qr) => (
                <TR key={qr.id}>
                  <TD className="font-medium">{qr.name}</TD>
                  <TD className="text-muted-foreground">{qr.destination}</TD>
                  <TD>{formatNumber(qr.scans)}</TD>
                  <TD>
                    <StatusChip status={qr.status} />
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        Download
                      </Button>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
