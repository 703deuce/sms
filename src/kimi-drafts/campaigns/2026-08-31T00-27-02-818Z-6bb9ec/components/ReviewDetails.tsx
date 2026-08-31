"use client";
import { ChevronLeft, Pencil, Users } from "lucide-react";
import { credits } from "../mock-data";
import PhonePreview from "./PhonePreview";

interface Props {
  data: { name: string; message: string; audience: string[] };
  onBack: () => void;
  onSend: () => void;
  onDraft: () => void;
}

export default function ReviewDetails({ data, onBack, onSend, onDraft }: Props) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 grid grid-cols-[1fr_340px] gap-8 p-8">
        <div className="max-w-[560px]">
          <p className="text-[12px] text-[#6b7288] mb-1">Campaigns / Create Campaign</p>
          <h1 className="text-[22px] font-bold text-[#1a1f36] mb-1">Review Details</h1>
          <p className="text-[13px] text-[#6b7288] mb-6">Confirm your campaign details.</p>

          <div className="flex items-center justify-between mb-2">
            <p className="text-[12.5px] font-semibold text-[#1a1f36]">Audience <span className="font-normal text-[#9aa1b5]">(Subscribed Contacts Only)</span></p>
            <button onClick={onBack} className="text-[12px] text-[#6b7288] hover:text-[#1a1f36] flex items-center gap-1"><Pencil size={11} /> Edit</button>
          </div>
          <div className="tv-card px-4 py-3.5 flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#eef0fd] flex items-center justify-center"><Users size={14} className="text-[#3f4bd8]" /></span>
              <div className="text-[13px] text-[#1a1f36]">
                <p><span className="font-semibold">List:</span> {data.audience.find((a) => a !== "Joined in Last 30 Days") ?? "Nashville Store"}</p>
                <p><span className="font-semibold">Segment:</span> Joined in Last 30 Days</p>
              </div>
            </div>
            <span className="text-[16px] font-bold text-[#1a1f36]">5,359</span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-[12.5px] font-semibold text-[#1a1f36]">Timing</p>
            <button onClick={onBack} className="text-[12px] text-[#6b7288] hover:text-[#1a1f36] flex items-center gap-1"><Pencil size={11} /> Edit</button>
          </div>
          <div className="tv-card px-4 py-3.5 text-[13px] text-[#1a1f36] mb-6">Send Immediately</div>

          <p className="text-[12.5px] font-semibold text-[#1a1f36] mb-2">Message Credit Summary</p>
          <div className="tv-card px-4 py-1 text-[13px]">
            {[
              ["Credits Available", credits.available],
              ["Credits Required", credits.required],
              ["Credits Remaining", credits.remaining],
            ].map(([l, v], i) => (
              <div key={l} className={`flex justify-between py-3 ${i < 2 ? "border-b border-[#f1f2f6]" : ""}`}>
                <span className="text-[#4a5068]">{l}</span>
                <span className="font-semibold text-[#1a1f36]">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <PhonePreview message={data.message} label="Campaign Preview" />
      </div>

      <div className="sticky bottom-0 bg-white border-t border-[#e6e9f0] px-8 py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#4a5068] hover:text-[#1a1f36]"><ChevronLeft size={15} /> Prev</button>
        <div className="flex gap-3">
          <button onClick={onDraft} className="text-[13px] font-semibold text-[#4a5068] hover:text-[#1a1f36] px-3 py-2">Save Draft</button>
          <button onClick={onSend} className="tv-btn-primary px-5 py-2 text-[13px] flex items-center gap-1.5">Send Now <span>→</span></button>
        </div>
      </div>
    </div>
  );
}
