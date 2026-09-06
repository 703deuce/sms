"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, ShieldCheck, X } from "lucide-react";
import type { MeetingRow } from "../mock-data";

function makeToken(): string {
  return `shr_${Math.random().toString(36).slice(2, 10)}`;
}

export function ShareRecapModal({
  row,
  shareToken,
  onClose,
  onConfirm,
  onRevoke,
}: {
  row: MeetingRow;
  shareToken: string | null;
  onClose: () => void;
  onConfirm: (token: string) => void;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const shareUrl = shareToken
    ? `https://app.transovo.com/recap/${shareToken}`
    : null;

  // Focus management: focus dialog on open, restore on close, Escape closes, focus trap.
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
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
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function copyLink() {
    if (!shareUrl) return;
    try {
      navigator.clipboard?.writeText(shareUrl);
    } catch {
      // clipboard unavailable in sandbox — still show confirmation
    }
    setCopied(true);
  }

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-recap-title"
        ref={dialogRef}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="menu-item-icon" aria-hidden="true">
              <Link2 size={14} />
            </span>
            <div>
              <h2 id="share-recap-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Share recap
              </h2>
              <p className="text-muted" style={{ margin: "2px 0 0", fontSize: 12.5 }}>
                {row.title || "Meeting"}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Close"
            onClick={onClose}
            style={{ padding: "0 8px" }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {shareUrl ? (
          <>
            <p className="text-muted" style={{ margin: "16px 0 8px", fontSize: 13 }}>
              Anyone with this link can view the recap summary — no sign-in required. The recording and transcript are never shared.
            </p>
            <div className="share-url-row">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="Public recap link"
                onFocus={(e) => e.currentTarget.select()}
                className="share-url-input"
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={copyLink}>
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="share-note" style={{ marginTop: 14 }}>
              <ShieldCheck size={13} aria-hidden="true" />
              <span>Link stays active until you revoke it.</span>
            </div>

            {confirmRevoke ? (
              <div className="share-revoke-confirm" role="alert">
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Revoke this share link?</p>
                <p className="text-muted" style={{ margin: "4px 0 12px", fontSize: 12.5 }}>
                  The public link will stop working immediately. You can create a new link later.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmRevoke(false)}>
                    Keep link
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: "var(--danger)", color: "#fff" }}
                    onClick={() => { onRevoke(); }}
                  >
                    Revoke link
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: 13, color: "var(--danger)" }}
                  onClick={() => setConfirmRevoke(true)}
                >
                  Revoke link
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                  Done
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted" style={{ margin: "16px 0 0", fontSize: 13 }}>
              Create a public link to share this recap with people outside your workspace — for example, the customer or attendees.
            </p>
            <ul className="share-facts">
              <li>Includes the recap summary and action items.</li>
              <li>Recording and transcript are never shared.</li>
              <li>You can revoke the link at any time.</li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onConfirm(makeToken())}
              >
                <Link2 size={14} aria-hidden="true" />
                Create share link
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
