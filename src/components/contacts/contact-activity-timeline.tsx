"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, Mail, MessageSquare, Phone, Voicemail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TimelineCrmSync = {
  provider: string;
  externalUrl: string | null;
  syncStatus: string;
};

type TimelineItem = {
  id: string;
  kind: "sms" | "call" | "voice_ai" | "voicemail";
  direction?: string | null;
  summary: string;
  status?: string | null;
  at: string;
  href?: string | null;
  crmSync?: TimelineCrmSync[];
  meta?: Record<string, unknown>;
};

const PROVIDER_LABEL: Record<string, string> = {
  salesforce: "Salesforce",
  zoho: "Zoho",
  pipedrive: "Pipedrive",
  calendly: "Calendly",
};

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  sms: "SMS",
  call: "Call",
  voice_ai: "AI voice",
  voicemail: "Voicemail",
};

const KIND_TONE: Record<TimelineItem["kind"], string> = {
  sms: "bg-primary/10 text-primary",
  call: "bg-emerald-50 text-emerald-600",
  voice_ai: "bg-violet-50 text-violet-600",
  voicemail: "bg-amber-50 text-amber-600",
};

function kindIcon(kind: TimelineItem["kind"]) {
  if (kind === "sms") return <MessageSquare className="h-3.5 w-3.5" />;
  if (kind === "voicemail") return <Voicemail className="h-3.5 w-3.5" />;
  return <Phone className="h-3.5 w-3.5" />;
}

function directionIcon(direction: string | null | undefined) {
  const dir = (direction || "").toLowerCase();
  if (dir === "in" || dir === "inbound") {
    return <ArrowDownLeft className="h-3 w-3 text-emerald-600" />;
  }
  if (dir === "out" || dir === "outbound") {
    return <ArrowUpRight className="h-3 w-3 text-primary" />;
  }
  return null;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ContactActivityTimeline({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contacts/${contactId}/activity`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setItems(j.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-border px-3.5 py-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-2.5 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
        {error}
      </p>
    );
  }
  if (!items.length) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title="No activity yet"
          description="Calls, texts, AI voice, and voicemail for this contact will appear here."
          actionLabel="Send a message"
          actionHref="/send/quick"
        />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => {
        const recordingUrl =
          typeof item.meta?.recordingUrl === "string" ? item.meta.recordingUrl : null;
        const body = (
          <div className="group rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-muted/20">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  KIND_TONE[item.kind],
                )}
              >
                {kindIcon(item.kind)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
                    <span className="truncate">{KIND_LABEL[item.kind]}</span>
                    {directionIcon(item.direction)}
                    {item.status ? (
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        · {item.status}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(item.at)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/80">
                  {item.summary}
                </p>
                {item.crmSync?.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {item.crmSync.map((s) => {
                      const label = PROVIDER_LABEL[s.provider] || s.provider;
                      const chip = (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                            s.syncStatus === "error"
                              ? "bg-red-50 text-red-700 ring-red-600/15"
                              : s.syncStatus === "pending"
                                ? "bg-amber-50 text-amber-800 ring-amber-600/20"
                                : "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
                          )}
                        >
                          {s.syncStatus === "error"
                            ? `Sync failed · ${label}`
                            : s.syncStatus === "pending"
                              ? `Syncing · ${label}`
                              : `Synced to ${label}`}
                        </span>
                      );
                      return s.externalUrl ? (
                        <a
                          key={s.provider}
                          href={s.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="transition-opacity hover:opacity-80"
                        >
                          {chip}
                        </a>
                      ) : (
                        <span key={s.provider}>{chip}</span>
                      );
                    })}
                  </div>
                ) : null}
                {recordingUrl ? (
                  <audio className="mt-2 h-8 w-full" controls preload="none" src={recordingUrl} />
                ) : null}
              </div>
            </div>
          </div>
        );
        if (item.href) {
          return (
            <Link key={item.id} href={item.href} className="block">
              {body}
            </Link>
          );
        }
        return <div key={item.id}>{body}</div>;
      })}
    </div>
  );
}
