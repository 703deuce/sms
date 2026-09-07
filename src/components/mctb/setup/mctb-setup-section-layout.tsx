"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupLocalNav } from "@/components/mctb/setup/mctb-setup-local-nav";
import { Check } from "lucide-react";
import Link from "next/link";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import "../kimi-ui/reference.css";

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
  return (
    <div className="mctb-page">
      <div className="mctb-page-inner mx-auto max-w-[1100px]">
        <div className="mb-2">
          <Link
            href={MCTB_ROUTES.setup}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline"
          >
            ← Setup
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <MctbSetupLocalNav />
          </aside>

          <div className="min-w-0">
            <div className="mb-6 rounded-2xl border border-gray-100 bg-gradient-to-r from-white via-white to-indigo-50/40 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-display text-[22px] font-bold tracking-tight text-gray-900">{title}</h1>
                  <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-gray-600">{description}</p>
                </div>
              {showSave && onSave ? (
                <div className="flex shrink-0 items-center gap-3 pt-1">
                  {saved && !saving ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-600">
                      <Check className="h-4 w-4" aria-hidden />
                      Saved
                    </span>
                  ) : null}
                  <Button onClick={onSave} disabled={saving} size="md" className="text-[13px]">
                    {saving ? "Saving…" : saveLabel}
                  </Button>
                </div>
              ) : null}
              </div>
            </div>

            <div className="mb-4 mt-4 lg:hidden">
              <MctbSetupLocalNav />
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
