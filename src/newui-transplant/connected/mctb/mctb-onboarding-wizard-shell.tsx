"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MCTB_WIZARD_PRIMARY_STEPS } from "@/lib/mctb/onboarding/wizard-flow";
import { cn } from "@/lib/utils";
import { OPUS_CARD, OPUS_CONFIG_INSET } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

export type WizardFooterConfig = {
  back?: boolean;
  primary?: { label: string; disabled?: boolean; onClick: () => void };
  secondary?: { label: string; disabled?: boolean; onClick: () => void };
};

const FooterCtx = createContext<{
  setFooter: (f: WizardFooterConfig | null) => void;
} | null>(null);

export function useMctbWizardFooter(config: WizardFooterConfig | null) {
  const ctx = useContext(FooterCtx);
  const primaryLabel = config?.primary?.label;
  const primaryDisabled = config?.primary?.disabled;
  const secondaryLabel = config?.secondary?.label;
  useEffect(() => {
    ctx?.setFooter(config);
    return () => ctx?.setFooter(null);
  }, [ctx, config, config?.back, primaryLabel, primaryDisabled, secondaryLabel]);
}

function SegmentedProgress({ currentIndex }: { currentIndex: number }) {
  const total = MCTB_WIZARD_PRIMARY_STEPS.length;
  return (
    <div
      className="mt-3 flex gap-1"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={currentIndex + 1}
      aria-label={`Step ${currentIndex + 1} of ${total}`}
    >
      {MCTB_WIZARD_PRIMARY_STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i <= currentIndex ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

type ShellProps = {
  presentation: "page" | "modal";
  stageIndex: number;
  saving: boolean;
  onBack?: () => void;
  children: ReactNode;
  footer: WizardFooterConfig | null;
};

export function MctbOnboardingWizardShell({
  presentation,
  stageIndex,
  saving,
  onBack,
  children,
  footer,
}: ShellProps) {
  const stepNumber = Math.min(stageIndex + 1, MCTB_WIZARD_PRIMARY_STEPS.length);
  const modal = presentation === "modal";

  const header = (
    <header
      className={cn(
        "shrink-0 border-b px-6 py-4",
        modal ? "bg-background" : cn("mb-6", OPUS_CARD, "border-b-0 px-5 py-4"),
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Set up Missed Call Text Back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few steps and you&apos;ll be ready to recover missed calls.
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Step {stepNumber} of {MCTB_WIZARD_PRIMARY_STEPS.length}
        </p>
      </div>
      <SegmentedProgress currentIndex={Math.min(stageIndex, MCTB_WIZARD_PRIMARY_STEPS.length - 1)} />
    </header>
  );

  const footerBar = footer ? (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-t bg-background px-6 py-4",
        !modal && OPUS_CARD,
        !modal && "mt-0 border-t-0",
      )}
    >
      <div>
        {footer.back && onBack ? (
          <Button type="button" variant="outline" disabled={saving} onClick={onBack}>
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {footer.secondary ? (
          <Button
            type="button"
            variant="ghost"
            disabled={saving || footer.secondary.disabled}
            onClick={footer.secondary.onClick}
          >
            {footer.secondary.label}
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">{saving ? "Saving…" : null}</span>
        {footer.primary ? (
          <Button
            type="button"
            disabled={saving || footer.primary.disabled}
            onClick={footer.primary.onClick}
          >
            {footer.primary.label}
          </Button>
        ) : null}
      </div>
    </footer>
  ) : null;

  if (modal) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
        {header}
        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card px-6 py-5">
          <div className="mx-auto w-full max-w-[640px] pb-28">{children}</div>
        </div>
        {footerBar}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {header}
      <div className="mx-auto w-full max-w-[640px]">{children}</div>
      {footerBar ? <div className="mx-auto mt-6 max-w-[640px]">{footerBar}</div> : null}
    </div>
  );
}

export function MctbOnboardingWizardFooterProvider({
  children,
  onFooterChange,
}: {
  children: ReactNode;
  onFooterChange: (f: WizardFooterConfig | null) => void;
}) {
  const value = useMemo(() => ({ setFooter: onFooterChange }), [onFooterChange]);
  return <FooterCtx.Provider value={value}>{children}</FooterCtx.Provider>;
}

export function WizardStepIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className={cn("mb-6 border-l-4 border-l-primary py-3 pl-4", OPUS_CONFIG_INSET)}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-pretty text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
