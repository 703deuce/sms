"use client";
import React from "react";
import { ArrowLeft, ChevronLeft, Plus } from "lucide-react";
import { formDefaults } from "../mock-data";

export default function TestFormScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="tv-forms flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-7 bg-slate-950 p-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50"
        >
          <ArrowLeft size={12} /> Back to Builder
        </button>
        <span className="text-sm font-medium text-slate-200">
          Test Form <span className="mx-1 text-slate-600">·</span> Double Opt-In Flow
        </span>
      </div>

      <div className="tv-phone" style={{ boxShadow: "0 24px 64px -16px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.06)" }}>
        {/* Status bar */}
        <div className="flex items-center justify-between bg-white px-5 pb-1 pt-2 text-[10px] font-semibold text-slate-900">
          <span>10:55</span>
          <span className="h-4 w-16 rounded-full bg-slate-950" />
          <span className="text-[9px]">📶 🔋</span>
        </div>
        {/* Conversation header */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
          <ChevronLeft size={18} className="text-blue-500" />
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs ring-1 ring-slate-300/60">👤</div>
            <span className="text-[10px] font-medium text-slate-700">+1 (888) 379-4654</span>
          </div>
          <span className="w-[18px]" />
        </div>
        {/* Messages */}
        <div className="min-h-[380px] space-y-3 bg-white p-4">
          <div className="text-center text-[10px] leading-relaxed text-slate-400">
            Text Message · SMS<br />Today 10:56 AM
          </div>
          <div className="tv-msg-in">{formDefaults.doubleOptIn}</div>
          <div className="text-[10px] text-slate-400">
            The sender is not in your contact list. <span className="text-blue-500">Report Junk</span>
          </div>
          <div className="tv-msg-out">Yes</div>
          <div className="tv-msg-in">
            {formDefaults.optIn}
            <div className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-relaxed text-slate-500">
              Msg &amp; data rates may apply. Msg frequency varies. Text STOP to stop, HELP for help. Terms &amp; Privacy:{" "}
              <span className="text-blue-500">txt.tv/2Y24901G4</span>
            </div>
          </div>
        </div>
        {/* Composer */}
        <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <Plus size={13} />
          </span>
          <div className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-400">
            Text Message · SMS
          </div>
        </div>
      </div>
    </div>
  );
}
