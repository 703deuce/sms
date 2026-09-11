"use client";

import { CLASS_SECTIONS, type ClassSectionId } from "./class-section-types";

type Props = {
  active: ClassSectionId;
  onChange: (id: ClassSectionId) => void;
  /** Sections holding something that stops this class being registered for. */
  attention?: Set<ClassSectionId>;
};

/**
 * Section navigation is a horizontal strip, not a column. The screen already
 * spends one column on the product sidebar and one on the class list; a third
 * rail would leave the workspace — the part that actually holds the work —
 * with about a third of the width.
 *
 * Both responsive presentations live here so a caller cannot mount one without
 * the other. Which one shows is decided in the stylesheet rather than with a
 * utility class, because `.ws-section-tabs` sets `display` itself and would
 * win against `hidden`.
 */
export function ClassLocalNav({ active, onChange, attention }: Props) {
  const activeSection = CLASS_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:hidden">
        <label className="sr-only" htmlFor="class-section-select">
          Class section
        </label>
        <select
          id="class-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as ClassSectionId)}
        >
          {CLASS_SECTIONS.map((s) => (
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

      <nav className="ws-section-tabs" aria-label="Class sections">
        {CLASS_SECTIONS.map((section) => (
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
