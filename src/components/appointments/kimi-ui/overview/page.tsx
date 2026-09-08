"use client";

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
import "./appointments-overview-pilot.css";

type Props = {
  model: OverviewPageModel;
  actions: OverviewPageActions;
  copied?: boolean;
};

export default function OverviewView({ model, actions, copied }: Props) {
  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5">
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
