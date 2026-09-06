"use client";

import { useEffect, useRef } from "react";
import type { MerchantPaymentProvider } from "../mock-data";
import { AlertTriangle, X } from "lucide-react";

const PROVIDER_LABEL: Record<MerchantPaymentProvider, string> = {
  STRIPE: "Stripe",
  SQUARE: "Square",
};

export function DisconnectModal({
  provider,
  disconnecting,
  onCancel,
  onConfirm,
}: {
  provider: MerchantPaymentProvider;
  disconnecting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const name = PROVIDER_LABEL[provider];
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Initial focus + focus containment + Escape
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="tv-modal-scrim" role="presentation">
      <div
        ref={dialogRef}
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv-disconnect-title"
        aria-describedby="tv-disconnect-desc"
      >
        <div className="tv-modal-header">
          <span className="tv-modal-icon" aria-hidden="true">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h2 id="tv-disconnect-title" className="tv-modal-title">
            Disconnect {name}?
          </h2>
          <button className="tv-modal-close" aria-label="Close" onClick={onCancel} disabled={disconnecting}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p id="tv-disconnect-desc" className="tv-modal-body">
          Customers will no longer be able to pay a deposit or full payment through {name} when
          booking. Any payment requirements on booking types that use {name} will stop collecting
          until you reconnect. Existing transactions and payouts stay in your {name} account.
        </p>
        <div className="tv-modal-actions">
          <button ref={cancelRef} className="tv-btn tv-btn--outline tv-btn--sm" onClick={onCancel} disabled={disconnecting}>
            Keep connected
          </button>
          <button className="tv-btn tv-btn--danger tv-btn--sm" onClick={onConfirm} disabled={disconnecting}>
            {disconnecting ? "Disconnecting…" : `Disconnect ${name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
