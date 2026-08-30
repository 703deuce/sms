"use client";
import { useState } from "react";
import { Users, ChevronDown, Loader2 } from "lucide-react";
import PhonePreview from "./PhonePreview";
import type { KimiReviewSummary } from "./types";

export default function ReviewDetails({
  message,
  reviewSummary,
  onPrev,
  onDone,
  error,
}: {
  message: string;
  reviewSummary: KimiReviewSummary;
  onPrev: () => void;
  onDone: (action: "draft" | "send") => void | Promise<void>;
  error?: string | null;
}) {
  const [sending, setSending] = useState(false);

  async function handleDone(action: "draft" | "send") {
    setSending(true);
    try {
      await onDone(action);
    } finally {
      setSending(false);
    }
  }
  const rows = [
    ["Credits Available", reviewSummary.creditsAvailable],
    ["Credits Required", reviewSummary.creditsRequired],
    ["Credits Remaining", reviewSummary.creditsRemaining],
  ];
  return (
    <div className="st-fade">
      <div className="text-[12px] text-gray-400 mb-2">Campaigns / <span className="text-gray-600">Create Campaign</span></div>
      <div className="grid grid-cols-[1fr_360px] gap-10">
        <div>
          <h1 className="text-[22px] font-semibold mb-1">Review Details</h1>
          <p className="text-[13.5px] text-gray-500 mb-8">Confirm your campaign details.</p>

          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-gray-800">Audience <span className="text-gray-400 font-normal">(Subscribed Contacts Only)</span></div>
            <button onClick={onPrev} className="text-[12.5px] text-indigo-600 hover:underline">Edit</button>
          </div>
          <div className="flex items-center justify-between border border-border rounded-xl px-4 py-3 bg-card mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center"><Users size={15} className="text-indigo-600" /></div>
              <div>
                {reviewSummary.audience.map((a) => <div key={a} className="text-[13px] text-gray-700">{a}</div>)}
              </div>
            </div>
            <div className="text-[16px] font-semibold">{reviewSummary.count}</div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-gray-800">Timing</div>
            <button onClick={onPrev} className="text-[12.5px] text-indigo-600 hover:underline">Edit</button>
          </div>
          <div className="border border-border rounded-xl px-4 py-3 bg-card mb-8 text-[13px] text-gray-700">{reviewSummary.timing}</div>

          <div className="text-[13px] font-semibold text-gray-800 mb-2">Message Credit Summary</div>
          <div className="border border-border rounded-xl bg-card overflow-hidden mb-10">
            {rows.map(([l, v], i) => (
              <div key={l} className={`flex items-center justify-between px-4 py-3 text-[13px] ${i < 2 ? "border-b border-border" : ""}`}>
                <span className="text-gray-500">{l}</span><span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={onPrev} className="border border-border rounded-lg px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 bg-card">← Prev</button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleDone("draft")}
                disabled={sending}
                className="text-[13px] text-gray-500 px-4 py-2 hover:text-gray-700 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void handleDone("send")}
                disabled={sending || reviewSummary.canSend === false}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : null}
                {sending ? "Sending…" : "Send Now"} <ChevronDown size={13} />
              </button>
            </div>
          </div>
          {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
          {reviewSummary.blockReason && reviewSummary.canSend === false ? (
            <p className="mt-3 text-[13px] text-amber-700">{reviewSummary.blockReason}</p>
          ) : null}
        </div>
        <div className="pt-2">
          <PhonePreview message={message} title="Campaign Preview" />
        </div>
      </div>
      {sending && <div className="fixed inset-0 z-40 st-modal-backdrop flex items-center justify-center"><Loader2 size={32} className="animate-spin text-white" /></div>}
    </div>
  );
}
