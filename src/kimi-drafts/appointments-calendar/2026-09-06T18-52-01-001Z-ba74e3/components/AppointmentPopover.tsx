"use client";
import React, { useEffect } from "react";
import { X, Video, Phone, Clock, MessageSquare, CalendarClock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { TYPE_COLORS, type CalEvent } from "../mock-data";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  canceled: "bg-rose-50 text-rose-700",
};

type Props = {
  event: CalEvent;
  onClose: () => void;
  onOpenDetail: () => void;
};

export default function AppointmentPopover({ event, onClose, onOpenDetail }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = TYPE_COLORS[event.type];
  return (
    <>
      <div className="cal-overlay" onClick={onClose} />
      <div className="cal-popover" role="dialog" aria-label={`${event.title} details`}>
        <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
            <div>
              <div className="text-[14px] font-semibold text-gray-900">{event.title}</div>
              <div className="text-[12px] text-gray-500">{event.name}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 px-4 py-3 text-[12px] text-gray-600">
          <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-gray-400" /> {event.timeLabel} · {event.duration >= 1 ? `${event.duration * 60} min` : "30 min"}</div>
          {event.hasVideo && <div className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-gray-400" /> Video meeting linked</div>}
          {event.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gray-400" /> {event.phone}</div>}
          <div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[event.status]}`}>{event.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 px-4 py-3">
          <button onClick={onOpenDetail} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-indigo-600 text-[12px] font-semibold text-white hover:bg-indigo-500">
            Open detail <ArrowUpRight className="h-3 w-3" />
          </button>
          <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            <MessageSquare className="h-3 w-3" /> Message
          </button>
          <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            <CalendarClock className="h-3 w-3" /> Reschedule
          </button>
          <button className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-200 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            <CheckCircle2 className="h-3 w-3" /> Confirm
          </button>
        </div>
      </div>
    </>
  );
}
