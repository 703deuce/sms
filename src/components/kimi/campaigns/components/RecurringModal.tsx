"use client";
import { useState } from "react";
import { X, Calendar } from "lucide-react";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecurringModal({ onClose, onSet }: { onClose: () => void; onSet: (summary: string) => void }) {
  const [startDate, setStartDate] = useState("04/17/2025");
  const [every, setEvery] = useState("1");
  const [unit, setUnit] = useState<"Days" | "Weeks" | "Months">("Days");
  const [days, setDays] = useState<string[]>(["Fri"]);
  const [ending, setEnding] = useState<"Never" | "On" | "After">("Never");
  const [numSends, setNumSends] = useState("10");
  const [calOpen, setCalOpen] = useState(false);

  const toggleDay = (d: string) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  const summary = `Sends every week on ${days.join(", ") || "Fri"} at 4:29 pm starting on Friday, April 18th, 2025 and ending after ${numSends} sends.`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card w-[380px] p-6 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
            <span className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center"><Calendar className="w-3.5 h-3.5 text-indigo-600" /></span>
            Recurring Send
          </h2>
          <button onClick={onClose} className="text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-[12px] font-semibold text-slate-600 mt-4 mb-1">Starting On</label>
        <div className="relative">
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} onFocus={() => setCalOpen(true)} className="input-field !text-[13px]" />
          <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          {calOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3 fade-in" onMouseLeave={() => setCalOpen(false)}>
              <p className="text-center text-[13px] font-semibold text-slate-700 mb-2">April 2025</p>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400 mb-1">
                {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[12px]">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => { setStartDate(`04/${String(d).padStart(2, "0")}/2025`); setCalOpen(false); }}
                    className={`py-1 rounded-md ${d === 17 ? "bg-indigo-600 text-white font-semibold" : "text-slate-700 hover:bg-indigo-50"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="block text-[12px] font-semibold text-slate-600 mt-4 mb-1">Repeat Every</label>
        <div className="flex gap-2">
          <select value={every} onChange={(e) => setEvery(e.target.value)} className="input-field !text-[13px] !w-20">
            {["1","2","3","4"].map((n) => <option key={n}>{n}</option>)}
          </select>
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className="input-field !text-[13px] flex-1">
            <option>Days</option><option>Weeks</option><option>Months</option>
          </select>
        </div>

        {unit === "Weeks" && (
          <>
            <label className="block text-[12px] font-semibold text-slate-600 mt-4 mb-1">On the following weekdays</label>
            <div className="flex gap-1">
              {weekdays.map((d) => (
                <button key={d} onClick={() => toggleDay(d)} className={`weekday-btn ${days.includes(d) ? "on" : ""}`}>{d}</button>
              ))}
            </div>
          </>
        )}

        <label className="block text-[12px] font-semibold text-slate-600 mt-4 mb-1">Sending At</label>
        <div className="flex gap-2">
          <select className="input-field !text-[13px] !w-16"><option>4</option></select>
          <select className="input-field !text-[13px] !w-16"><option>29</option></select>
          <select className="input-field !text-[13px] !w-20"><option>PM</option><option>AM</option></select>
        </div>

        <label className="block text-[12px] font-semibold text-slate-600 mt-4 mb-1">Ending</label>
        <div className="seg-toggle w-full">
          {(["Never", "On", "After"] as const).map((e) => (
            <button key={e} onClick={() => setEnding(e)} className={`flex-1 ${ending === e ? "on" : ""}`}>{e}</button>
          ))}
        </div>
        {ending === "After" && (
          <div className="mt-3">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Number of Sends</label>
            <input value={numSends} onChange={(e) => setNumSends(e.target.value)} className="input-field !text-[13px]" />
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={() => onSet(summary)} className="btn-primary flex-1">Set</button>
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}
