"use client";

import { useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import StatCards from "./components/StatCards";
import TodaysSchedule from "./components/TodaysSchedule";
import BookingsChart from "./components/BookingsChart";
import RecentConversations from "./components/RecentConversations";
import NeedsAttention from "./components/NeedsAttention";
import QuickActions from "./components/QuickActions";
import type { OverviewPageActions, OverviewPageModel } from "@/features/appointments/kimi/overview/types";
import { RefDecoPageHeader } from "../shared/ref-deco-patterns";
import "./reference.css";

type Props = {
  model: OverviewPageModel;
  actions: OverviewPageActions;
  copied?: boolean;
};

export default function OverviewView({ model, actions, copied }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5">
      <RefDecoPageHeader
        title="Overview"
        description="Here's what's happening with your appointments today."
        action={
          <div className="relative">
            <input
              ref={dateInputRef}
              type="date"
              value={todayKey}
              className="sr-only"
              aria-label="Choose a date to open in calendar"
              onChange={(e) => {
                if (e.target.value) actions.onOpenCalendarDate(e.target.value);
              }}
            />
            <button
              type="button"
              className="appt-pilot-date-btn"
              onClick={() => {
                dateInputRef.current?.showPicker?.();
                dateInputRef.current?.click();
              }}
            >
              <Calendar size={15} className="text-[var(--text-secondary)]" aria-hidden />
              {model.dateLabel}
              <ChevronDown size={14} className="text-[var(--text-secondary)]" aria-hidden />
            </button>
          </div>
        }
      />

      <StatCards stats={model.stats} />

      <div className="mt-4 grid grid-cols-2 gap-4">
        <TodaysSchedule
          schedule={model.schedule}
          total={model.scheduleTotal}
          onViewCalendar={actions.onViewCalendar}
          onOpenAppointment={actions.onOpenAppointment}
        />
        <BookingsChart chart={model.chart} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
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
