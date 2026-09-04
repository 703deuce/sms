"use client";
import { CalendarDays, MapPin, Clock, DollarSign } from "lucide-react";
import { AppointmentType } from "../mock-data";

export default function PreviewPanel({ type }: { type: AppointmentType }) {
  return (
    <div className="card p-5">
      <p className="text-[11.5px] font-semibold text-[#8a8fa3] uppercase tracking-wide mb-4">
        Preview on booking page
      </p>
      <div className="border border-[#ecedf2] rounded-xl p-5">
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${type.bg} ${type.color} mb-4`}>
          <CalendarDays size={22} />
        </span>
        <h3 className="text-[16px] font-bold mb-1">{type.name}</h3>
        <p className="text-[12.5px] text-[#8a8fa3] mb-3">
          {type.durationMin} min • {type.free ? "Free" : `$${type.price}`}
        </p>
        <p className="text-[12.5px] text-[#6b6f82] leading-relaxed mb-4">{type.description}</p>
        <div className="space-y-2.5 text-[12.5px] text-[#6b6f82]">
          <div className="flex items-center gap-2.5">
            <MapPin size={14} className="text-[#a0a3b5]" /> {type.location}
          </div>
          <div className="flex items-center gap-2.5">
            <Clock size={14} className="text-[#a0a3b5]" /> You&apos;ll choose a time on the next step
          </div>
          <div className="flex items-center gap-2.5">
            <DollarSign size={14} className="text-[#a0a3b5]" /> {type.free ? "Free" : `$${type.price}`}
          </div>
        </div>
      </div>
    </div>
  );
}
