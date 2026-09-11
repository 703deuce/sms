"use client";

import { MEMBERSHIP_SECTIONS, type MembershipSectionId } from "./membership-section-types";

type Props = {
  active: MembershipSectionId;
  onChange: (id: MembershipSectionId) => void;
  attention?: Set<MembershipSectionId>;
};

export function MembershipLocalNav({ active, onChange, attention }: Props) {
  const activeSection = MEMBERSHIP_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:hidden">
        <label className="sr-only" htmlFor="membership-section-select">Membership section</label>
        <select
          id="membership-section-select"
          className="input"
          value={active}
          onChange={(e) => onChange(e.target.value as MembershipSectionId)}
        >
          {MEMBERSHIP_SECTIONS.map((s) => (
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

      <nav className="ws-section-tabs" aria-label="Membership sections">
        {MEMBERSHIP_SECTIONS.map((section) => (
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
