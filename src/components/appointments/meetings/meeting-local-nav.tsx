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
  /** Sections with an unresolved setup blocker, flagged in the rail. */
  attention?: Set<MeetingSectionId>;
};

/**
 * Renders both responsive presentations of the same navigation: a vertical rail
 * on desktop and a dropdown below it. Keeping both inside one component is what
 * stops a caller from mounting the dropdown and the rail side by side.
 */
export function MeetingLocalNav({ active, onChange, attention }: Props) {
  const activeSection = MEETING_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
        <label className="sr-only" htmlFor="meeting-section-select">
          Meeting section
        </label>
        <select
          id="meeting-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as MeetingSectionId)}
        >
          {MEETING_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {attention?.has(s.id) ? " — needs attention" : ""}
            </option>
          ))}
        </select>
        {activeSection ? (
          <p className="mt-1.5 text-[var(--type-helper)] text-[var(--text-secondary)]">
            {activeSection.description}
          </p>
        ) : null}
      </div>

      <nav className="ws-local-nav hidden lg:block" aria-label="Meeting sections">
        <p className="ws-local-nav-heading">Configure</p>
        <ul className="space-y-0.5">
          {MEETING_SECTIONS.map((section) => {
            const Icon = ICONS[section.id];
            const isActive = active === section.id;
            const needsAttention = attention?.has(section.id);
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onChange(section.id)}
                  aria-current={isActive ? "page" : undefined}
                  className="ws-local-nav-btn"
                  title={section.description}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{section.label}</span>
                  {needsAttention ? (
                    <span
                      className="ws-local-nav-flag"
                      title={`${section.label} needs attention`}
                      aria-label={`${section.label} needs attention`}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
