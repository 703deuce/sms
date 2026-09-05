"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverviewView from "@/components/appointments/kimi-ui/overview/page";
import {
  buildOverviewPageModel,
  type AnalyticsApiData,
  type OverviewApiData,
} from "@/features/appointments/kimi/overview/map-overview";
import type { OverviewPageActions, OverviewPageModel } from "@/features/appointments/kimi/overview/types";

function OverviewLoading() {
  return (
    <div className="ref-root min-h-screen bg-[#f7f8fb] p-6 font-sans animate-pulse">
      <div className="h-8 w-48 rounded bg-gray-200 mb-6" />
      <div className="grid grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ref-card h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 mt-5">
        <div className="ref-card h-80" />
        <div className="ref-card h-80" />
      </div>
    </div>
  );
}

function OverviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ref-root min-h-screen bg-[#f7f8fb] p-6 font-sans flex items-center justify-center">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load your overview</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching today&apos;s appointments and conversations.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

export function OverviewConnected() {
  const router = useRouter();
  const [data, setData] = useState<OverviewApiData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsApiData | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetch("/api/appointments/overview").then((r) => {
        if (!r.ok) throw new Error("overview failed");
        return r.json();
      }),
      fetch("/api/appointments/analytics?range=7").then((r) => (r.ok ? r.json() : { data: null })),
      fetch("/api/appointments/settings").then((r) => (r.ok ? r.json() : { workspace: null })),
    ])
      .then(([overviewJson, analyticsJson, settingsJson]) => {
        setData(overviewJson.data);
        setAnalytics(analyticsJson.data ?? null);
        setWorkspaceSlug(settingsJson.workspace?.slug ?? null);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bookingUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${workspaceSlug}`;
  }, [workspaceSlug]);

  const model: OverviewPageModel | null = useMemo(
    () => (data ? buildOverviewPageModel(data, analytics) : null),
    [analytics, data],
  );

  const actions: OverviewPageActions = useMemo(
    () => ({
      onViewCalendar: () => router.push("/appointments/calendar"),
      onCopyBookingLink: async () => {
        if (!bookingUrl) return;
        await navigator.clipboard.writeText(bookingUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      onNewAppointment: () => router.push("/appointments/new"),
      onSendTestReminder: () => router.push("/appointments/reminders"),
      onConfigureAvailability: () => router.push("/appointments/availability"),
      onManageTypes: () => router.push("/appointments/types"),
      onReviewIssues: () => {
        const first = data?.needsAttention?.[0]?.href;
        router.push(first || "/appointments");
      },
      onOpenAppointment: (id) => router.push(`/appointments/${id}`),
      onOpenConversation: (id) =>
        router.push(`/conversations?conversation=${encodeURIComponent(id)}`),
      onViewAllConversations: () => router.push("/conversations"),
      onOpenAttentionItem: (href) => router.push(href),
      onRetry: load,
    }),
    [bookingUrl, data?.needsAttention, load, router],
  );

  if (loading) return <OverviewLoading />;
  if (failed || !model) return <OverviewError onRetry={load} />;

  return <OverviewView model={model} actions={actions} copied={copied} />;
}
