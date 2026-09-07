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

type Props = {
  model: OverviewPageModel;
  actions: OverviewPageActions;
  copied?: boolean;
};

export default function OverviewView({ model, actions, copied }: Props) {
  return (
    <div className="ref-root min-h-full px-7 pb-10 pt-6 font-sans">
      <RefDecoPageHeader
        title="Overview"
        description="Here's what's happening with your appointments today."
        action={
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Calendar size={15} className="text-gray-500" aria-hidden />
            {model.dateLabel}
            <ChevronDown size={14} className="text-gray-400" aria-hidden />
          </button>
        }
      />

      <StatCards stats={model.stats} />

      <div className="mt-5 grid grid-cols-2 gap-5">
        <TodaysSchedule
          schedule={model.schedule}
          total={model.scheduleTotal}
          onViewCalendar={actions.onViewCalendar}
          onOpenAppointment={actions.onOpenAppointment}
        />
        <BookingsChart chart={model.chart} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-5">
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
