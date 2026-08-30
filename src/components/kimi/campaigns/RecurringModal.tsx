"use client";
import { useState } from "react";
import { Repeat, X } from "lucide-react";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RecurringModal({ onClose, onSet }: { onClose: () => void; onSet: (summary: string) => void }) {
  const [unit, setUnit] = useState("Days");
  const [day, setDay] = useState("Fri");
  const [ending, setEnding] = useState("Never");
  const [sends, setSends] = useState("10");

  return (
    <div className="fixed inset-0 z-50 st-modal-backdrop flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[380px] p-6 st-fade" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 font-semibold text-[15px]"><Repeat size={16} className="text-indigo-600" /> Recurring Send</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Starting On</label>
        <input defaultValue="04/18/2025" className="w-full border border-border rounded-lg px-3 py-2 text-[13px] mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Repeat Every</label>
        <div className="flex gap-2 mb-4">
          <select className="border border-border rounded-lg px-2 py-2 text-[13px] w-20"><option>1</option><option>2</option></select>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border border-border rounded-lg px-2 py-2 text-[13px] flex-1">
            <option>Days</option><option>Weeks</option><option>Months</option>
          </select>
        </div>
        {unit === "Weeks" && (
          <div className="mb-4 st-fade">
            <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">On the following weekdays</label>
            <div className="flex gap-1">
              {weekdays.map((d) => (
                <div key={d} onClick={() => setDay(d)} className={`st-day ${day === d ? "on" : "hover:bg-gray-100 text-gray-600"}`}>{d}</div>
              ))}
            </div>
          </div>
        )}
        <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Sending At</label>
        <div className="flex gap-2 mb-4">
          <select className="border border-border rounded-lg px-2 py-2 text-[13px]"><option>4</option></select>
          <select className="border border-border rounded-lg px-2 py-2 text-[13px]"><option>29</option></select>
          <select className="border border-border rounded-lg px-2 py-2 text-[13px]"><option>PM</option><option>AM</option></select>
        </div>
        <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Ending</label>
        <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
          {["Never", "On", "After"].map((e) => (
            <button key={e} onClick={() => setEnding(e)} className={`flex-1 text-[13px] py-1.5 rounded-md ${ending === e ? "bg-white shadow-sm font-medium" : "text-gray-500"}`}>{e}</button>
          ))}
        </div>
        {ending === "After" && (
          <div className="mb-3 st-fade">
            <label className="block text-[12.5px] font-medium text-gray-600 mb-1.5">Number of Sends</label>
            <input value={sends} onChange={(e) => setSends(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => onSet(`Sends every week on ${day} at 4:29 pm starting on Friday, April 18th, 2025 and ending after ${sends} sends.`)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-lg py-2"
          >Set</button>
          <button onClick={onClose} className="flex-1 border border-border text-[13px] rounded-lg py-2 text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
