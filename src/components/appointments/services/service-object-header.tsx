"use client";

import { Briefcase, Check, Copy, ExternalLink, Globe, MoreHorizontal } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

type Props = {
  form: AppointmentTypeFormState;
  saveStatus: "saved" | "dirty" | "saving" | "error";
  saving: boolean;
  isCreating: boolean;
  error?: string;
  bookingLink: string | null;
  copied: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onSave: () => void;
  onPreview: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
};

export function ServiceObjectHeader({
  form,
  saveStatus,
  saving,
  isCreating,
  error,
  bookingLink,
  copied,
  menuOpen,
  onMenuToggle,
  onSave,
  onPreview,
  onCopyLink,
  onDuplicate,
  onToggleActive,
}: Props) {
  const isSaved = saveStatus === "saved" && !isCreating;
  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "dirty" || saveStatus === "error"
        ? "Save changes"
        : "Saved";

  const title = isCreating ? "Create service" : form.name || "Untitled service";

  return (
    <header className="ws-object-header">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="ws-object-icon" aria-hidden>
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            {!isCreating ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="ws-badge-neutral">Service</span>
                <span className={form.enabled ? "ws-badge-active" : "ws-badge-neutral"}>
                  {form.enabled ? <Check className="h-3 w-3" aria-hidden /> : null}
                  {form.enabled ? "Active" : "Inactive"}
                </span>
                {form.visibility === "public" && form.enabled ? (
                  <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                    <Globe className="h-3 w-3" aria-hidden />
                    Publicly bookable
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {bookingLink ? (
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={onPreview}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                View booking page
              </button>
              <button type="button" className="appt-pilot-outline-btn" onClick={onCopyLink}>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? "Copied" : "Copy link"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={isSaved ? "ws-saved-btn" : "ws-saved-btn is-dirty"}
            disabled={saving || (saveStatus !== "dirty" && saveStatus !== "error" && !isCreating)}
            onClick={onSave}
          >
            {isSaved ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            {isCreating ? (saving ? "Creating…" : "Create service") : saveLabel}
          </button>
          {!isCreating ? (
            <div className="relative">
              <button
                type="button"
                className="appt-pilot-outline-btn px-2.5"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="More actions"
                onClick={onMenuToggle}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-muted)]"
                    onClick={onDuplicate}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-muted)]"
                    onClick={onToggleActive}
                  >
                    {form.enabled ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p
          className="mt-3 rounded-lg border border-[var(--state-error)]/30 bg-[var(--state-error-soft)] px-3 py-2 text-[13px] text-[var(--state-error)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </header>
  );
}
