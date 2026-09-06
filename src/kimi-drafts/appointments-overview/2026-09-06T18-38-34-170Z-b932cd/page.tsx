"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, Sparkles } from "lucide-react";
import StatCards from "./components/StatCards";
import TodaysSchedule from "./components/TodaysSchedule";
import BookingsChart from "./components/BookingsChart";
import RecentConversations from "./components/RecentConversations";
import NeedsAttention from "./components/NeedsAttention";
import QuickActions from "./components/QuickActions";
import OnboardingChecklist from "./components/OnboardingChecklist";
import DatePickerPanel from "./components/DatePickerPanel";
import { emptyModel, onboardingSteps, overviewModel } from "./mock-data";
import type { OnboardingStep } from "./mock-data";
import "./reference.css";

type ViewMode = "normal" | "first-use";

function OverviewLoading() {
  return (
    <div className="ref-root min-h-screen bg-[#f7f8fb] p-7 font-sans animate-pulse">
      <div className="mb-6 h-8 w-48 rounded bg-gray-200" />
      <div className="ref-grid-stats">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ref-card h-24" />)}
      </div>
      <div className="ref-grid-2">
        <div className="ref-card h-80" />
        <div className="ref-card h-80" />
      </div>
    </div>
  );
}

function OverviewError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ref-root flex min-h-screen items-center justify-center bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-md rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load your overview</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching today&apos;s appointments and conversations.
        </p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function ReferencePage() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<ViewMode>("normal");
  const [showChecklist, setShowChecklist] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 9, 9));

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    const t = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => { load(); }, [load]);

  const model = mode === "first-use" ? emptyModel : overviewModel;

  const dateLabel = useMemo(() => {
    const today = new Date(2026, 9, 9);
    const same =
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate();
    const base = selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return same ? `Today, ${base}` : base;
  }, [selectedDate]);

  const actions = useMemo(() => ({
    onViewCalendar: () => {},
    onCopyBookingLink: async () => {
      try { await navigator.clipboard.writeText("https://app.transovo.com/book/acme-plumbing"); } catch {}
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    },
    onNewAppointment: () => {},
    onSendTestReminder: () => {},
    onConfigureAvailability: () => {},
    onManageTypes: () => {},
    onReviewIssues: () => {},
    onOpenAppointment: (_id: string) => {},
    onOpenConversation: (_id: string) => {},
    onViewAllConversations: () => {},
    onOpenAttentionItem: (_href: string) => {},
  }), []);

  const onChecklistStep = useCallback((step: OnboardingStep) => {
    if (step.id === "s4") actions.onCopyBookingLink();
    // other steps route to their setup surfaces in production wiring
  }, [actions]);

  if (loading) return <OverviewLoading />;
  if (failed) return <OverviewError onRetry={load} />;

  return (
    <div className="ref-root min-h-full bg-[#f7f8fb] px-4 pb-10 pt-6 font-sans sm:px-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-tight text-gray-900">
            Overview <span className="text-[22px]">👋</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-gray-500">Here&apos;s what&apos;s happening with your appointments today.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sandbox-only state preview toggle */}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "normal" ? "first-use" : "normal"))}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2.5 text-[12px] font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            title="Preview first-use empty dashboard"
          >
            <Sparkles size={13} />
            {mode === "normal" ? "Preview first-use" : "Back to live view"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDatePickerOpen((o) => !o)}
              aria-expanded={datePickerOpen}
              aria-haspopup="dialog"
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Calendar size={15} className="text-gray-500" />
              {dateLabel}
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${datePickerOpen ? "rotate-180" : ""}`} />
            </button>
            {datePickerOpen && (
              <DatePickerPanel
                month={pickerMonth}
                selected={selectedDate}
                onPrevMonth={() => setPickerMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                onNextMonth={() => setPickerMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                onSelect={(d) => { setSelectedDate(d); setDatePickerOpen(false); }}
                onToday={() => { const t = new Date(2026, 9, 9); setSelectedDate(t); setPickerMonth(new Date(t.getFullYear(), t.getMonth(), 1)); setDatePickerOpen(false); }}
                onClose={() => setDatePickerOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {showChecklist && (
        <OnboardingChecklist
          steps={onboardingSteps}
          onStepAction={onChecklistStep}
          onDismiss={() => setShowChecklist(false)}
        />
      )}

      <StatCards stats={model.stats} />

      <div className="ref-grid-2">
        <TodaysSchedule
          schedule={model.schedule}
          total={model.scheduleTotal}
          onViewCalendar={actions.onViewCalendar}
          onOpenAppointment={actions.onOpenAppointment}
          onNewAppointment={actions.onNewAppointment}
        />
        <BookingsChart chart={model.chart} />
      </div>

      <div className="ref-grid-3">
        <RecentConversations
          conversations={model.conversations}
          onOpenConversation={actions.onOpenConversation}
          onViewAll={actions.onViewAllConversations}
        />
        <NeedsAttention
          items={model.attention}
          onOpenItem={actions.onOpenAttentionItem}
          onReviewAll={actions.onReviewIssues}
        />
        <QuickActions
          copied={copied}
          onNewAppointment={actions.onNewAppointment}
          onCopyBookingLink={actions.onCopyBookingLink}
          onSendTestReminder={actions.onSendTestReminder}
          onConfigureAvailability={actions.onConfigureAvailability}
          onManageTypes={actions.onManageTypes}
        />
      </div>
    </div>
  );
}
