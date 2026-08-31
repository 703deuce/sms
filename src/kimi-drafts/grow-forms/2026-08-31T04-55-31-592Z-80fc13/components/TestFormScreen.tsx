"use client";
import React from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { formDefaults } from "../mock-data";

export default function TestFormScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="tv-forms min-h-[calc(100vh-64px)] bg-slate-950 flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center gap-3 text-slate-300">
        <button onClick={onBack} className="flex items-center gap-1 text-xs border border-slate-700 rounded-md px-3 py-1.5 hover:bg-slate-800"><ArrowLeft size={12} /> Back to Builder</button>
        <span className="text-sm font-medium">Test Form — Double Opt-In Flow</span>
      </div>
      <div className="tv-phone">
        <div className="bg-slate-100 px-4 py-2 flex items-center justify-between text-[10px] text-slate-600">
          <span>10:55</span><span className="w-16 h-4 bg-slate-950 rounded-full" /><span>📶 🔋</span>
        </div>
        <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100">
          <ChevronLeft size={16} className="text-blue-500" />
          <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-xs">👤</div>
          <span className="text-xs font-medium">+1 (888) 379-4654</span>
        </div>
        <div className="p-4 space-y-3 min-h-[380px] bg-white">
          <div className="text-center text-[10px] text-slate-400">Text Message · SMS<br />Today 10:56 AM</div>
          <div className="tv-msg-in">{formDefaults.doubleOptIn}</div>
          <div className="text-[10px] text-slate-400">The sender is not in your contact list. <span className="text-blue-500">Report Junk</span></div>
          <div className="tv-msg-out">Yes</div>
          <div className="tv-msg-in">
            {formDefaults.optIn}
            <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
              Msg & data rates may apply. Msg frequency varies. Text STOP to stop, HELP for help. Terms & Privacy: <span className="text-blue-500">txt.tv/2Y24901G4</span>
            </div>
          </div>
        </div>
        <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-2">
          <span className="text-slate-400">+</span>
          <div className="flex-1 border border-slate-200 rounded-full px-3 py-1.5 text-[11px] text-slate-400">Text Message · SMS</div>
        </div>
      </div>
    </div>
  );
}
