"use client";

import { useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { mountOverviewPilotRuntimeStyles } from "./appointments-overview-pilot-chrome";
import StatCards from "./components/StatCards";
import TodaysSchedule from "./components/TodaysSchedule";
import BookingsChart from "./components/BookingsChart";
import RecentConversations from "./components/RecentConversations";
import NeedsAttention from "./components/NeedsAttention";
import QuickActions from "./components/QuickActions";
import type { OverviewPageActions, OverviewPageModel } from "@/features/appointments/kimi/overview/types";
import { RefDecoPageHeader } from "../shared/ref-deco-patterns";
import "./reference.css";
import "./appointments-overview-neutral-r2.css";
import "./appointments-overview-soft-cool-slate.css";

type Props = {
  model: OverviewPageModel;
  actions: OverviewPageActions;
  copied?: boolean;
};

export default function OverviewView({ model, actions, copied }: Props) {
  useEffect(() => {
    mountOverviewPilotRuntimeStyles();
  }, []);

  return (
    <div
      data-overview-revision="soft-cool-slate-204"
      className="appt-overview-pilot ref-root min-h-full px-4 pb-10 pt-2 lg:px-7"
    >
      <RefDecoPageHeader
        title="Overview"
        description="Here's what's happening with your appointments today."
        action={
          <button type="button" className="appt-pilot-date-btn">
            <Calendar size={15} className="text-[var(--text-secondary)]" aria-hidden />
            {model.dateLabel}
            <ChevronDown size={14} className="text-[var(--text-secondary)]" aria-hidden />
          </button>
        }
      />

      <StatCards stats={model.stats} />

      <div className="appt-overview-row-primary mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodaysSchedule
          schedule={model.schedule}
          total={model.scheduleTotal}
          onViewCalendar={actions.onViewCalendar}
          onOpenAppointment={actions.onOpenAppointment}
        />
        <BookingsChart chart={model.chart} />
      </div>

      <div className="appt-overview-row-lower mt-6 grid grid-cols-1 gap-5 lg:mt-4 lg:grid-cols-3 lg:gap-4">
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
