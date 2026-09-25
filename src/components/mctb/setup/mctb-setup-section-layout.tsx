"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import { Check } from "lucide-react";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
  saving?: boolean;
  saved?: boolean;
  error?: string | null;
  onSave?: () => void;
  saveLabel?: string;
  showSave?: boolean;
};

/**
 * Legacy section pages (Phone, Recovery, etc.) — uses the new horizontal Setup shell.
 * Section content redesign happens in later passes.
 */
export function MctbSetupSectionLayout({
  title,
  description,
  children,
  saving = false,
  saved = false,
  error,
  onSave,
  saveLabel = "Save changes",
  showSave = true,
}: Props) {
  const headerAction =
    showSave && onSave ? (
      <div className="flex shrink-0 items-center gap-3">
        {saved && !saving ? (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1f6b42]">
            <Check className="h-4 w-4" aria-hidden />
            Saved
          </span>
        ) : null}
        <Button onClick={onSave} disabled={saving} size="md" className="text-[13px]">
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    ) : (
      <Link href={MCTB_ROUTES.setupTest} className="mctb-setup-btn mctb-setup-btn--primary">
        Run live test
      </Link>
    );

  return (
    <MctbSetupShell
      title="Setup"
      description="Configure missed-call recovery, forwarding, consent, voicemail, and operational controls."
      headerAction={headerAction}
    >
      {error ? (
        <div
          className="mb-4 rounded-lg border border-[#f0d0d0] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#9b2c2c]"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div className="min-w-0 w-full max-w-none">
        <p className="mb-3 text-[12px]">
          <Link href={MCTB_ROUTES.setup} className="font-semibold text-[#626872] hover:text-[#1b1e23]">
            ← Setup
          </Link>
        </p>
        <div className="mb-4">
          <h2 className="text-[1.125rem] font-semibold tracking-tight text-[#1b1e23]">{title}</h2>
          <p className="mt-1 text-[13px] text-[#626872]">{description}</p>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </MctbSetupShell>
  );
}
