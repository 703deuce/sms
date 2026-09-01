"use client";

import { campaignUi } from "@/components/campaigns/broadcast/campaign-layout";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

type TestMessageModalProps = {
  open: boolean;
  onClose: () => void;
  message: string;
  numberId: string;
};

export function TestMessageModal({ open, onClose, message, numberId }: TestMessageModalProps) {
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [contactId, setContactId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/contacts?take=50")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const rows = (json.data || []).map(
          (c: { id: string; firstName?: string; lastName?: string; phone?: string }) => ({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Contact",
            phone: c.phone || "",
          }),
        );
        setContacts(rows);
        if (rows[0]) setContactId(rows[0].id);
      })
      .catch(() => setContacts([]));
  }, [open]);

  if (!open) return null;

  async function sendTest() {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact?.phone) {
      setError("Select a contact with a valid phone number.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: contact.phone,
          body: message,
          numberId: numberId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test send failed");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-[#111827]">Send Test Message</h2>
            <p className="mt-0.5 text-[12.5px] text-[#6b7280]">
              Verify how your message looks before it goes out.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#6b7280]"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </button>
        </div>
        <div>
          <label className={campaignUi.label}>Send to</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className={campaignUi.input}
          >
            {contacts.length === 0 ? (
              <option value="">No contacts available</option>
            ) : (
              contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2.5 text-[12px] leading-relaxed text-[#4338ca]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Test messages count toward your message credits.</p>
        </div>
        {sent ? (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Test message sent.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2 border-t border-[#f3f4f6] pt-4">
          <button type="button" onClick={onClose} className={cn(campaignUi.outlineBtn, "!h-9")}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={sending || !message.trim()}
            className={cn(campaignUi.primaryBtn, "!h-9")}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sending ? "Sending…" : "Send Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
