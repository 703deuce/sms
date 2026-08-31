"use client";
import { useState } from "react";
import { X, RefreshCw } from "lucide-react";

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecurringModal({ onSet, onClose }: { onSet: (s: string) => void; onClose: () => void }) {
  const [unit, setUnit] = useState("Weeks");
  const [every, setEvery] = useState("1");
  const [weekday, setWeekday] = useState("Fri");
  const [ending, setEnding] = useState<"Never" | "On" | "After">("After");
  const [sends, setSends] = useState("10");

  const summary = `Sends every week on ${weekday} at 4:29 pm starting on Friday, April 18th, 2025 and ending after ${sends} sends.`;

  return (
    <div className="tv-overlay" onClick={onClose}>
      <div className="tv-modal w-[400px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#1a1f36]"><RefreshCw size={14} className="text-[#3f4bd8]" /> Recurring Send</h3>
          <button onClick={onClose} className="text-[#9aa1b5] hover:text-[#1a1f36]"><X size={16} /></button>
        </div>
        <label className="text-[12px] font-semibold text-[#1a1f36]">Starting On</label>
        <input type="date" defaultValue="2025-04-18" className="tv-input w-full mt-1 mb-4 px-3 py-2 text-[13px]" />
        <label className="text-[12px] font-semibold text-[#1a1f36]">Repeat Every</label>
        <div className="flex gap-2 mt-1 mb-4">
          <select value={every} onChange={(e) => setEvery(e.target.value)} className="tv-input px-3 py-2 text-[13px] w-[80px]">
            {["1", "2", "3", "4"].map((n) => <option key={n}>{n}</option>)}
          </select>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="tv-input px-3 py-2 text-[13px] flex-1">
            {["Days", "Weeks", "Months"].map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        {unit === "Weeks" && (
          <>
            <label className="text-[12px] font-semibold text-[#1a1f36]">On the following weekdays</label>
            <div className="flex gap-1.5 mt-1.5 mb-4">
              {days.map((d) => (
                <button key={d} onClick={() => setWeekday(d)} className={`tv-day-chip ${weekday === d ? "active" : ""}`}>{d.slice(0, 3)}</button>
              ))}
            </div>
          </>
        )}
        <label className="text-[12px] font-semibold text-[#1a1f36]">Sending At</label>
        <div className="flex gap-2 mt-1 mb-4">
          <select className="tv-input px-3 py-2 text-[13px] w-[70px]">{Array.from({ length: 12 }, (_, i) => <option key={i}>{i + 1}</option>).reverse() && <option>4</option>}{[1,2,3,5,6,7,8,9,10,11,12].map((n)=><option key={n}>{n}</option>)}</select>
          <select className="tv-input px-3 py-2 text-[13px] w-[70px]"><option>29</option><option>00</option><option>15</option><option>30</option><option>45</option></select>
          <select className="tv-input px-3 py-2 text-[13px] w-[80px]"><option>PM</option><option>AM</option></select>
        </div>
        <label className="text-[12px] font-semibold text-[#1a1f36]">Ending</label>
        <div className="tv-seg mt-1.5 mb-3">
          {(["Never", "On", "After"] as const).map((e) => (
            <button key={e} className={ending === e ? "active" : ""} onClick={() => setEnding(e)}>{e}</button>
          ))}
        </div>
        {ending === "After" && (
          <>
            <label className="text-[12px] font-semibold text-[#1a1f36]">Number of Sends</label>
            <input value={sends} onChange={(e) => setSends(e.target.value)} className="tv-input w-full mt-1 px-3 py-2 text-[13px]" />
          </>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => onSet(summary)} className="tv-btn-primary flex-1 py-2.5 text-[13px]">Set</button>
          <button onClick={onClose} className="flex-1 py-2.5 text-[13px] font-semibold border border-[#dfe3ec] rounded-lg text-[#4a5068] hover:bg-[#f5f6fa]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
