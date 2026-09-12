"use client";

import type { SetupOverviewSummaryRow, SetupFlowStage } from "@/lib/mctb/setup-overview-model";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  Activity,
  Ban,
  Bell,
  ChevronRight,
  MessageSquare,
  PhoneForwarded,
  Play,
  RefreshCw,
  ShieldCheck,
  Voicemail,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const ROW_ICONS: Record<string, LucideIcon> = {
  phone: PhoneForwarded,
  recovery: RefreshCw,
  consent: ShieldCheck,
  "text-back": MessageSquare,
  voicemail: Voicemail,
  notifications: Bell,
  exclusions: Ban,
  test: Activity,
};

function iconTileClass(status: SetupOverviewSummaryRow["status"]) {
  if (status === "ok") return "mctb-setup-icon-tile mctb-setup-icon-tile--ok";
  if (status === "warning") return "mctb-setup-icon-tile mctb-setup-icon-tile--warn";
  if (status === "error") return "mctb-setup-icon-tile mctb-setup-icon-tile--err";
  return "mctb-setup-icon-tile";
}

function chipClass(status: SetupOverviewSummaryRow["status"]) {
  if (status === "ok") return "mctb-setup-chip mctb-setup-chip--ok";
  if (status === "warning") return "mctb-setup-chip mctb-setup-chip--warning";
  if (status === "error") return "mctb-setup-chip mctb-setup-chip--error";
  return "mctb-setup-chip";
}

export function SetupOverviewSummaryRowLink({ row }: { row: SetupOverviewSummaryRow }) {
  const Icon = ROW_ICONS[row.id] || Activity;
  return (
    <Link href={row.href} className="mctb-setup-summary-row">
      <div className={iconTileClass(row.status)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="mctb-setup-summary-row__main">
        <div className="mctb-setup-summary-row__title">{row.title}</div>
        <div className="mctb-setup-summary-row__secondary">{row.secondary}</div>
      </div>
      <div className="mctb-setup-summary-row__detail">{row.operationalDetail}</div>
      <span className={chipClass(row.status)}>{row.statusLabel}</span>
      <ChevronRight className="mctb-setup-summary-row__chevron h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function SetupOverviewFlowStrip({ stages }: { stages: SetupFlowStage[] }) {
  return (
    <div className="mctb-setup-flow" aria-label="How your recovery currently works">
      <p className="mctb-setup-flow__label">How your recovery currently works</p>
      <div className="mctb-setup-flow__track">
        {stages.map((stage, i) => (
          <div key={stage.id} className="mctb-setup-flow__stage">
            {i > 0 ? <span className="mctb-setup-flow__arrow" aria-hidden>→</span> : null}
            <div className={`mctb-setup-flow__pill mctb-setup-flow__pill--${stage.tone}`}>
              <span className="mctb-setup-flow__stage-label">{stage.label}</span>
              <span className="mctb-setup-flow__stage-state">{stage.stateLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: MCTB_ROUTES.setupTest, label: "Run live test", icon: Play },
  { href: MCTB_ROUTES.setupPhone, label: "Forwarding instructions", icon: PhoneForwarded },
  { href: MCTB_ROUTES.setupTextBack, label: "Edit recovery message", icon: MessageSquare },
  { href: MCTB_ROUTES.setupConsent, label: "Change consent method", icon: ShieldCheck },
  { href: MCTB_ROUTES.setupVoicemail, label: "Change greeting", icon: Voicemail },
] as const;

export function SetupOverviewQuickActions() {
  return (
    <div className="mctb-setup-panel mctb-setup-panel--elevated">
      <h2>Quick actions</h2>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href} className="mctb-setup-quick-action">
            <span className="mctb-setup-quick-action__left">
              <span className="mctb-setup-quick-action__icon">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              {action.label}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#8b939e]" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
