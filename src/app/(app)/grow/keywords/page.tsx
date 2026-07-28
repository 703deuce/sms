import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { keywords, phoneNumbers } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";
import { Hash, Plus } from "lucide-react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

export default function KeywordsPage() {
  const totalSubscribers = keywords.reduce((sum, k) => sum + k.subscribers, 0);
  const activeCount = keywords.filter((k) => k.status === "Active").length;

  return (
    <div>
      <PageHeader
        title="Keywords"
        description="Let contacts text a keyword to opt in, join a list, or trigger an automation."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create keyword
          </Button>
        }
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active keywords" value={formatNumber(activeCount)} />
        <StatCard label="Total subscribers" value={formatNumber(totalSubscribers)} />
        <StatCard
          label="Primary number"
          value={formatPhone(phoneNumbers[0]?.number ?? "")}
          hint={phoneNumbers[0]?.friendlyName}
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <CardTitle>Create keyword</CardTitle>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="keyword">Keyword</Label>
            <Input id="keyword" placeholder="JOIN" className="uppercase" />
          </div>
          <div>
            <Label htmlFor="number">Phone number</Label>
            <Select id="number" defaultValue={phoneNumbers[0]?.number}>
              {phoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.number}>
                  {formatPhone(pn.number)} — {pn.friendlyName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="list">Add to list</Label>
            <Select id="list" defaultValue="Leads">
              <option>Leads</option>
              <option>Customers</option>
              <option>VIP</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full">Create keyword</Button>
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="confirmation">Auto-reply confirmation</Label>
          <Textarea
            id="confirmation"
            placeholder="You're subscribed! Reply STOP to opt out."
            rows={2}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>All keywords</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Keyword</TH>
                <TH>Number</TH>
                <TH>List</TH>
                <TH>Subscribers</TH>
                <TH>Status</TH>
                <TH>Confirmation message</TH>
              </TR>
            </THead>
            <TBody>
              {keywords.map((kw) => (
                <TR key={kw.id}>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-primary">
                      <Hash className="h-3.5 w-3.5" />
                      {kw.keyword}
                    </span>
                  </TD>
                  <TD className="text-muted-foreground">{formatPhone(kw.number)}</TD>
                  <TD>{kw.list}</TD>
                  <TD>{formatNumber(kw.subscribers)}</TD>
                  <TD>
                    <StatusChip status={kw.status} />
                  </TD>
                  <TD className="max-w-xs truncate text-muted-foreground">
                    {kw.confirmation}
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
