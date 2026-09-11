"use client";

import { SERVICE_SECTIONS, type ServiceSectionId } from "./service-section-types";

type Props = {
  active: ServiceSectionId;
  onChange: (id: ServiceSectionId) => void;
  /** Sections with an unresolved setup blocker, flagged in the strip. */
  attention?: Set<ServiceSectionId>;
};

/**
 * Section navigation sits horizontally under the object header. The app already
 * spends two columns on vertical navigation — the product sidebar and the
 * service list — and a third rail beside them reads as a wall of menus, so the
 * workspace keeps its full width and the sections run across the top.
 *
 * Both responsive presentations live here so a caller cannot mount one without
 * the other and end up showing two navigations at once. Which one shows is
 * decided in the stylesheet rather than with a utility class, because
 * `.ws-section-tabs` sets `display` itself and would win against one.
 */
export function ServiceLocalNav({ active, onChange, attention }: Props) {
  const activeSection = SERVICE_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:hidden">
        <label className="sr-only" htmlFor="service-section-select">
          Service section
        </label>
        <select
          id="service-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as ServiceSectionId)}
        >
          {SERVICE_SECTIONS.map((s) => (
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

      <nav className="ws-section-tabs" aria-label="Service sections">
        {SERVICE_SECTIONS.map((section) => (
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
