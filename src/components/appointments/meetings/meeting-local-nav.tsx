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
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
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
    <nav
      className="hidden w-[200px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-3 lg:block"
      aria-label="Meeting sections"
    >
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
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition ${
                  isActive
                    ? "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]/20"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                }`}
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
