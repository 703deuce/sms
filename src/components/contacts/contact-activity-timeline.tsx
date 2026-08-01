"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Mail, MessageSquare, Phone, Voicemail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type TimelineItem = {
  id: string;
  kind: "sms" | "call" | "voice_ai" | "voicemail";
  direction?: string | null;
  summary: string;
  status?: string | null;
  at: string;
  href?: string | null;
  meta?: Record<string, unknown>;
};

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  sms: "SMS",
  call: "Call",
  voice_ai: "AI voice",
  voicemail: "Voicemail",
};

function kindIcon(kind: TimelineItem["kind"]) {
  if (kind === "sms") return <MessageSquare className="h-4 w-4" />;
  if (kind === "voicemail") return <Voicemail className="h-4 w-4" />;
  if (kind === "voice_ai") return <Phone className="h-4 w-4" />;
  return <Phone className="h-4 w-4" />;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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
    return <p className="mt-4 text-sm text-muted-foreground">Loading activity…</p>;
  }
  if (error) {
    return <p className="mt-4 text-sm text-rose-600">{error}</p>;
  }
  if (!items.length) {
    return (
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title="No activity yet"
        description="Calls, texts, AI voice, and voicemail for this contact will appear here."
        actionLabel="Send a message"
        actionHref="/send/quick"
      />
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => {
        const recordingUrl =
          typeof item.meta?.recordingUrl === "string" ? item.meta.recordingUrl : null;
        const body = (
          <div className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-muted-foreground">{kindIcon(item.kind)}</span>
                {KIND_LABEL[item.kind]}
                {item.direction ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    · {item.direction}
                  </span>
                ) : null}
                {item.status ? (
                  <span className="text-xs font-normal text-muted-foreground">· {item.status}</span>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(item.at)}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground/90">{item.summary}</p>
            {recordingUrl ? (
              <audio className="mt-2 w-full" controls preload="none" src={recordingUrl} />
            ) : null}
          </div>
        );
        if (item.href) {
          return (
            <Link key={item.id} href={item.href} className="block hover:opacity-90">
              {body}
            </Link>
          );
        }
        return <div key={item.id}>{body}</div>;
      })}
    </div>
  );
}
