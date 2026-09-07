"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { bookingUrl as mockBookingUrl } from "../types";
import { CalendarCheck, Link2, Mail, MessageSquare, Send, X } from "lucide-react";

type Props = {
  contactId: string;
  phone?: string | null;
  email?: string | null;
};

export function ContactBookingActions({ contactId, phone, email }: Props) {
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [viaSms, setViaSms] = useState(Boolean(phone));
  const [viaEmail, setViaEmail] = useState(!phone && Boolean(email));
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"sent" | "error" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.data?.bookingUrl) setBookingUrl(json.data.bookingUrl);
      })
      .catch(() => {
        if (!cancelled) setBookingUrl(mockBookingUrl);
      });
    // Sandbox fallback so the control is never decorative.
    const t = setTimeout(() => setBookingUrl((u) => u ?? mockBookingUrl), 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Focus management + Escape for the send dialog.
  useEffect(() => {
    if (!sendOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>("input, button");
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSend();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendOpen]);

  function openSend() {
    setViaSms(Boolean(phone));
    setViaEmail(!phone && Boolean(email));
    setSendResult(null);
    setSendOpen(true);
  }

  function closeSend() {
    if (sending) return;
    setSendOpen(false);
  }

  async function sendBookingLink() {
    if (!bookingUrl || (!viaSms && !viaEmail)) return;
    setSending(true);
    setSendResult(null);
    try {
      await fetch("/api/contacts/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_booking_link",
          contactId,
          phone: viaSms ? phone : null,
          email: viaEmail ? email : null,
          bookingUrl,
        }),
      });
      setSendResult("sent");
      setTimeout(() => {
        setSendOpen(false);
        setSendResult(null);
      }, 1600);
    } catch {
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(bookingUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canSend = Boolean(bookingUrl) && (viaSms || viaEmail) && !sending;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
      {bookingUrl ? (
        <Button variant="outline" asChild={undefined}>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit" }}
          >
            <CalendarCheck style={{ width: 14, height: 14 }} />
            Book meeting
          </a>
        </Button>
      ) : null}
      <Button variant="outline" onClick={copyLink} disabled={!bookingUrl}>
        <Link2 style={{ width: 14, height: 14 }} />
        {copied ? "Copied!" : "Copy booking link"}
      </Button>
      <Button variant="primary" onClick={openSend} disabled={!phone && !email}>
        <Send style={{ width: 14, height: 14 }} />
        Send booking link
      </Button>

      {sendOpen ? (
        <div
          role="presentation"
          onClick={closeSend}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(15, 18, 25, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-booking-title"
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 400, padding: 20, boxShadow: "0 12px 32px rgba(16,24,40,0.18)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 id="send-booking-title" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Send booking link
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Choose how to deliver your booking page link to this contact.
                </p>
              </div>
              <button
                className="btn btn-ghost"
                style={{ padding: 6 }}
                onClick={closeSend}
                aria-label="Close"
                disabled={sending}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  padding: "10px 12px",
                  cursor: phone ? "pointer" : "not-allowed",
                  opacity: phone ? 1 : 0.55,
                  background: viaSms ? "rgba(67,56,202,0.04)" : "var(--card)",
                  borderColor: viaSms ? "rgba(67,56,202,0.35)" : "var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={viaSms}
                  disabled={!phone}
                  onChange={(e) => setViaSms(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <MessageSquare style={{ width: 13, height: 13, color: "var(--primary)" }} />
                    Text message
                  </span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--muted-foreground)" }}>
                    {phone ? "Send to this contact's mobile number." : "No mobile number on file."}
                  </span>
                </span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  padding: "10px 12px",
                  cursor: email ? "pointer" : "not-allowed",
                  opacity: email ? 1 : 0.55,
                  background: viaEmail ? "rgba(67,56,202,0.04)" : "var(--card)",
                  borderColor: viaEmail ? "rgba(67,56,202,0.35)" : "var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={viaEmail}
                  disabled={!email}
                  onChange={(e) => setViaEmail(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <Mail style={{ width: 13, height: 13, color: "var(--primary)" }} />
                    Email
                  </span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email ?? "No email address on file."}
                  </span>
                </span>
              </label>
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 8,
                background: "var(--muted)",
                padding: "8px 10px",
                fontSize: 12,
                color: "var(--muted-foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {bookingUrl ?? "Loading booking link…"}
            </div>

            {sendResult === "error" ? (
              <p className="error-banner" style={{ margin: "10px 0 0" }} role="alert">
                The booking link could not be sent. Check your connection and try again.
              </p>
            ) : null}
            {sendResult === "sent" ? (
              <p
                role="status"
                style={{
                  margin: "10px 0 0",
                  borderRadius: 8,
                  background: "#ecfdf5",
                  color: "#047857",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: "6px 10px",
                  boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.2)",
                }}
              >
                Booking link sent{[viaSms && "by text", viaEmail && "by email"].filter(Boolean).join(" and ")}.
              </p>
            ) : null}

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={closeSend} disabled={sending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={sendBookingLink} disabled={!canSend}>
                {sending ? "Sending…" : sendResult === "sent" ? "Sent" : "Send link"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
