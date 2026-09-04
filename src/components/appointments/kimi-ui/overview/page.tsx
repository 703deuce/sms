'use client';

import { Calendar, ChevronDown } from 'lucide-react';
import StatCards from './components/StatCards';
import TodaysSchedule from './components/TodaysSchedule';
import BookingsChart from './components/BookingsChart';
import RecentConversations from './components/RecentConversations';
import NeedsAttention from './components/NeedsAttention';
import QuickActions from './components/QuickActions';
import './reference.css';

export default function AppointmentsOverviewPage() {
  return (
    <div className="ref-root min-h-screen bg-[#f7f8fb] p-6 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[26px] font-bold text-gray-900 flex items-center gap-2">
            Overview <span className="text-[22px]">👋</span>
          </h1>
          <p className="text-[13.5px] text-gray-500 mt-0.5">Here's what's happening with your appointments today.</p>
        </div>
        <button className="flex items-center gap-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm hover:bg-gray-50">
          <Calendar size={15} className="text-gray-500" />
          Fri, Aug 30, 2026
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Stat cards */}
      <StatCards />

      {/* Schedule + chart */}
      <div className="grid grid-cols-2 gap-5 mt-5">
        <TodaysSchedule />
        <BookingsChart />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-5 mt-5">
        <RecentConversations />
        <NeedsAttention />
        <QuickActions />
      </div>
    </div>
  );
}
