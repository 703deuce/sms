"use client";

import { campaignUi } from "@/components/campaigns/broadcast/campaign-layout";
import { cn } from "@/lib/utils";
import { Info, Loader2, X } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827]">Send Test Message</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[#f3f4f6]">
            <X className="h-5 w-5 text-[#6b7280]" />
          </button>
        </div>
        <div>
          <label className={campaignUi.label}>Send to</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className={cn(campaignUi.input, "mt-1.5")}
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
        <div className="mt-4 flex gap-2 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3 text-[12px] text-[#4338ca]">
          <Info className="h-4 w-4 shrink-0" />
          <p>Test messages count toward your message credits.</p>
        </div>
        {sent ? (
          <p className="mt-4 text-[13px] font-medium text-[#059669]">Test message sent.</p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-[#dc2626]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={campaignUi.outlineBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={sending || !message.trim()}
            className={campaignUi.primaryBtn}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send Test
          </button>
        </div>
      </div>
    </div>
  );
}
