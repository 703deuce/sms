"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
};

/** Guided setup step shell — premium Appointments configuration language */
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
}: Props) {
  const showDefaultFooter = footer === undefined && (onPrimary || onBack || onSecondary);

  return (
    <div className="ref-card overflow-hidden">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-indigo-50/30 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="icon-tile tile-purple shrink-0">
              <Icon size={20} strokeWidth={2} aria-hidden />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-gray-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">{children}</div>

      {footer !== undefined ? (
        <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4 sm:px-6">{footer}</div>
      ) : showDefaultFooter ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/40 px-5 py-4 sm:px-6",
            onBack ? "justify-between" : "justify-end",
          )}
        >
          {onBack ? (
            <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={primaryLoading}>
              {backLabel}
            </Button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {secondaryLabel && onSecondary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSecondary}
                disabled={primaryLoading}
              >
                {secondaryLabel}
              </Button>
            ) : null}
            {onPrimary ? (
              <Button
                type="button"
                size="sm"
                className="shadow-sm"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryLoading}
              >
                {primaryLoading ? "Saving…" : primaryLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
