"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

type Props = {
  conversationId: string;
  contactId?: string | null;
  phone: string;
  customerName: string;
  missedCallId?: string | null;
};

type BookingType = { id: string; name: string; durationMinutes?: number };

export function MctbConversationBookingActions({
  conversationId,
  contactId,
  phone,
  customerName,
  missedCallId,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [types, setTypes] = useState<BookingType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/appointments/types?kind=MEETING")
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data || []) as BookingType[];
        setTypes(rows);
        if (rows[0]) setSelectedTypeId(rows[0].id);
      })
      .catch(() => setTypes([]));
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => setBookingUrl(json.data?.bookingUrl || null))
      .catch(() => setBookingUrl(null));
  }, []);

  const bookHref = new URLSearchParams({
    conversationId,
    customerPhone: phone,
    ...(contactId ? { contactId } : {}),
    ...(customerName ? { customerName } : {}),
    ...(missedCallId ? { missedCallId } : {}),
  });

  const sendLink = async () => {
    if (!contactId || !bookingUrl) {
      setError("Booking link or contact is unavailable");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const type = types.find((t) => t.id === selectedTypeId);
      const url = type ? `${bookingUrl}?type=${encodeURIComponent(type.id)}` : bookingUrl;
      const res = await fetch("/api/contacts/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_booking_link",
          contactId,
          phone,
          bookingUrl: url,
          conversationId,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not send booking link");
      }
      setLinkOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, padding: "8px 16px", borderTop: "1px solid #eee", flexWrap: "wrap" }}>
        <Link
          href={`${MCTB_ROUTES.appointmentsNew}?${bookHref.toString()}`}
          className="mctb-booking-primary-btn"
          style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", minWidth: 0, height: 34, fontSize: 12 }}
        >
          Book appointment
        </Link>
        <button
          type="button"
          className="mctb-booking-primary-btn"
          style={{ minWidth: 0, height: 34, fontSize: 12, background: "#fff", color: "#111", border: "1px solid #e5e7eb" }}
          onClick={() => setLinkOpen(true)}
        >
          Send booking link
        </button>
      </div>

      {linkOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send booking link"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !sending && setLinkOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, padding: 20, width: "min(420px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Send booking link</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Choose a booking type</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {types.map((t) => (
                <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="radio"
                    name="bookingType"
                    checked={selectedTypeId === t.id}
                    onChange={() => setSelectedTypeId(t.id)}
                  />
                  <span>{t.name}</span>
                  {t.durationMinutes ? <span style={{ color: "#9ca3af" }}>{t.durationMinutes} min</span> : null}
                </label>
              ))}
            </div>
            {error ? <p role="alert" style={{ color: "#b91c1c", fontSize: 12, marginTop: 10 }}>{error}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setLinkOpen(false)} disabled={sending}>Cancel</button>
              <button type="button" className="mctb-booking-primary-btn" onClick={() => void sendLink()} disabled={sending || !contactId}>
                {sending ? "Sending…" : "Send link"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
