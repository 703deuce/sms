"use client";

import { useEffect, useRef } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Globe,
  MoreHorizontal,
  Power,
  Trash2,
  Users,
} from "lucide-react";
import type { ClassFormState } from "@/lib/appointments/classes/class-form";

type Props = {
  form: ClassFormState;
  saveStatus: "saved" | "dirty" | "saving" | "error";
  saving: boolean;
  error?: string;
  bookingLink: string | null;
  copied: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onSave: () => void;
  onPreview: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export function ClassObjectHeader({
  form,
  saveStatus,
  saving,
  error,
  bookingLink,
  copied,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onSave,
  onPreview,
  onCopyLink,
  onDuplicate,
  onToggleActive,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onMenuClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onMenuClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, onMenuClose]);

  const unsaved = saveStatus === "dirty" || saveStatus === "error";
  const listedPublicly = form.active && form.visibility === "public";

  return (
    <header className="ws-object-header">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ws-object-icon" aria-hidden>
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="ws-object-title">{form.name || "Untitled class"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="ws-object-kind">
                Class{form.category ? ` · ${form.category}` : ""}
              </span>
              <span className={`ws-chip ${form.active ? "ws-chip-success" : "ws-chip-neutral"}`}>
                {form.active ? <Check className="h-3 w-3" aria-hidden /> : null}
                {form.active ? "Active" : "Inactive"}
              </span>
              {listedPublicly ? (
                <span className="ws-chip ws-chip-neutral">
                  <Globe className="h-3 w-3" aria-hidden />
                  Listed publicly
                </span>
              ) : (
                <span className="ws-chip ws-chip-neutral">
                  <EyeOff className="h-3 w-3" aria-hidden />
                  {form.active ? "Hidden from the public page" : "Not open for registration"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {bookingLink ? (
            <>
              <button type="button" className="appt-pilot-outline-btn" onClick={onPreview}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">View registration page</span>
                <span className="sm:hidden">View</span>
              </button>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={onCopyLink}
                aria-label="Copy registration link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? "Copied" : "Copy link"}
              </button>
            </>
          ) : null}

          {unsaved || saving ? (
            <button
              type="button"
              className="appt-pilot-primary-btn"
              disabled={saving}
              onClick={onSave}
            >
              {saveStatus === "error" ? <AlertCircle className="h-3.5 w-3.5" aria-hidden /> : null}
              {saving ? "Saving…" : saveStatus === "error" ? "Retry save" : "Save changes"}
            </button>
          ) : (
            <span className="ws-save-state" role="status">
              <Check className="h-3.5 w-3.5 text-[var(--state-success)]" aria-hidden />
              Saved
            </span>
          )}

          <div className="relative" ref={menuRef}>
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
              <div className="ws-menu" role="menu">
                <button type="button" role="menuitem" className="ws-menu-item" onClick={onDuplicate}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Duplicate class
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`ws-menu-item${form.active ? " danger" : ""}`}
                  onClick={onToggleActive}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {form.active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" role="menuitem" className="ws-menu-item danger" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete class
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p
          className="mt-3 flex items-center gap-2 rounded-lg border border-[rgba(199,72,72,0.3)] bg-[var(--state-error-soft)] px-3 py-2 text-[var(--type-list)] text-[var(--state-error)]"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </header>
  );
}
