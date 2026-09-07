import { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="tv-public-page">
      <header className="tv-public-header">
        <span className="tv-brand" aria-label="Transovo">
          <span className="tv-brand-mark" aria-hidden="true">T</span>
          Transovo
        </span>
      </header>
      <main className="tv-public-main">{children}</main>
      <footer className="tv-public-footer">
        <span>Powered by Transovo</span>
        <span>Appointments &amp; scheduling</span>
      </footer>
    </div>
  );
}
