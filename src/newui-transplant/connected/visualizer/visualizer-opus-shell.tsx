"use client";

import type { ReactNode } from "react";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";

export function VisualizerOpusShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <ArOpusPage wide={wide} className="min-h-0 flex-1 pb-24 lg:pb-8">
      {children}
    </ArOpusPage>
  );
}
