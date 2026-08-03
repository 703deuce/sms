import type { ReactNode } from "react";

/** Minimal chrome-free layout for visual QA of the wizard (dev only). */
export default function DevWizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-5 lg:px-6">{children}</div>
    </div>
  );
}
