"use client";

import { MEETING_SECTIONS, type MeetingSectionId } from "./meeting-section-types";

type Props = {
  active: MeetingSectionId;
  onChange: (id: MeetingSectionId) => void;
  /** Sections with an unresolved setup blocker, flagged in the strip. */
  attention?: Set<MeetingSectionId>;
};

/**
 * Section navigation sits horizontally under the object header. The product
 * sidebar is already a vertical menu and the meetings list is a second one; a
 * third rail beside them reads as a wall of menus and leaves the form about a
 * third of the screen.
 *
 * Both responsive presentations live here so a caller cannot mount one without
 * the other and end up showing two navigations at once. Which one shows is
 * decided in the stylesheet rather than with a utility class, because
 * `.ws-section-tabs` sets `display` itself and would win against one.
 */
export function MeetingLocalNav({ active, onChange, attention }: Props) {
  const activeSection = MEETING_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:hidden">
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

      <nav className="ws-section-tabs" aria-label="Meeting sections">
        {MEETING_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={active === section.id ? "page" : undefined}
            className="ws-section-tab"
            title={section.description}
          >
            {section.label}
            {attention?.has(section.id) ? (
              <span
                className="ws-section-tab-flag"
                aria-label={`${section.label} needs attention`}
              />
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
}
