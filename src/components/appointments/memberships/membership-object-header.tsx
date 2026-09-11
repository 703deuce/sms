"use client";

import { useEffect, useRef } from "react";
import { Check, Copy, CreditCard, MoreHorizontal, Power, Trash2 } from "lucide-react";
import type { MembershipFormState } from "@/lib/appointments/memberships/membership-form";

type Props = {
  form: MembershipFormState;
  saveStatus: "saved" | "dirty" | "saving" | "error";
  saving: boolean;
  error?: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
};

export function MembershipObjectHeader({
  form,
  saveStatus,
  saving,
  error,
  menuOpen,
  onMenuToggle,
  onMenuClose,
  onSave,
  onDuplicate,
  onDeactivate,
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

  const purchaseLabel =
    form.purchaseAvailability === "public"
      ? "Available for purchase"
      : form.purchaseAvailability === "booking_only"
        ? "Available during booking"
        : null;

  return (
    <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
      <div className="ws-event-head-main min-w-0">
        <span className="ws-icon-tile" aria-hidden>
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h1 className="ws-event-title truncate">{form.name || "Untitled membership"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="ws-badge">Membership</span>
            <span className={form.active ? "ws-badge is-success" : "ws-badge"}>
              {form.active ? "Active" : "Inactive"}
            </span>
            {purchaseLabel ? <span className="ws-badge is-soft">{purchaseLabel}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {saveStatus === "saved" ? (
          <span className="ws-save-indicator" role="status">
            <Check className="h-3.5 w-3.5" aria-hidden />
            Saved
          </span>
        ) : saveStatus === "saving" ? (
          <span className="ws-save-indicator" role="status">Saving…</span>
        ) : (
          <button
            type="button"
            className="appt-pilot-primary-btn"
            disabled={saving}
            onClick={onSave}
          >
            Save changes
          </button>
        )}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="ws-icon-btn"
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={onMenuToggle}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="ws-menu-popover right-0">
              <button type="button" className="ws-menu-item" onClick={onDuplicate}>
                <Copy className="h-4 w-4" aria-hidden />
                Duplicate
              </button>
              <button type="button" className="ws-menu-item" onClick={onDeactivate}>
                <Power className="h-4 w-4" aria-hidden />
                Deactivate
              </button>
              <button type="button" className="ws-menu-item is-danger" onClick={onDelete}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="ws-inline-error mt-2 w-full" role="alert">{error}</p> : null}
    </header>
  );
}
