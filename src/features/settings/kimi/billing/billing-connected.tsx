"use client";

import { useEffect, useState } from "react";
import "@/components/settings/kimi-ui/billing/reference.css";
import type {
  Billing,
  Estimate,
  LedgerEntry,
  Metrics,
  UsageRow,
} from "@/components/settings/kimi-ui/billing/types";
import { SettingsTabs } from "@/components/settings/kimi-ui/billing/components/SettingsTabs";
import { BillingStatCards } from "@/components/settings/kimi-ui/billing/components/BillingStatCards";
import { CreditPurchaseCard } from "@/components/settings/kimi-ui/billing/components/CreditPurchaseCard";
import { EstimateCard } from "@/components/settings/kimi-ui/billing/components/EstimateCard";
import { InvoicesCard } from "@/components/settings/kimi-ui/billing/components/InvoicesCard";
import { LedgerCard } from "@/components/settings/kimi-ui/billing/components/LedgerCard";
import { UsageTable } from "@/components/settings/kimi-ui/billing/components/UsageTable";
import { resolveSettingsTabs } from "@/features/settings/kimi/shared/settings-tabs";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type Props = {
  highlightProduct?: string | null;
};

export function BillingSettingsConnected({ highlightProduct }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [personalMode, setPersonalMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const tabs = resolveSettingsTabs(personalMode);

  function applyData(data: {
    metrics?: Metrics;
    usage?: UsageRow[];
    billing?: Billing;
    ledger?: LedgerEntry[];
    estimate?: Estimate;
  }) {
    if (data.metrics) setMetrics(data.metrics);
    setUsage(data.usage || []);
    if (data.billing) setBilling(data.billing);
    if (data.ledger) setLedger(data.ledger);
    if (data.estimate) setEstimate(data.estimate);
  }

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetch("/api/settings/billing")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) applyData(j.data);
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.workspaceType === "PERSONAL") setPersonalMode(true);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="tv-page">
      <div className="tv-page-header">
        <div>
          <h1 className="tv-page-title">Billing</h1>
          <p className="tv-page-desc">Plan, credits, itemized estimate, ledger, and invoices.</p>
        </div>
      </div>

      <SettingsTabs items={tabs} />

      {highlightProduct ? (
        <div className="tv-banner tv-banner-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 />
          Review billing for {highlightProduct.replace(/_/g, " ")}.
        </div>
      ) : null}

      {message && (
        <div className={message.kind === "success" ? "tv-banner tv-banner-success" : "tv-banner tv-banner-error"}>
          {message.kind === "success" ? <CheckCircle2 /> : <XCircle />}
          {message.text}
        </div>
      )}

      {loading && (
        <div className="tv-card">
          <div className="tv-card-body">
            <div className="tv-skeleton" style={{ height: 120 }} />
          </div>
        </div>
      )}

      {failed && !loading && (
        <div className="tv-empty" style={{ borderColor: "#fecdca", background: "#fef6f5" }}>
          <div className="tv-empty-icon" style={{ background: "#fef3f2", color: "#b42318" }}>
            <AlertTriangle />
          </div>
          <h3 className="tv-empty-title">Billing couldn&apos;t be loaded</h3>
          <p className="tv-empty-desc">Try loading it again.</p>
          <button className="tv-btn tv-btn-outline" onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !failed && metrics && billing && (
        <>
          <BillingStatCards metrics={metrics} billing={billing} personalMode={personalMode} />
          <div className="tv-grid-2">
            <CreditPurchaseCard
              billing={billing}
              readOnly={false}
              onMessage={(text, kind) => setMessage({ text, kind })}
              onRefresh={load}
            />
            {estimate ? <EstimateCard estimate={estimate} /> : null}
          </div>
          <UsageTable usage={usage} />
          <div className="tv-grid-2">
            <LedgerCard ledger={ledger} />
            {estimate ? <InvoicesCard estimate={estimate} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
