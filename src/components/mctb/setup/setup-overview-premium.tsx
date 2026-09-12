"use client";

import type { SetupFlowStage, SetupOverviewSummaryRow } from "@/lib/mctb/setup-overview-model";
import { resolveSetupChipTone } from "@/lib/mctb/setup-overview-model";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  Activity,
  Ban,
  Bell,
  ChevronRight,
  MessageSquare,
  PhoneForwarded,
  PhoneMissed,
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

const FLOW_ICONS: Record<string, LucideIcon> = {
  missed: PhoneMissed,
  forward: PhoneForwarded,
  consent: ShieldCheck,
  text: MessageSquare,
  vm: Voicemail,
};

function iconTileClass(row: SetupOverviewSummaryRow) {
  if (row.id === "recovery" && row.status === "ok") {
    return "mctb-setup-icon-tile mctb-setup-icon-tile--accent";
  }
  if (row.id === "test" && row.statusLabel.toLowerCase().includes("passed")) {
    return "mctb-setup-icon-tile mctb-setup-icon-tile--accent";
  }
  if (row.id === "exclusions" && row.statusLabel.toLowerCase() === "active") {
    return "mctb-setup-icon-tile mctb-setup-icon-tile--warn";
  }
  if (row.status === "warning") return "mctb-setup-icon-tile mctb-setup-icon-tile--warn";
  if (row.status === "error") return "mctb-setup-icon-tile mctb-setup-icon-tile--err";
  return "mctb-setup-icon-tile";
}

function chipClass(row: SetupOverviewSummaryRow) {
  const tone = resolveSetupChipTone(row.statusLabel, row.status);
  return `mctb-setup-chip mctb-setup-chip--${tone}`;
}

export function SetupOverviewGroupHead({ label, spaced }: { label: string; spaced?: boolean }) {
  return (
    <div className={`mctb-setup-group-head${spaced ? " mt-1" : ""}`}>
      <span className="mctb-setup-group-head__label">{label}</span>
      <span className="mctb-setup-group-head__rule" aria-hidden />
    </div>
  );
}

export function SetupOverviewSummaryRowLink({ row }: { row: SetupOverviewSummaryRow }) {
  const Icon = ROW_ICONS[row.id] || Activity;
  return (
    <Link href={row.href} className="mctb-setup-summary-row" title={row.operationalDetail}>
      <div className={iconTileClass(row)}>
        <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden />
      </div>
      <div className="mctb-setup-summary-row__main">
        <div className="mctb-setup-summary-row__title">{row.title}</div>
        <div className="mctb-setup-summary-row__secondary">{row.secondary}</div>
      </div>
      <div className="mctb-setup-summary-row__detail">{row.operationalDetail}</div>
      <span className={chipClass(row)}>{row.statusLabel}</span>
      <ChevronRight className="mctb-setup-summary-row__chevron h-4 w-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function SetupOverviewFlowStrip({ stages }: { stages: SetupFlowStage[] }) {
  return (
    <div className="mctb-setup-process" aria-label="How your recovery currently works">
      <p className="mctb-setup-process__label">How recovery works</p>
      <div className="mctb-setup-process__grid">
        <div className="mctb-setup-process__line" aria-hidden />
        {stages.map((stage) => {
          const Icon = FLOW_ICONS[stage.id] || Activity;
          const dotClass =
            stage.tone === "ok"
              ? "mctb-setup-process__dot mctb-setup-process__dot--ok"
              : stage.tone === "warning"
                ? "mctb-setup-process__dot mctb-setup-process__dot--warning"
                : "mctb-setup-process__dot";
          return (
            <div key={stage.id} className="mctb-setup-process__node">
              <div className={dotClass}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
              </div>
              <span className="mctb-setup-process__node-title">{stage.label}</span>
              <span className="mctb-setup-process__node-state">{stage.stateLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { href: MCTB_ROUTES.setupTest, label: "Run live test", icon: Play },
  { href: MCTB_ROUTES.setupPhone, label: "Forwarding instructions", icon: PhoneForwarded },
  { href: MCTB_ROUTES.setupTextBack, label: "Edit recovery message", icon: MessageSquare },
  { href: MCTB_ROUTES.setupConsent, label: "Change consent method", icon: ShieldCheck },
  { href: MCTB_ROUTES.setupVoicemail, label: "Change voicemail greeting", icon: Voicemail },
] as const;

export function SetupOverviewQuickActions() {
  return (
    <div className="mctb-setup-panel mctb-setup-panel--level3">
      <h2>Quick actions</h2>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href} className="mctb-setup-quick-action">
            <span className="mctb-setup-quick-action__left">
              <span className="mctb-setup-quick-action__icon">
                <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden />
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
