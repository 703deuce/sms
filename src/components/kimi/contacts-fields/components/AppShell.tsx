"use client";
import Sidebar, { View } from "./Sidebar";

export default function AppShell({ view, onNavigate, children }: { view: View; onNavigate: (v: View) => void; children: React.ReactNode }) {
  return (
    <div className="tv-app">
      <Sidebar view={view} onNavigate={onNavigate} />
      <main className="tv-main">{children}</main>
    </div>
  );
}
