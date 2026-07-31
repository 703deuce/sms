import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber, formatPercent } from "@/lib/utils";
import { loadSubscriberSources, requireWorkspaceContext } from "@/lib/workspace-data";
import {
  FileUp,
  FormInput,
  Hash,
  Plug,
  QrCode,
  UserPlus,
  Webhook,
  type LucideIcon,
} from "lucide-react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

const sourceIcons: Record<string, LucideIcon> = {
  Form: FormInput,
  QR: QrCode,
  Keyword: Hash,
  API: Webhook,
  Manual: UserPlus,
  Import: FileUp,
  Integration: Plug,
};

export default async function SubscriberSourcesPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const subscriberSources = await loadSubscriberSources(workspaceId);

  const totalNew = subscriberSources
    .filter((s) => s.source !== "Import")
    .reduce((sum, s) => sum + s.subscribers, 0);

  const topSource = [...subscriberSources]
    .filter((s) => s.source !== "Import")
    .sort((a, b) => b.subscribers - a.subscribers)[0];

  const activeSources = subscriberSources.filter((s) => s.subscribers > 0 || s.detail).length;

  return (
    <div>
      <PageHeader
        title="Subscriber sources"
        description="See where your contacts opted in — forms, keywords, QR codes, imports, and integrations."
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Opt-in sources" value={formatNumber(activeSources)} />
        <StatCard
          label="New subscribers (30d)"
          value={formatNumber(totalNew)}
          hint="Excluding bulk imports"
        />
        <StatCard
          label="Top source"
          value={topSource?.source || "—"}
          hint={
            topSource && topSource.subscribers > 0
              ? `${formatNumber(topSource.subscribers)} in last 30 days`
              : "No recent opt-ins"
          }
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {subscriberSources.slice(0, 4).map((src) => {
          const Icon = sourceIcons[src.source] || Plug;
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
                const Icon = sourceIcons[src.source] || Plug;
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
