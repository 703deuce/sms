"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Contacts,
  Home,
  Inbox,
  Integrations,
  Lock,
  Meetings,
  Payments,
  Receipt,
  Settings,
  Video,
  Wallet,
  Workflow,
  XCircle,
  Zap,
} from "./icons";
import { SettingsTabs } from "./SettingsTabs";
import { BillingStatCards } from "./BillingStatCards";
import { CreditPurchaseCard } from "./CreditPurchaseCard";
import { EstimateCard } from "./EstimateCard";
import { InvoicesCard } from "./InvoicesCard";
import { LedgerCard } from "./LedgerCard";
import { UsageTable } from "./UsageTable";
import {
  mockBilling,
  mockEstimate,
  mockLedger,
  mockMetrics,
  mockUsage,
} from "../mock-data";

type Mode = "normal" | "loading" | "empty" | "error" | "readonly";

const NAV = [
  { label: "Home", icon: Home },
  { label: "Appointments", icon: CalendarDays },
  { label: "Booking", icon: Zap },
  { label: "Contacts", icon: Contacts },
  { label: "Messages", icon: Inbox },
  { label: "Automations", icon: Workflow },
  { label: "Meetings", icon: Video },
  { label: "Payments", icon: Payments },
  { label: "Analytics", icon: Receipt },
  { label: "Integrations", icon: Integrations },
];

function Sidebar() {
  return (
    <aside className="tv-sidebar">
      <div className="tv-logo">
        <div className="tv-logo-mark">T</div>
        Transovo
      </div>
      <div className="tv-nav-label">Workspace</div>
      <nav aria-label="Main navigation">
        {NAV.map((n) => (
          <a key={n.label} className="tv-nav-item" href="#">
            <n.icon />
            {n.label}
          </a>
        ))}
      </nav>
      <div className="tv-sidebar-foot">
        <a className="tv-nav-item active" href="#" aria-current="page">
          <Settings />
          Settings
        </a>
      </div>
    </aside>
  );
}

function LoadingState() {
  return (
    <>
      <div className="tv-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tv-stat">
            <div className="tv-skeleton" style={{ height: 11, width: "55%" }} />
            <div className="tv-skeleton" style={{ height: 26, width: "70%", marginTop: 10 }} />
            <div className="tv-skeleton" style={{ height: 10, width: "45%", marginTop: 8 }} />
          </div>
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="tv-card">
          <div className="tv-card-body">
            <div className="tv-skeleton" style={{ height: 14, width: "30%", marginBottom: 14 }} />
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="tv-skeleton" style={{ height: 34, marginBottom: 8 }} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="tv-empty">
      <div className="tv-empty-icon">
        <Wallet />
      </div>
      <h3 className="tv-empty-title">No billing activity yet</h3>
      <p className="tv-empty-desc">
        Billing activity appears here once your workspace sends appointment reminders or purchases
        credits. Add credits to get started.
      </p>
      <button className="tv-btn tv-btn-primary">Add credits</button>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="tv-empty" style={{ borderColor: "#fecdca", background: "#fef6f5" }}>
      <div className="tv-empty-icon" style={{ background: "#fef3f2", color: "#b42318" }}>
        <AlertTriangle />
      </div>
      <h3 className="tv-empty-title">Billing couldn't be loaded</h3>
      <p className="tv-empty-desc">
        We couldn't load your plan, credits, and invoices. Your existing billing is unaffected —
        try loading it again.
      </p>
      <button className="tv-btn tv-btn-outline" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}

export function BillingSettingsPanel({ mode }: { mode: Mode }) {
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const readOnly = mode === "readonly";

  return (
    <div className="tv-shell">
      <Sidebar />
      <main className="tv-main" id="main">
        <div className="tv-page-header">
          <div>
            <h1 className="tv-page-title">Billing</h1>
            <p className="tv-page-desc">
              Plan, credits, itemized estimate, ledger, and invoices.
            </p>
          </div>
          <div className="tv-header-actions">
            <button className="tv-btn tv-btn-outline" disabled={readOnly}>
              <Receipt /> View invoices
            </button>
            <button className="tv-btn tv-btn-primary" disabled={readOnly}>
              Add credits
            </button>
          </div>
        </div>

        <SettingsTabs />

        {readOnly && (
          <div className="tv-readonly">
            <Lock />
            You have view-only access to billing. Contact a workspace owner to make changes.
          </div>
        )}

        {message && (
          <div className={message.kind === "success" ? "tv-banner tv-banner-success" : "tv-banner tv-banner-error"}>
            {message.kind === "success" ? <CheckCircle2 /> : <XCircle />}
            {message.text}
          </div>
        )}

        {mode === "loading" && <LoadingState />}
        {mode === "empty" && <EmptyState />}
        {mode === "error" && <ErrorState />}

        {(mode === "normal" || mode === "readonly") && (
          <>
            <BillingStatCards metrics={mockMetrics} billing={mockBilling} />

            <div className="tv-grid-2">
              <CreditPurchaseCard
                billing={mockBilling}
                readOnly={readOnly}
                onMessage={(text, kind) => setMessage({ text, kind })}
              />
              <EstimateCard estimate={mockEstimate} />
            </div>

            <UsageTable usage={mockUsage} />

            <div className="tv-grid-2">
              <LedgerCard ledger={mockLedger} />
              <InvoicesCard estimate={mockEstimate} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
