"use client";

import { useState } from "react";
import { Copy, ExternalLink, Link2, RefreshCcw } from "lucide-react";
import { Button, Card, fmtDateTime } from "./ui";

export function ManageAppointmentLinkCard({
  appointmentId,
  manageUrl,
  issuedAt,
  timezone,
  readOnly,
  onUpdated,
}: {
  appointmentId: string;
  manageUrl?: string | null;
  issuedAt?: string | null;
  timezone: string;
  readOnly?: boolean;
  onUpdated: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [localUrl, setLocalUrl] = useState(manageUrl || "");
  const [localIssuedAt, setLocalIssuedAt] = useState(issuedAt || "");
  const [error, setError] = useState("");

  const displayUrl = localUrl || manageUrl || "";

  async function ensureLink(regenerate: boolean) {
    setActing(true);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: regenerate ? "regenerate_manage_link" : "ensure_manage_link",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      const url = json.data?.manageAppointmentUrl as string | undefined;
      const at = json.data?.manageAppointmentTokenIssuedAt as string | undefined;
      if (url) setLocalUrl(url);
      if (at) setLocalIssuedAt(at);
      onUpdated();
    } catch {
      setError("Could not update manage link. Try again.");
    } finally {
      setActing(false);
    }
  }

  async function copyLink() {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
    } catch {
      setError("Could not copy link.");
    }
  }

  return (
    <Card
      title={
        <>
          <Link2 size={15} className="muted" /> Customer self-service link
        </>
      }
      sub="Secure link for reschedule, cancel, and manage appointment"
    >
      {displayUrl ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5">
            <p className="text-[12px] font-medium break-all text-[var(--foreground)]">{displayUrl}</p>
            {localIssuedAt || issuedAt ? (
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                Issued {fmtDateTime(localIssuedAt || issuedAt || "", timezone)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={acting} onClick={() => void copyLink()}>
              <Copy size={13} /> Copy link
            </Button>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Open
            </a>
            {!readOnly ? (
              <Button size="sm" variant="outline" disabled={acting} onClick={() => void ensureLink(true)}>
                <RefreshCcw size={13} /> Regenerate
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <p className="muted small" style={{ margin: "0 0 12px" }}>
            No manage link on file for this appointment yet.
          </p>
          {!readOnly ? (
            <Button size="sm" disabled={acting} onClick={() => void ensureLink(false)}>
              Generate manage link
            </Button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-[12px] text-rose-600 mt-2" role="alert">{error}</p> : null}
    </Card>
  );
}
