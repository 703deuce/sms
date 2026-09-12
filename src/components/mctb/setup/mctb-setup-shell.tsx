"use client";

import { MctbSetupSectionNav } from "@/components/mctb/setup/mctb-setup-section-nav";
import type { ReactNode } from "react";
import "./mctb-setup-shell.css";

type Props = {
  title: string;
  description: string;
  headerAction?: ReactNode;
  showSectionNav?: boolean;
  navAttention?: Set<string>;
  children: ReactNode;
};

export function MctbSetupShell({
  title,
  description,
  headerAction,
  showSectionNav = true,
  navAttention,
  children,
}: Props) {
  return (
    <div className="mctb-setup-workspace">
      <div className="mctb-setup-workspace-inner">
        <header className="mctb-setup-page-header">
          <div>
            <h1 className="mctb-setup-page-title">{title}</h1>
            <p className="mctb-setup-page-desc">{description}</p>
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </header>
        {showSectionNav ? <MctbSetupSectionNav attention={navAttention} /> : null}
        {children}
      </div>
    </div>
  );
}
