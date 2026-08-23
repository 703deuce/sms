"use client";

import {
  SrMetricCard,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import { OverviewStatusSection } from "@/components/smart-routing/overview-status-section";
import { CloseNowControl } from "@/components/smart-routing/close-now-control";
import {
  FLOW_TYPE_LABELS,
  fmtPhoneDisplay,
} from "@/lib/smart-routing/display";
import {
  shouldUseWireframeOverview,
  WIREFRAME_OVERVIEW_METRICS,
} from "@/lib/smart-routing/wireframe-demo";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  GitBranch,
  Grid3x3,
  MessageSquare,
  Network,
  Phone,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

type FlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  todayCalls?: number;
  assignedPhoneNumberId?: string | null;
  businessNumberE164?: string | null;
  draftConfigJson?: DraftConfig;
};

type Metrics = {
  activeFlows: number;
  routedToday: number;
  recovered: number;
  failures: number;
};

type WorkspaceStatus = {
  publicBusinessE164: string | null;
  routingNumberE164: string | null;
  callbackNumberE164: string | null;
  callerIdStatus: string;
  authorizedCallerCount: number;
  outboundBusinessCallbacks?: number;
  primaryFlow?: { id: string; name: string; status: string; type: string } | null;
  readiness: import("@/lib/smart-routing/setup-readiness").SetupReadiness;
  scheduleOverride?: { mode?: string; expiresAt?: string } | null;
};

type Template = {
  type: string;
  title: string;
  subtitle: string;
  bestFor: string[];
};

const FLOW_ICONS: Record<string, typeof Grid3x3> = {
  phone_menu: Grid3x3,
  missed_call_recovery: MessageSquare,
  after_hours: Clock,
  department: Users,
  custom: Network,
};

export function SmartRoutingOverviewView({
  flows,
  metrics,
  templates,
  workspaceStatus,
  scheduleOverride,
  onWorkspaceRefresh,
}: {
  flows: FlowRow[];
  metrics: Metrics | null;
  templates: Template[];
  workspaceStatus?: WorkspaceStatus | null;
  scheduleOverride?: { mode?: string; expiresAt?: string } | null;
  onWorkspaceRefresh?: () => void;
}) {
  const useWireframe = shouldUseWireframeOverview(flows.length, metrics);
  const displayMetrics = useWireframe
    ? WIREFRAME_OVERVIEW_METRICS
    : {
        activeFlows: metrics?.activeFlows ?? 0,
        routedToday: metrics?.routedToday ?? 0,
        recovered: metrics?.recovered ?? 0,
        failures: metrics?.failures ?? 0,
        trends: {
          activeFlows: metrics?.activeFlows ? 12 : null,
          routedToday: metrics?.routedToday ? 15 : null,
          recovered: metrics?.recovered ? 9 : null,
          failures: metrics?.failures ? -25 : null,
        },
      };

  const templateCards = templates.filter((t) => t.type !== "custom").slice(0, 4);

  return (
    <SrPageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Smart Routing</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#6b7280]">
            Keep your number. Keep your phones. Add professional call routing without changing
            carriers or installing another calling app. Return business calls from your verified
            caller ID.
          </p>
          <Link
            href="/smart-routing/setup"
            className="mt-2 inline-block text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            Open Smart Routing setup →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/numbers">
            <SrOutlineButton>
              <BookOpen className="h-4 w-4 text-[#6366f1]" />
              View Forwarding Guide
            </SrOutlineButton>
          </Link>
          <Link href="/smart-routing/flows">
            <SrPrimaryButton>
              <Plus className="h-4 w-4" />
              Call Flows
            </SrPrimaryButton>
          </Link>
        </div>
      </div>

      {workspaceStatus ? <OverviewStatusSection status={workspaceStatus} /> : null}

      {scheduleOverride !== undefined && onWorkspaceRefresh ? (
        <CloseNowControl
          scheduleOverride={scheduleOverride}
          onUpdated={onWorkspaceRefresh}
        />
      ) : null}

      <Link
        href="/smart-routing/ai"
        className={cn(
          srCard,
          "flex items-start gap-4 border-[#e0e7ff] bg-gradient-to-br from-[#f8faff] to-white p-5 transition-colors hover:border-[#c7d2fe]",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6366f1] text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-[#111827]">AI Routing Assistant</h2>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Build, change, explain, and improve routing in plain language — &quot;Sarah is out this
            week, route her calls to Mike&quot; or &quot;Why are we missing Service calls?&quot;
          </p>
          <span className="mt-2 text-[13px] font-semibold text-[#6366f1]">Open assistant →</span>
        </div>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SrMetricCard
          label="Active Flows"
          value={displayMetrics.activeFlows}
          icon={<GitBranch className="h-5 w-5" />}
          trend={displayMetrics.trends.activeFlows}
          trendLabel="vs last week"
        />
        <SrMetricCard
          label="Calls Routed Today"
          value={displayMetrics.routedToday}
          icon={<PhoneForwarded className="h-5 w-5" />}
          iconClass="bg-emerald-50 text-emerald-600"
          trend={displayMetrics.trends.routedToday}
          trendLabel="vs yesterday"
        />
        <SrMetricCard
          label="Missed Calls Recovered"
          value={displayMetrics.recovered}
          icon={<RefreshCw className="h-5 w-5" />}
          iconClass="bg-orange-50 text-orange-600"
          trend={displayMetrics.trends.recovered}
          trendLabel="vs yesterday"
        />
        <SrMetricCard
          label="Routing Failures"
          value={displayMetrics.failures}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconClass="bg-red-50 text-red-600"
          trend={displayMetrics.trends.failures}
          trendLabel="vs yesterday"
          trendPositiveIsGood={false}
        />
      </div>

      <div className={cn(srCard, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#111827]">Call Flows</h2>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              {displayMetrics.activeFlows} active flow{displayMetrics.activeFlows === 1 ? "" : "s"}.
              Create, edit, and test phone trees from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/smart-routing/flows">
              <SrOutlineButton>View all flows</SrOutlineButton>
            </Link>
            <Link href="/smart-routing/new">
              <SrPrimaryButton>
                <Plus className="h-4 w-4" />
                Create Flow
              </SrPrimaryButton>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">Smart Routing Templates</h2>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            Start with a proven template and customize it for your business.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {templateCards.map((t) => {
              const Icon = FLOW_ICONS[t.type] ?? Grid3x3;
              return (
                <Link
                  key={t.type}
                  href="/smart-routing/new"
                  className="rounded-xl border border-[#e5e7eb] p-4 transition-colors hover:border-[#c7d2fe] hover:bg-[#fafafa]"
                >
                  <Icon className="h-5 w-5 text-[#6366f1]" />
                  <p className="mt-2 text-[13px] font-bold text-[#111827]">{t.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">{t.subtitle}</p>
                  <span className="mt-3 text-[12px] font-semibold text-[#6366f1]">
                    Use Template →
                  </span>
                </Link>
              );
            })}
          </div>
          <Link
            href="/smart-routing/new"
            className="mt-4 text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            View all templates →
          </Link>
        </div>

        <div className={cn(srCard, "p-5")}>
          <h2 className="text-[15px] font-bold text-[#111827]">How It Works</h2>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {[
              {
                n: 1,
                icon: Phone,
                title: "Customer calls your business number",
                desc: "Callers use the number they already know.",
              },
              {
                n: 2,
                icon: Network,
                title: "Transovo routes the call automatically",
                desc: "Greeting, menu, and routing on every call.",
              },
              {
                n: 3,
                icon: Users,
                title: "Caller reaches the right person",
                desc: "Voicemail, AI, or text recovery when needed.",
              },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex flex-1 items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1] text-[12px] font-bold text-white">
                    {step.n}
                  </span>
                  {i < arr.length - 1 ? (
                    <div className="mt-2 hidden h-8 w-px border-l border-dashed border-[#c7d2fe] lg:block" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <step.icon className="h-4 w-4 text-[#6366f1]" />
                  <p className="mt-1 text-[12px] font-bold text-[#111827]">{step.title}</p>
                  <p className="mt-0.5 text-[11px] text-[#6b7280]">{step.desc}</p>
                </div>
                {i < arr.length - 1 ? (
                  <div className="hidden flex-1 border-t border-dashed border-[#d1d5db] lg:mt-4 lg:block" />
                ) : null}
              </div>
            ))}
          </div>
          <Link
            href="/smart-routing/new"
            className="mt-6 text-[13px] font-semibold text-[#6366f1] hover:underline"
          >
            Learn more about Smart Routing →
          </Link>
        </div>
      </div>
    </SrPageShell>
  );
}
