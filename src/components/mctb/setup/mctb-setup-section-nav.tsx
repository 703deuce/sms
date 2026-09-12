"use client";

import { MCTB_SETUP_SECTIONS, resolveMctbSetupSectionId } from "@/lib/mctb/setup-sections";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  attention?: Set<string>;
};

export function MctbSetupSectionNav({ attention }: Props) {
  const pathname = usePathname() || "";
  const active = resolveMctbSetupSectionId(pathname);

  return (
    <div className="mctb-setup-section-nav-wrap">
      <nav className="mctb-setup-section-nav" aria-label="Setup sections">
        {MCTB_SETUP_SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className="mctb-setup-section-nav-link"
            aria-current={active === section.id ? "page" : undefined}
            title={section.description}
          >
            {section.label}
            {attention?.has(section.id) ? (
              <span className="mctb-setup-section-nav-flag" aria-hidden />
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
