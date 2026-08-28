"use client";

import { CampaignActions, campaignLooksLikeMassText } from "@/components/campaigns/campaign-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getCampaignCategory } from "@/lib/campaigns/catalog";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { campaignTabs } from "@/lib/campaign-tabs";

type LiveCampaign = {
  id: string;
  name: string;
  category?: string | null;
  type?: string;
  status: string;
  audience?: string;
  sent?: number;
  delivered?: number;
  replies?: number;
  scheduledAt?: string | null;
  createdAt?: string;
  configJson?: unknown;
};

export default function AllCampaignsPage() {
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load campaigns");
        return r.json();
      })
      .then((json) => setCampaigns(json.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="All campaigns"
        description="Live campaigns from your workspace. Create new ones from the 14 core categories."
        actions={
          <Link href="/campaigns/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"><Plus className="h-4 w-4" />
              New campaign</Link>
        }
      />
      <Tabs items={campaignTabs} />

      <Card className="overflow-hidden p-0">
        {loading && <p className="p-6 text-sm text-slate-500">Loading…</p>}
        {error && <p className="p-6 text-sm text-rose-600">{error}</p>}
        {!loading && !error && campaigns.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-slate-600">No campaigns yet.</p>
            <Link href="/campaigns/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">Create campaign</Link>
          </div>
        )}
        {!loading && campaigns.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH>Status</TH>
                <TH>Sent</TH>
                <TH>Replies</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {campaigns.map((c) => {
                const cat = getCampaignCategory(c.category || undefined);
                return (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-slate-600">{cat?.title || c.category || c.type || "—"}</TD>
                    <TD>
                      <StatusChip status={c.status} />
                    </TD>
                    <TD>{c.sent ?? 0}</TD>
                    <TD>{c.replies ?? 0}</TD>
                    <TD>
                      <CampaignActions
                        campaignId={c.id}
                        status={c.status}
                        variant="row"
                        isMassText={campaignLooksLikeMassText(c.configJson)}
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
