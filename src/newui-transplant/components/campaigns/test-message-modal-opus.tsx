"use client";

import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/newui-transplant/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";
import { Callout } from "@/newui-transplant/components/app/kit";

type Props = {
  open: boolean;
  onClose: () => void;
  message: string;
  numberId: string;
};

export function CampaignTestMessageModalOpus({ open, onClose, message, numberId }: Props) {
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [contactId, setContactId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError("");
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send test message</DialogTitle>
          <DialogDescription>Verify how your message looks before it goes out.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <Callout tone="success" icon={CheckCircle2} title="Test message sent" />
        ) : (
          <>
            <label className="block text-sm font-medium" htmlFor="test-contact">
              Send to
            </label>
            <select
              id="test-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
            <Callout tone="info" icon={Info} title="Preview" className="mt-3 text-xs">
              {message || "(empty message)"}
            </Callout>
            {error ? <Callout tone="danger" title={error} className="mt-2" /> : null}
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          {!sent ? (
            <Button type="button" disabled={sending} onClick={() => void sendTest()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : null}
              Send test
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
