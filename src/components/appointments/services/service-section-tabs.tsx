"use client";

import { SERVICE_SECTIONS, type ServiceSectionId } from "./service-section-types";

type Props = {
  active: ServiceSectionId;
  onChange: (id: ServiceSectionId) => void;
};

export function ServiceSectionTabs({ active, onChange }: Props) {
  return (
    <>
      <div className="ws-section-tabs hidden sm:flex" role="tablist" aria-label="Service sections">
        {SERVICE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active === section.id}
            aria-current={active === section.id ? "page" : undefined}
            className="ws-section-tab"
            onClick={() => onChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 sm:hidden">
        <label className="sr-only" htmlFor="service-section-select">Section</label>
        <select
          id="service-section-select"
          value={active}
          onChange={(e) => onChange(e.target.value as ServiceSectionId)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[13px] font-medium"
        >
          {SERVICE_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
