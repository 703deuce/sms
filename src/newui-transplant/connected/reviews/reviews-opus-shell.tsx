"use client";

import type { ReactNode } from "react";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";

/** Reviews / Reputation platform — New UI 2 Opus page chrome (shared with Campaigns shell). */
export function ReviewsOpusShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <ArOpusPage wide={wide} className="min-h-0 flex-1 pb-24 lg:pb-8">
      {children}
    </ArOpusPage>
  );
}
