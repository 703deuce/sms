"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";
import { settingsTabs } from "@/lib/settings-tabs";

type LimitsProps = {
  a2pStatus: string;
  a2pApproved: boolean;
  dailyCapDefault: number;
  useCase?: string | null;
};

export function LimitsSettingsForm({
  a2pStatus,
  a2pApproved,
  dailyCapDefault,
  useCase,
}: LimitsProps) {
  const [maxAudience, setMaxAudience] = useState(a2pApproved ? 50000 : 5000);
  const [approvalThreshold, setApprovalThreshold] = useState(a2pApproved ? 5000 : 500);
  const [dailyCap, setDailyCap] = useState(dailyCapDefault);
  const [inboxRate, setInboxRate] = useState(30);
  const [apiRate, setApiRate] = useState(120);
  const [importBatch, setImportBatch] = useState("10000");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/limits")
      .then((r) => r.json())
      .then((j) => {
        const l = j.data || {};
        if (l.maxAudience) setMaxAudience(l.maxAudience);
        if (l.approvalThreshold) setApprovalThreshold(l.approvalThreshold);
        if (l.dailyCap) setDailyCap(l.dailyCap);
        if (l.inboxRate) setInboxRate(l.inboxRate);
        if (l.apiRate) setApiRate(l.apiRate);
        if (l.importBatch) setImportBatch(String(l.importBatch));
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxAudience,
          approvalThreshold,
          dailyCap,
          inboxRate,
          apiRate,
          importBatch: Number(importBatch),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const monthlyCap = a2pApproved ? 250000 : 5000;
  const sentToday = Math.round(dailyCapDefault / 30);

  return (
    <div>
      <PageHeader
        title="Usage limits"
        description="Account-level send caps, rate limits, and approval thresholds."
        actions={<Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save limits"}</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Daily send cap" value={formatNumber(dailyCap)} hint="Segments per day" />
        <StatCard label="Sent today (est.)" value={formatNumber(sentToday)} />
        <StatCard label="Monthly cap" value={formatNumber(monthlyCap)} hint="Segments per month" />
        <StatCard label="A2P throughput" value={a2pApproved ? "60 MPS" : "1 MPS"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Campaign limits</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="maxAudience">Max audience per campaign</Label>
              <Input
                id="maxAudience"
                type="number"
                value={maxAudience}
                onChange={(e) => setMaxAudience(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="approvalThreshold">Require approval above</Label>
              <Input
                id="approvalThreshold"
                type="number"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Campaigns exceeding this size require owner approval before send.
              </p>
            </div>
            <div>
              <Label htmlFor="dailyCap">Daily segment cap</Label>
              <Input
                id="dailyCap"
                type="number"
                value={dailyCap}
                onChange={(e) => setDailyCap(Number(e.target.value))}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Rate limits</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="inboxRate">Inbox messages per minute</Label>
              <Input
                id="inboxRate"
                type="number"
                value={inboxRate}
                onChange={(e) => setInboxRate(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="apiRate">API requests per minute</Label>
              <Input
                id="apiRate"
                type="number"
                value={apiRate}
                onChange={(e) => setApiRate(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="importBatch">Max import batch size</Label>
              <Select
                id="importBatch"
                value={importBatch}
                onChange={(e) => setImportBatch(e.target.value)}
              >
                <option value="5000">5,000 contacts</option>
                <option value="10000">10,000 contacts</option>
                <option value="50000">50,000 contacts</option>
              </Select>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>A2P registration impact</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Your current A2P status is <strong>{a2pStatus}</strong>. Approved registration unlocks higher
          throughput and daily caps.
        </p>
        {useCase ? (
          <p className="mt-2 text-sm text-muted-foreground">Registered use case: {useCase}</p>
        ) : null}
        <Link href="/compliance" className="mt-4 inline-flex">
          <Button variant="outline" size="sm">View compliance status</Button>
        </Link>
      </Card>

      {saved ? <p className="mt-4 text-sm text-primary">Limits saved.</p> : null}
    </div>
  );
}
