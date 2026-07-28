import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  FileUp,
  FormInput,
  Hash,
  Plug,
  QrCode,
  UserPlus,
  Webhook,
} from "lucide-react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

const subscriberSources = [
  {
    source: "Form",
    icon: FormInput,
    subscribers: 302,
    share: 42.1,
    lastAdded: "2026-07-27",
    detail: "Website SMS Opt-in, Event QR Signup",
  },
  {
    source: "QR",
    icon: QrCode,
    subscribers: 209,
    share: 29.1,
    lastAdded: "2026-07-26",
    detail: "Lobby poster, Truck magnets",
  },
  {
    source: "Keyword",
    icon: Hash,
    subscribers: 414,
    share: 57.7,
    lastAdded: "2026-07-27",
    detail: "JOIN, DEALS",
  },
  {
    source: "API",
    icon: Webhook,
    subscribers: 48,
    share: 6.7,
    lastAdded: "2026-07-22",
    detail: "REST API contact.create",
  },
  {
    source: "Manual",
    icon: UserPlus,
    subscribers: 18,
    share: 2.5,
    lastAdded: "2026-07-15",
    detail: "Added by team members",
  },
  {
    source: "Import",
    icon: FileUp,
    subscribers: 892,
    share: 100,
    lastAdded: "2026-07-18",
    detail: "CSV/XLSX bulk imports",
  },
  {
    source: "Integration",
    icon: Plug,
    subscribers: 0,
    share: 0,
    lastAdded: "—",
    detail: "Zapier, HubSpot (coming soon)",
  },
];

export default function SubscriberSourcesPage() {
  const totalNew = subscriberSources
    .filter((s) => s.source !== "Import")
    .reduce((sum, s) => sum + s.subscribers, 0);

  return (
    <div>
      <PageHeader
        title="Subscriber sources"
        description="See where your contacts opted in — forms, keywords, QR codes, imports, and integrations."
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Opt-in sources" value={formatNumber(7)} />
        <StatCard
          label="New subscribers (30d)"
          value={formatNumber(totalNew)}
          hint="Excluding bulk imports"
        />
        <StatCard label="Top source" value="Keyword" hint="414 via text-to-join" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {subscriberSources.slice(0, 4).map((src) => {
          const Icon = src.icon;
          return (
            <Card key={src.source}>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle>{src.source}</CardTitle>
              </div>
              <p className="mt-3 font-display text-2xl font-semibold">
                {formatNumber(src.subscribers)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{src.detail}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Source breakdown</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Source</TH>
                <TH>Subscribers</TH>
                <TH>Share of new (30d)</TH>
                <TH>Last subscriber</TH>
                <TH>Details</TH>
              </TR>
            </THead>
            <TBody>
              {subscriberSources.map((src) => {
                const Icon = src.icon;
                return (
                  <TR key={src.source}>
                    <TD>
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4 text-primary" />
                        {src.source}
                      </span>
                    </TD>
                    <TD>{formatNumber(src.subscribers)}</TD>
                    <TD>{src.share > 0 ? formatPercent(src.share) : "—"}</TD>
                    <TD className="text-muted-foreground">{src.lastAdded}</TD>
                    <TD className="text-muted-foreground">{src.detail}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Share percentages reflect new opt-ins in the last 30 days. A contact may appear in
          multiple source categories if they opted in through more than one method.
        </p>
      </Card>
    </div>
  );
}
