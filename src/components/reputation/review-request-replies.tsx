"use client";

import { useState } from "react";
import Link from "next/link";
import { dashboardCard } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export type ReviewReplyRow = {
  id: string;
  send_id?: string | null;
  channel: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  reply_body: string;
  from?: string | null;
  subject?: string | null;
  created_at: string;
};

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ReviewRequestRepliesPanel({
  replies,
  compact = false,
  showTabs = false,
  showViewAll = false,
  businessId,
}: {
  replies: ReviewReplyRow[];
  compact?: boolean;
  showTabs?: boolean;
  showViewAll?: boolean;
  businessId?: string;
}) {
  const [filter, setFilter] = useState<"all" | "email" | "sms">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered =
    filter === "all"
      ? replies
      : replies.filter((r) => String(r.channel).toLowerCase() === filter);

  if (replies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 px-3.5 py-6 text-center text-[13px] text-zinc-500">
        No customer replies yet. Replies to review request emails will appear here.
      </div>
    );
  }

  return (
    <div>
      {showTabs && (
        <div className="mb-2.5 flex flex-wrap gap-1 border-b border-zinc-100">
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "email" as const, label: "Email" },
              { id: "sms" as const, label: "SMS" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium",
                filter === tab.id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <ul className={compact ? "divide-y divide-zinc-100" : "space-y-3"}>
        {filtered.map((reply, i) => {
          const who =
            reply.customer_name ??
            reply.from ??
            reply.customer_email ??
            reply.customer_phone ??
            "Customer";
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

          return (
            <li key={reply.id} className={compact ? "py-2" : cn(dashboardCard, "p-3.5")}>
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    avatarColor
                  )}
                >
                  {initials(who)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">{who}</p>
                    <span className="shrink-0 text-[10px] text-zinc-400">{timeAgo(reply.created_at)}</span>
                  </div>
                  {reply.reply_body && (
                    <p
                      className={cn(
                        "mt-0.5 text-xs leading-relaxed text-zinc-500",
                        expandedId === reply.id ? "whitespace-pre-wrap" : "line-clamp-2"
                      )}
                    >
                      {reply.reply_body}
                    </p>
                  )}
                  {expandedId === reply.id && reply.subject ? (
                    <p className="mt-1 text-[11px] text-zinc-400">Subject: {reply.subject}</p>
                  ) : null}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        reply.channel === "email"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-sky-100 text-sky-700"
                      )}
                    >
                      {reply.channel}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] font-medium text-emerald-700 hover:underline"
                      onClick={() =>
                        setExpandedId((id) => (id === reply.id ? null : reply.id))
                      }
                    >
                      {expandedId === reply.id ? "Hide" : "View"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {showViewAll && businessId && (
        <Link
          href={`/businesses/${businessId}/review-requests?tab=tracking`}
          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
        >
          View all replies →
        </Link>
      )}
    </div>
  );
}
