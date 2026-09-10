"use client";

import {
  CalendarCheck2, ShieldCheck, MessageSquare, Calendar, CreditCard,
  StickyNote, RefreshCw, XCircle, CheckCircle2, Link2,
} from "lucide-react";
import { Card, fmtDateTime } from "./ui";
import type { TimelineEvent } from "../types";

const icons: Record<string, React.ReactNode> = {
  created: <CalendarCheck2 size={11} />,
  consent: <ShieldCheck size={11} />,
  message: <MessageSquare size={11} />,
  confirmation_sent: <MessageSquare size={11} />,
  calendar: <Calendar size={11} />,
  payment: <CreditCard size={11} />,
  note: <StickyNote size={11} />,
  rescheduled: <RefreshCw size={11} />,
  canceled: <XCircle size={11} />,
  confirmed: <CheckCircle2 size={11} />,
  manage_link: <Link2 size={11} />,
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card title="Activity" sub="Everything that happened with this appointment">
      {events.length === 0 ? (
        <p className="muted small">No activity yet. Events will appear here as the appointment is confirmed, reminded, and updated.</p>
      ) : (
        <div className="timeline">
          {events.map((e) => (
            <div className="tl-item" key={e.id}>
              <span className="tl-dot">{icons[e.type] || <Calendar size={11} />}</span>
              <div className="tl-title">{e.title}</div>
              {e.actor ? <div className="tl-detail">By {e.actor}</div> : null}
              {e.detail ? <div className="tl-detail">{e.detail}</div> : null}
              <div className="tl-at">{fmtDateTime(e.at)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
