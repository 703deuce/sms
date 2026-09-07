"use client";

import { ReactNode } from "react";
import { workspace as mockWorkspace } from "../mock-data";
import { ShieldCheck, Phone, MapPin } from "lucide-react";

type WorkspaceInfo = {
  name: string;
  logoInitial?: string;
  phone?: string;
  address?: string;
};

export function BookingShell({
  children,
  workspace = mockWorkspace,
}: {
  children: ReactNode;
  workspace?: WorkspaceInfo;
}) {
  const logoInitial = workspace.logoInitial || workspace.name.charAt(0);
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
      <header
        className="sticky top-0 z-10 border-b border-border"
        style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground"
            style={{ background: "var(--primary)" }}
          >
            {logoInitial}
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold text-foreground">{workspace.name}</p>
            <p className="text-[11px] text-muted-foreground">Online booking</p>
          </div>
          <div className="ml-auto hidden items-center gap-1.5 text-[12px] font-medium text-muted-foreground sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Secure booking
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {workspace.phone || mockWorkspace.phone}
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <MapPin className="h-3.5 w-3.5" /> {workspace.address || mockWorkspace.address}
            </span>
          </div>
          <div className="flex items-center gap-4 sm:ml-auto">
            <a href="#" className="hover:text-foreground hover:underline">Terms of Service</a>
            <a href="#" className="hover:text-foreground hover:underline">Privacy Policy</a>
            <span>Powered by <span className="font-semibold text-foreground">Transovo</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
