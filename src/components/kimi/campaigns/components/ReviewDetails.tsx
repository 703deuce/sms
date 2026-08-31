"use client";
import { Users, ChevronLeft, ChevronDown } from "lucide-react";
import PhonePreview from "./PhonePreview";
import { reviewSummary } from "../mock-data";

export default function ReviewDetails({
  message,
  timing,
  onPrev,
  onSend,
  onSaveDraft,
}: {
  message: string;
  timing: string;
  onPrev: () => void;
  onSend: () => void;
  onSaveDraft: () => void;
}) {
  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
      <p className="text-[12px] text-slate-400">Campaigns / <span className="text-slate-600">Create Campaign</span></p>
      <div className="grid grid-cols-[1fr_360px] gap-14 mt-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Review Details</h1>
          <p className="text-sm text-slate-500 mt-1">Confirm your campaign details.</p>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Audience <span className="ml-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">(Subscribed Contacts Only)</span></h3>
              <button onClick={onPrev} className="text-[13px] font-semibold text-indigo-600">Edit</button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center"><Users className="w-5 h-5 text-indigo-600" /></div>
                <div>
                  {reviewSummary.audience.map((a) => <p key={a} className="text-[13px] font-medium text-slate-700">{a}</p>)}
                </div>
              </div>
              <span className="text-[20px] font-bold text-slate-900">{reviewSummary.count}</span>
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Timing</h3>
              <button onClick={onPrev} className="text-[13px] font-semibold text-indigo-600">Edit</button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-[13px] font-medium text-slate-700">{timing}</div>
          </div>

          <div className="mt-7">
            <h3 className="text-[15px] font-bold text-slate-900">Message Credit Summary</h3>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {[["Credits Available", reviewSummary.creditsAvailable], ["Credits Required", reviewSummary.creditsRequired], ["Credits Remaining", reviewSummary.creditsRemaining]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[13px] text-slate-600">{k}</span>
                  <span className="text-[14px] font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-10">
            <button onClick={onPrev} className="btn-ghost flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Prev</button>
            <div className="flex items-center gap-4">
              <button onClick={onSaveDraft} className="text-[13px] font-semibold text-indigo-600">Save Draft</button>
              <button onClick={onSend} className="btn-primary flex items-center gap-1.5 !py-2.5">
                Send Now <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <PhonePreview message={message} label="Campaign Preview" />
      </div>
    </div>
  );
}
