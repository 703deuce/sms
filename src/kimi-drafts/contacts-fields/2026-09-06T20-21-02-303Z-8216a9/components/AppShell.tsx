"use client";
import Sidebar, { View } from "./Sidebar";

export default function AppShell({ view, onNavigate, children }: { view: View; onNavigate: (v: View) => void; children: React.ReactNode }) {
  return (
    <div className="tv-app">
      <a href="#tv-main" className="tv-skip-link">Skip to main content</a>
      <Sidebar view={view} onNavigate={onNavigate} />
      <main className="tv-main" id="tv-main">
        <div className="tv-main-inner">{children}</div>
      </main>
    </div>
  );
}
