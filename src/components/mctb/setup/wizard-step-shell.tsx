"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MctbWizardControlBar } from "@/components/mctb/wizard/mctb-wizard-ui";
import { WizardPageHeader } from "@/components/receptionist/ui";
import "../kimi-ui/reference.css";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onSaveExit?: () => void;
  saveExitHref?: string;
  banner?: boolean;
};

/** Guided setup step shell — receptionist wizard layout + MCTB chrome. */
export function MctbWizardStepShell({
  title,
  description,
  icon: Icon,
  children,
  footer,
  onBack,
  backLabel = "Back",
  primaryLabel = "Continue",
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  onSaveExit,
  banner = true,
}: Props) {
  const showDefaultFooter = footer === undefined && (onPrimary || onBack || onSecondary || onSaveExit);

  return (
    <div className="voice-card overflow-hidden">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <WizardPageHeader
          icon={
            Icon ? (
              <Icon className="h-5 w-5 text-[#6366f1]" strokeWidth={2} aria-hidden />
            ) : (
              <span className="h-2 w-2 rounded-full bg-[#6366f1]" aria-hidden />
            )
          }
          title={title}
          subtitle={description || ""}
          banner={banner}
        />
        <div className="mt-2">{children}</div>
      </div>

      {footer !== undefined ? (
        <div className="border-t border-[#e6e8ef] bg-[#f8f9fc]/60 px-5 py-4 sm:px-6">{footer}</div>
      ) : showDefaultFooter ? (
        <div className="border-t border-[#e6e8ef] bg-[#f8f9fc]/60 px-5 py-4 sm:px-6">
          <MctbWizardControlBar
            showBack={Boolean(onBack)}
            onBack={onBack}
            onContinue={onPrimary}
            onSaveExit={onSaveExit}
            continueLabel={primaryLabel}
            backLabel={backLabel}
            busy={primaryLoading}
            continueDisabled={primaryDisabled}
          />
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[#6366f1] hover:text-[#4f46e5]"
              onClick={onSecondary}
              disabled={primaryLoading}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
