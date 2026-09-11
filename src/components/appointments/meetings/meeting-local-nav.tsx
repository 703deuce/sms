"use client";

import {
  Calendar,
  ClipboardList,
  LayoutGrid,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { MEETING_SECTIONS, type MeetingSectionId } from "./meeting-section-types";

const ICONS: Record<MeetingSectionId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  availability: Calendar,
  "hosts-method": Users,
  questions: ClipboardList,
  "booking-rules": Shield,
  advanced: Settings2,
};

type Props = {
  active: MeetingSectionId;
  onChange: (id: MeetingSectionId) => void;
  mobile?: boolean;
};

export function MeetingLocalNav({ active, onChange, mobile }: Props) {
  if (mobile) {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:hidden">
        <label className="sr-only" htmlFor="meeting-section-select">Section</label>
        <select
          id="meeting-section-select"
          value={active}
          onChange={(e) => onChange(e.target.value as MeetingSectionId)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] font-medium"
        >
          {MEETING_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <nav className="ws-local-nav hidden lg:block" aria-label="Meeting sections">
      <ul className="space-y-0.5">
        {MEETING_SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          const isActive = active === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onChange(section.id)}
                aria-current={isActive ? "page" : undefined}
                className="ws-local-nav-btn"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
