import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { ExternalLink, Globe, Plus } from "lucide-react";

const growTabs = [
  { label: "Keywords", href: "/grow/keywords" },
  { label: "Forms", href: "/grow/forms" },
  { label: "QR Codes", href: "/grow/qr-codes" },
  { label: "Signup Pages", href: "/grow/pages" },
  { label: "Sources", href: "/grow/sources" },
];

const signupPages = [
  {
    id: "sp_1",
    name: "Main website signup",
    slug: "harbor-home",
    list: "Leads",
    views: 1842,
    signups: 214,
    status: "Active",
    url: "https://pages.transovo.com/harbor-home",
  },
  {
    id: "sp_2",
    name: "Trade show landing",
    slug: "harbor-booth-2026",
    list: "Leads",
    views: 412,
    signups: 88,
    status: "Active",
    url: "https://pages.transovo.com/harbor-booth-2026",
  },
  {
    id: "sp_3",
    name: "VIP early access",
    slug: "harbor-vip",
    list: "VIP",
    views: 96,
    signups: 34,
    status: "Active",
    url: "https://pages.transovo.com/harbor-vip",
  },
  {
    id: "sp_4",
    name: "Seasonal promo",
    slug: "summer-special",
    list: "Customers",
    views: 0,
    signups: 0,
    status: "Draft",
    url: "https://pages.transovo.com/summer-special",
  },
];

export default function SignupPagesPage() {
  const totalViews = signupPages.reduce((sum, p) => sum + p.views, 0);
  const totalSignups = signupPages.reduce((sum, p) => sum + p.signups, 0);
  const conversionRate = totalViews > 0 ? ((totalSignups / totalViews) * 100).toFixed(1) : "0";

  return (
    <div>
      <PageHeader
        title="Signup pages"
        description="Hosted, mobile-friendly opt-in pages with your branding and compliance disclosures."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create page
          </Button>
        }
      />

      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Published pages" value={formatNumber(3)} />
        <StatCard label="Total views" value={formatNumber(totalViews)} />
        <StatCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          hint={`${formatNumber(totalSignups)} signups`}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {signupPages.slice(0, 2).map((page) => (
          <Card key={page.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <CardTitle>{page.name}</CardTitle>
              </div>
              <StatusChip status={page.status} />
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">/{page.slug}</p>
            <div className="mt-4 aspect-[16/10] rounded-lg border border-border bg-gradient-to-br from-primary/5 to-muted/60 p-4">
              <div className="mx-auto max-w-[200px] rounded-lg bg-card p-3 shadow-sm">
                <div className="mb-2 h-2 w-16 rounded bg-primary/30" />
                <div className="mb-1 h-2 w-full rounded bg-muted" />
                <div className="mb-3 h-2 w-3/4 rounded bg-muted" />
                <div className="h-6 w-full rounded bg-primary/20" />
              </div>
            </div>
            <dl className="mt-4 flex gap-6 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Views</dt>
                <dd className="font-semibold">{formatNumber(page.views)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Signups</dt>
                <dd className="font-semibold">{formatNumber(page.signups)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">List</dt>
                <dd>{page.list}</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview
                </Button>
              </a>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>All signup pages</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Slug</TH>
                <TH>List</TH>
                <TH>Views</TH>
                <TH>Signups</TH>
                <TH>Status</TH>
                <TH>URL</TH>
              </TR>
            </THead>
            <TBody>
              {signupPages.map((page) => (
                <TR key={page.id}>
                  <TD className="font-medium">{page.name}</TD>
                  <TD className="font-mono text-xs text-muted-foreground">{page.slug}</TD>
                  <TD>{page.list}</TD>
                  <TD>{formatNumber(page.views)}</TD>
                  <TD>{formatNumber(page.signups)}</TD>
                  <TD>
                    <StatusChip status={page.status} />
                  </TD>
                  <TD>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
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
