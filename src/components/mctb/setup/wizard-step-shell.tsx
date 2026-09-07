"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/** Guided setup step shell — Appointment configuration visual language */
export function MctbWizardStepShell({
  title,
  description,
  children,
  onBack,
  backLabel = "Back",
  primaryLabel = "Continue",
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <div className="ref-card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="space-y-4">{children}</div>

      <div className={cn("flex flex-wrap items-center gap-2 border-t border-border pt-4", onBack ? "justify-between" : "justify-end")}>
        {onBack ? (
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={primaryLoading}>
            {backLabel}
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {secondaryLabel && onSecondary ? (
            <Button type="button" variant="outline" size="sm" onClick={onSecondary} disabled={primaryLoading}>
              {secondaryLabel}
            </Button>
          ) : null}
          {onPrimary ? (
            <Button type="button" size="sm" onClick={onPrimary} disabled={primaryDisabled || primaryLoading}>
              {primaryLoading ? "Saving…" : primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
