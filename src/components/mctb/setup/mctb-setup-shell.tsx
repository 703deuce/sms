"use client";

import { MctbSetupSectionNav } from "@/components/mctb/setup/mctb-setup-section-nav";
import type { ReactNode } from "react";
import "./mctb-setup-shell.css";

type Props = {
  title: string;
  description: string;
  headerIcon?: ReactNode;
  headerMeta?: ReactNode;
  headerAction?: ReactNode;
  showSectionNav?: boolean;
  navAttention?: Set<string>;
  children: ReactNode;
};

export function MctbSetupShell({
  title,
  description,
  headerIcon,
  headerMeta,
  headerAction,
  showSectionNav = true,
  navAttention,
  children,
}: Props) {
  return (
    <div className="mctb-setup-workspace transovo-operational-redesign">
      <div className="mctb-setup-workspace-inner">
        <header className="mctb-setup-page-header">
          <div className="mctb-setup-page-header__left">
            {headerIcon ? <div className="mctb-setup-page-header__icon">{headerIcon}</div> : null}
            <div className="min-w-0">
              <h1 className="mctb-setup-page-title">{title}</h1>
              <p className="mctb-setup-page-desc">{description}</p>
            </div>
          </div>
          {headerAction || headerMeta ? (
            <div className="mctb-setup-page-header__right">
              {headerMeta ? <div className="mctb-setup-page-header__meta">{headerMeta}</div> : null}
              {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
            </div>
          ) : null}
        </header>
        {showSectionNav ? <MctbSetupSectionNav attention={navAttention} /> : null}
        {children}
      </div>
    </div>
  );
}
