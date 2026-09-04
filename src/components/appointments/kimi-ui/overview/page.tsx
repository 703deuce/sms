"use client";

import { Calendar, ChevronDown } from 'lucide-react';
import StatCards from './components/StatCards';
import TodaysSchedule from './components/TodaysSchedule';
import BookingsChart from './components/BookingsChart';
import RecentConversations from './components/RecentConversations';
import NeedsAttention from './components/NeedsAttention';
import QuickActions from './components/QuickActions';
import type { OverviewPageActions, OverviewPageModel } from '@/features/appointments/kimi/overview/types';
import './reference.css';

type Props = {
  model: OverviewPageModel;
  actions: OverviewPageActions;
  copied?: boolean;
};

export default function OverviewView({ model, actions, copied }: Props) {
  return (
    <div className="ref-root min-h-full bg-[#f7f8fb] px-7 pb-10 pt-6 font-sans">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-tight text-gray-900">
            Overview <span className="text-[22px]">👋</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-gray-500">Here&apos;s what&apos;s happening with your appointments today.</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <Calendar size={15} className="text-gray-500" />
          {model.dateLabel}
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>

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
