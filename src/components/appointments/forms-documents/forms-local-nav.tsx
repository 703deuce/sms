"use client";

import { FORMS_SECTIONS, type FormsSectionId } from "./forms-section-types";

type Props = {
  active: FormsSectionId;
  onChange: (id: FormsSectionId) => void;
};

export function FormsLocalNav({ active, onChange }: Props) {
  const activeSection = FORMS_SECTIONS.find((s) => s.id === active);
  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
        <label className="sr-only" htmlFor="forms-section-select">Forms section</label>
        <select
          id="forms-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as FormsSectionId)}
        >
          {FORMS_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {activeSection ? (
          <p className="mt-1.5 text-[var(--type-helper)] text-[var(--text-secondary)]">
            {activeSection.description}
          </p>
        ) : null}
      </div>
      <nav className="ws-section-tabs hidden overflow-x-auto lg:flex" aria-label="Forms sections">
        {FORMS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            aria-current={active === section.id ? "page" : undefined}
            className="ws-section-tab shrink-0"
            title={section.description}
          >
            {section.label}
          </button>
        ))}
      </nav>
    </>
  );
}
