"use client";

import { PACKAGE_SECTIONS, type PackageSectionId } from "./package-section-types";

type Props = {
  active: PackageSectionId;
  onChange: (id: PackageSectionId) => void;
  attention?: Set<PackageSectionId>;
};

export function PackageLocalNav({ active, onChange, attention }: Props) {
  const activeSection = PACKAGE_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:hidden">
        <label className="sr-only" htmlFor="package-section-select">Package section</label>
        <select
          id="package-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as PackageSectionId)}
        >
          {PACKAGE_SECTIONS.map((s) => (
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

      <nav className="ws-section-tabs" aria-label="Package sections">
        {PACKAGE_SECTIONS.map((section) => (
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
              <span className="ws-section-tab-flag" aria-label={`${section.label} needs attention`} />
            ) : null}
          </button>
        ))}
      </nav>
    </>
  );
}
