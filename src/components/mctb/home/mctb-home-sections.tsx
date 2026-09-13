"use client";

import { useRouter } from "next/navigation";
import type { MctbOverviewPayload, MctbOverviewStatus } from "@/lib/mctb/overview";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  PhoneMissed,
  Send,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import type { MctbAttentionItem } from "@/components/mctb/kimi-ui/mctb-needs-attention";
import type { ReactNode } from "react";
import "./mctb-home.css";

/** Shared module header — same geometry for every Home section. */
export function MctbHomeSectionHead({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mctb-home-section-head">
      <h2 id={id} className="mctb-home-section-title">{title}</h2>
      {action ?? (
        <span className="mctb-home-section-head-action-placeholder" aria-hidden>
          Open inbox →
        </span>
      )}
    </div>
  );
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function fmtConvTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function semanticCellClass(label: string, kind: "recovery" | "reply"): string {
  const l = label.toLowerCase();
  if (kind === "reply") {
    if (l.includes("needs reply") || l.includes("waiting")) return "mctb-home-cell--pending";
    if (l.includes("replied") || l.includes("yes")) return "mctb-home-cell--success";
    return "mctb-home-cell--secondary";
  }
  if (l.includes("sent") || l.includes("delivered") || l.includes("recovered")) {
    return "mctb-home-cell--success";
  }
  if (l.includes("pending") || l.includes("scheduled") || l.includes("queued")) {
    return "mctb-home-cell--pending";
  }
  if (l.includes("suppressed") || l.includes("failed") || l.includes("blocked") || l.includes("skipped")) {
    return "mctb-home-cell--error";
  }
  if (l.includes("not sent") || l.includes("—")) return "mctb-home-cell--tertiary";
  return "mctb-home-cell--secondary";
}

function setupValueClass(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("verified") || v.includes("active") || v.includes("ready") || v.includes("press 1")) {
    return "mctb-home-setup-value--ok";
  }
  if (
    v.includes("not") ||
    v.includes("needs") ||
    v.includes("incomplete") ||
    v.includes("attention") ||
    v.includes("paused")
  ) {
    return "mctb-home-setup-value--warn";
  }
  return "";
}

export function statusChip(status: MctbOverviewStatus, label: string) {
  const tone =
    status === "active"
      ? "mctb-home-status-chip--active"
      : status === "paused"
        ? "mctb-home-status-chip--paused"
        : status === "setup_incomplete"
          ? "mctb-home-status-chip--setup"
          : "mctb-home-status-chip--attention";
  return (
    <span className={`mctb-home-status-chip ${tone}`} role="status">
      {status === "active" ? (
        <span className="mctb-home-status-dot" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function MctbHomeKpiStrip({ data }: { data: MctbOverviewPayload }) {
  const kpis = [
    {
      label: "Missed calls",
      value: data.kpis.missedCallsToday,
      sub: "Today",
      href: MCTB_ROUTES.missedCalls,
      icon: PhoneMissed,
      iconTone: "neutral" as const,
      attention: false,
    },
    {
      label: "Recovery texts sent",
      value: data.kpis.recoveryTextsToday,
      sub: "Today",
      href: MCTB_ROUTES.missedCalls,
      icon: Send,
      iconTone: "teal" as const,
      attention: false,
    },
    {
      label: "Replies",
      value: data.kpis.repliesToday,
      sub: "Today",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      iconTone: "info" as const,
      attention: false,
    },
    {
      label: "Need a reply",
      value: data.kpis.needsReplyCount,
      sub: "Conversations",
      href: `${MCTB_ROUTES.conversations}?filter=needs_reply`,
      icon: ShieldAlert,
      iconTone: "amber" as const,
      attention: data.kpis.needsReplyCount > 0,
    },
  ];

  return (
    <div className="mctb-home-kpi-strip" role="list">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <Link
            key={k.label}
            href={k.href}
            className={`mctb-home-kpi${k.attention ? " mctb-home-kpi--attention" : ""}`}
            role="listitem"
          >
            <span
              className={`mctb-home-kpi-icon mctb-home-kpi-icon--${k.iconTone}`}
              aria-hidden
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="mctb-home-kpi-label">{k.label}</span>
              <span className="mctb-home-kpi-value block">{k.value}</span>
              <span className="mctb-home-kpi-sub">{k.sub}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function MctbHomeAttentionOkStrip({ variant = "card" }: { variant?: "card" | "inline" }) {
  const className = variant === "inline" ? "mctb-home-attention-inline" : "mctb-home-attention-ok";
  return (
    <div className={className} role="status">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--mctb-accent-teal-icon)]" aria-hidden />
      <span>Nothing needs attention</span>
    </div>
  );
}

export function MctbHomeRecentMissedCallsTable({
  data,
  attentionOkInline = false,
}: {
  data: MctbOverviewPayload;
  attentionOkInline?: boolean;
}) {
  const router = useRouter();
  const goDetail = (id: string) => router.push(MCTB_ROUTES.missedCallDetail(id));

  return (
    <section className="mctb-home-surface" aria-labelledby="mctb-home-recent-missed">
      <div className="mctb-home-section-head">
        <h2 id="mctb-home-recent-missed" className="mctb-home-section-title">
          Recent missed calls
        </h2>
        <Link href={MCTB_ROUTES.missedCalls} className="mctb-home-link">
          View all →
        </Link>
      </div>
      {attentionOkInline ? <MctbHomeAttentionOkStrip variant="inline" /> : null}
      {data.recentMissedCalls.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-[#1b1e23]">No missed calls yet today.</p>
          <p className="mt-1 text-[12px] text-[#8a919b]">Missed calls will appear here when they occur.</p>
        </div>
      ) : (
        <table className="mctb-home-table">
          <thead>
            <tr>
              <th scope="col">Caller</th>
              <th scope="col">Missed</th>
              <th scope="col">Recovery</th>
              <th scope="col">Reply</th>
            </tr>
          </thead>
          <tbody>
            {data.recentMissedCalls.map((row) => (
              <tr
                key={row.id}
                className="mctb-home-missed-row"
                tabIndex={0}
                role="link"
                aria-label={`Missed call from ${row.callerLabel}`}
                onClick={() => goDetail(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goDetail(row.id);
                  }
                }}
              >
                <td>
                  <span className="mctb-home-caller-primary">{row.callerLabel}</span>
                </td>
                <td className="mctb-home-cell--tertiary">{fmtTime(row.missedAt)}</td>
                <td className={semanticCellClass(row.recoveryLabel, "recovery")}>{row.recoveryLabel}</td>
                <td className={semanticCellClass(row.replyLabel, "reply")}>{row.replyLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Populated attention only — empty state uses `MctbHomeAttentionOkStrip`. */
export function MctbHomeNeedsAttention({ items }: { items: MctbAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mctb-home-surface" aria-labelledby="mctb-home-attention">
      <div className="mctb-home-section-head">
        <h2 id="mctb-home-attention" className="mctb-home-section-title">Needs attention</h2>
      </div>
      <div>
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="mctb-home-attention-row">
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-[18px] text-[#1b1e23]">{item.title}</p>
              {item.subtitle ? (
                <p className="truncate text-[12px] leading-[17px] text-[#8a919b]">{item.subtitle}</p>
              ) : null}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#8a919b]" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MctbHomeRecentConversations({ data }: { data: MctbOverviewPayload }) {
  return (
    <section className="mctb-home-surface mctb-home-module" aria-labelledby="mctb-home-conversations">
      <MctbHomeSectionHead
        id="mctb-home-conversations"
        title="Recent conversations"
        action={
          <Link href={MCTB_ROUTES.conversations} className="mctb-home-link">
            Open inbox →
          </Link>
        }
      />
      {data.recentConversations.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-[13px] font-medium text-[#1b1e23]">No recent conversations.</p>
          <p className="mt-1 text-[12px] text-[#8a919b]">
            Replies and text-back conversations will appear here.
          </p>
        </div>
      ) : (
        <ul className="mctb-home-module-body divide-y divide-[#f0f2f4]">
          {data.recentConversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`${MCTB_ROUTES.conversations}?conversation=${encodeURIComponent(c.id)}`}
                className="mctb-home-interactive-row flex items-start justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-[18px] text-[#1b1e23]">{c.label}</p>
                  <p className="truncate text-[12px] leading-[17px] text-[#8a919b]">{c.preview}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-[#8a919b]">{fmtConvTime(c.updatedAt)}</p>
                  {c.needsReply ? (
                    <span className="mt-0.5 inline-block text-[11px] font-medium text-[#9a6700]">Needs reply</span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SETUP_ROWS: Array<{
  key: string;
  label: string;
  href: string;
  value: (d: MctbOverviewPayload) => string;
}> = [
  { key: "line", label: "Business line", href: MCTB_ROUTES.setupPhone, value: (d) => d.setupHealth.businessLine || "Not set" },
  { key: "fwd", label: "Forwarding", href: MCTB_ROUTES.setupPhone, value: (d) => d.setupHealth.forwardingLabel },
  { key: "consent", label: "Consent", href: MCTB_ROUTES.setupConsent, value: (d) => d.setupHealth.consentLabel },
  {
    key: "sender",
    label: "Text-back sender",
    href: MCTB_ROUTES.numbers,
    value: (d) => d.setupHealth.senderLabel,
  },
  { key: "recovery", label: "Recovery", href: MCTB_ROUTES.setupRecovery, value: (d) => d.setupHealth.recoveryLabel },
];

export function MctbHomeSetupStatus({ data }: { data: MctbOverviewPayload }) {
  return (
    <section className="mctb-home-surface mctb-home-module" aria-labelledby="mctb-home-setup">
      <MctbHomeSectionHead id="mctb-home-setup" title="Setup status" />
      <div className="mctb-home-module-body">
        {SETUP_ROWS.map((row) => (
          <Link key={row.key} href={row.href} className="mctb-home-setup-row mctb-home-interactive-row">
            <span className="mctb-home-setup-label">{row.label}</span>
            <span className={`mctb-home-setup-value ${setupValueClass(row.value(data))}`}>
              {row.value(data)}
            </span>
          </Link>
        ))}
      </div>
      <div className="mctb-home-footer-line">
        <span>
          Last 7 days:{" "}
          <span className="mctb-home-footer-metric">{data.performanceSnapshot.missedCalls}</span> missed ·{" "}
          <span className="mctb-home-footer-metric">{data.performanceSnapshot.recoveryTexts}</span> recovery text
          {data.performanceSnapshot.recoveryTexts === 1 ? "" : "s"} ·{" "}
          <span className="mctb-home-footer-metric">{data.performanceSnapshot.replies}</span> replies
        </span>
        <Link href={MCTB_ROUTES.analytics} className="mctb-home-link">
          View analytics →
        </Link>
      </div>
    </section>
  );
}

export function buildMctbAttentionItems(data: MctbOverviewPayload): MctbAttentionItem[] {
  const items: MctbAttentionItem[] = [];
  if (data.kpis.needsReplyCount > 0) {
    items.push({
      id: "needs-reply",
      title: `${data.kpis.needsReplyCount} conversation${data.kpis.needsReplyCount === 1 ? "" : "s"} need a reply`,
      subtitle: "Customers replied to recovery texts",
      href: `${MCTB_ROUTES.conversations}?filter=needs_reply`,
      kind: "reply",
    });
  }
  if (data.setupHealth.forwardingLabel === "Not verified") {
    items.push({
      id: "forwarding",
      title: "Forwarding needs verification",
      subtitle: "Connect and verify your business line",
      href: MCTB_ROUTES.setupPhone,
      kind: "other",
    });
  }
  if (data.setupHealth.senderLabel === "Needs attention") {
    items.push({
      id: "sender",
      title: "Text-back sender not ready",
      subtitle: "Complete sender registration or number assignment",
      href: MCTB_ROUTES.setupPhone,
      kind: "other",
    });
  }
  if (data.status === "messaging_blocked") {
    items.push({
      id: "messaging-blocked",
      title: "Messaging compliance incomplete",
      subtitle: "Complete requirements to send recovery texts",
      href: MCTB_ROUTES.setup,
      kind: "other",
    });
  }
  if (data.status === "setup_incomplete") {
    items.push({
      id: "setup-incomplete",
      title: "Finish Missed Call Text Back setup",
      subtitle: "Forwarding or messaging is not ready",
      href: MCTB_ROUTES.setup,
      kind: "other",
    });
  }
  if (data.status === "paused") {
    items.push({
      id: "paused",
      title: "Recovery is paused",
      subtitle: data.pausedUntil
        ? `Until ${new Date(data.pausedUntil).toLocaleString()}`
        : "Resume from Recovery controls",
      href: MCTB_ROUTES.setupRecovery,
      kind: "other",
    });
  }
  for (const row of data.recentMissedCalls.filter((r) => r.replyLabel === "Needs reply").slice(0, 2)) {
    items.push({
      id: `mc-${row.id}`,
      title: `Reply needed — ${row.callerLabel}`,
      subtitle: row.recoveryLabel,
      href: MCTB_ROUTES.missedCallDetail(row.id),
      kind: "missed_call",
    });
  }
  return items.slice(0, 6);
}
