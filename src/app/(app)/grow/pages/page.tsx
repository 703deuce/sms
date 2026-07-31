import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { loadOptInForms, requireWorkspaceContext } from "@/lib/workspace-data";
import { ExternalLink, Globe, Plus } from "lucide-react";

import { growTabs } from "@/lib/grow-tabs";

export default async function SignupPagesPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const signupPages = await loadOptInForms(workspaceId);

  const published = signupPages.filter((p) => p.status.toLowerCase() === "active").length;
  const totalViews = signupPages.reduce((sum, p) => sum + p.submissions, 0);
  const totalSignups = signupPages.reduce((sum, p) => sum + p.submissions, 0);
  const conversionRate =
    totalViews > 0 ? ((totalSignups / totalViews) * 100).toFixed(1) : "0";

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
        <StatCard label="Published pages" value={formatNumber(published)} />
        <StatCard label="Total submissions" value={formatNumber(totalViews)} />
        <StatCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          hint={`${formatNumber(totalSignups)} signups`}
        />
      </div>

      {signupPages.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-8 w-8" />}
          title="No signup pages"
          description="Create an opt-in form to get a hosted signup page with your branding and compliance disclosures."
          actionLabel="Create form"
          actionHref="/grow/forms"
        />
      ) : (
        <>
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
                <p className="mt-2 font-mono text-xs text-muted-foreground">/{page.slug || "—"}</p>
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
                    <dt className="text-xs text-muted-foreground">Submissions</dt>
                    <dd className="font-semibold">{formatNumber(page.submissions)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">List</dt>
                    <dd>{page.listName}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex gap-2">
                  {page.url ? (
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
                  ) : null}
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
                    <TH>Submissions</TH>
                    <TH>Status</TH>
                    <TH>URL</TH>
                  </TR>
                </THead>
                <TBody>
                  {signupPages.map((page) => (
                    <TR key={page.id}>
                      <TD className="font-medium">{page.name}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{page.slug || "—"}</TD>
                      <TD>{page.listName}</TD>
                      <TD>{formatNumber(page.submissions)}</TD>
                      <TD>
                        <StatusChip status={page.status} />
                      </TD>
                      <TD>
                        {page.url ? (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
