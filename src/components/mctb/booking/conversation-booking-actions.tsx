"use client";

import { useCallback, useEffect, useState } from "react";
import type { MctbBookingLinkDto } from "@/lib/mctb/booking-links/service";
import { bookingLinkHostname } from "@/lib/mctb/booking-links/validate-url";

type Props = {
  conversationId: string;
  contactId?: string | null;
  phone: string;
  customerName: string;
  missedCallId?: string | null;
};

export function MctbConversationBookingActions({
  conversationId,
  contactId,
  phone,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [links, setLinks] = useState<MctbBookingLinkDto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const res = await fetch("/api/mctb/booking-links?active=1");
    const json = await res.json();
    const rows = (json.data || []) as MctbBookingLinkDto[];
    setLinks(rows);
    const def = rows.find((r) => r.isDefault) ?? rows[0];
    if (def) setSelectedId(def.id);
  }, []);

  useEffect(() => {
    void loadLinks().catch(() => setLinks([]));
  }, [loadLinks]);

  const sendLink = async () => {
    const link = links.find((l) => l.id === selectedId);
    if (!contactId || !link) {
      setError("Choose an active booking link and ensure the contact is linked.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_booking_link",
          contactId,
          phone,
          bookingUrl: link.url,
          conversationId,
          bookingLinkLabel: link.label,
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
      <div className="flex flex-wrap gap-2 border-t border-[#eaedf0] px-4 py-2">
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-[#dde2ea] bg-white px-3 text-[12px] font-semibold text-[var(--mctb-brand-strong,#2f3f85)] hover:bg-[var(--mctb-brand-soft,#e8eefb)]"
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
          onClick={() => !sending && setLinkOpen(false)}
        >
          <div
            className="w-full max-w-[min(520px,100%)] rounded-xl border border-[#dde2ea] bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#0a0d12]">Send booking link</h3>
            <p className="mt-1 text-[13px] text-[#4a5563]">
              Customer books in your external scheduler — no Transovo appointment is created.
            </p>
            {links.length === 0 ? (
              <p className="mt-4 text-[13px] text-[#7a8494]">
                No active booking links. Add links under Setup → Recovery.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {links.map((link) => (
                  <li key={link.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-[13px] ${
                        selectedId === link.id
                          ? "border-[var(--mctb-brand-ring,#c5d4f2)] bg-[var(--mctb-brand-soft,#e8eefb)]"
                          : "border-[#eaedf0]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mctbBookingLink"
                        className="mt-0.5"
                        checked={selectedId === link.id}
                        onChange={() => setSelectedId(link.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-[#0a0d12]">{link.label}</span>
                        <span className="block text-[12px] text-[#7a8494]">
                          {bookingLinkHostname(link.url)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {error ? (
              <p role="alert" className="mt-3 text-[12px] font-medium text-[#b42318]">{error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-lg px-4 text-[13px] font-medium text-[#4a5563]"
                onClick={() => setLinkOpen(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-10 rounded-lg bg-[#1b1e23] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={() => void sendLink()}
                disabled={sending || !contactId || links.length === 0}
              >
                {sending ? "Sending…" : "Send link"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
