import type { ReactNode } from "react";

/** Minimal chrome for Layout B calendar workspace visual QA (dev / screenshot automation). */
export default function DevArLayoutBLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
