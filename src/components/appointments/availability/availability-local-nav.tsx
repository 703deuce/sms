"use client";

import { AVAILABILITY_SECTIONS, type AvailabilitySectionId } from "./availability-section-types";

type Props = {
  active: AvailabilitySectionId;
  onChange: (id: AvailabilitySectionId) => void;
  attention?: Set<AvailabilitySectionId>;
};

export function AvailabilityLocalNav({ active, onChange, attention }: Props) {
  const activeSection = AVAILABILITY_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
        <label className="sr-only" htmlFor="availability-section-select">Availability section</label>
        <select
          id="availability-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as AvailabilitySectionId)}
        >
          {AVAILABILITY_SECTIONS.map((s) => (
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

      <nav
        className="ws-section-tabs hidden overflow-x-auto lg:flex"
        aria-label="Availability sections"
      >
        {AVAILABILITY_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={active === section.id ? "page" : undefined}
            className="ws-section-tab shrink-0"
            title={section.description}
          >
            {section.label}
            {attention?.has(section.id) ? (
              <span className="ws-section-tab-flag" aria-label={`${section.label} needs attention`} />
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
}
