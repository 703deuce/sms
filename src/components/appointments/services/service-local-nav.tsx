"use client";

import { Clock, LayoutGrid, MapPin, Settings2, UserRound, Wallet } from "lucide-react";
import { SERVICE_SECTIONS, type ServiceSectionId } from "./service-section-types";

const ICONS: Record<ServiceSectionId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  scheduling: Clock,
  "staff-place": MapPin,
  "pricing-access": Wallet,
  "customer-setup": UserRound,
  advanced: Settings2,
};

type Props = {
  active: ServiceSectionId;
  onChange: (id: ServiceSectionId) => void;
  /** Sections with an unresolved setup blocker, flagged in the rail. */
  attention?: Set<ServiceSectionId>;
};

/**
 * Both responsive presentations of the same navigation live here — a vertical
 * rail on desktop, a dropdown on smaller screens — so a caller cannot mount one
 * without the other and end up with two navigations at once.
 */
export function ServiceLocalNav({ active, onChange, attention }: Props) {
  const activeSection = SERVICE_SECTIONS.find((s) => s.id === active);

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 lg:hidden">
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

      <nav className="ws-local-nav hidden lg:block" aria-label="Service sections">
        <p className="ws-local-nav-heading">Configure</p>
        <ul className="space-y-0.5">
          {SERVICE_SECTIONS.map((section) => {
            const Icon = ICONS[section.id];
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onChange(section.id)}
                  aria-current={active === section.id ? "page" : undefined}
                  className="ws-local-nav-btn"
                  title={section.description}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{section.label}</span>
                  {attention?.has(section.id) ? (
                    <span
                      className="ws-local-nav-flag"
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
