"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import type { Contact, PhoneNumber } from "@/lib/types";
import { cn, estimateSmsSegments, formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
import { Check, Paperclip, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MediaPicker } from "@/components/messaging/media-picker";

type ApiContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  status: string;
};

function mapContact(c: ApiContact): Contact {
  const statusMap: Record<string, Contact["status"]> = {
    SUBSCRIBED: "Subscribed",
    UNSUBSCRIBED: "Unsubscribed",
    BLOCKED: "Blocked",
    INVALID: "Invalid",
  };
  return {
    id: c.id,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    phone: c.phone,
    email: c.email || "",
    status: statusMap[c.status] || "Subscribed",
    lists: [],
    tags: [],
    consentSource: "",
    consentDate: "",
    lastMessaged: null,
    lastReply: null,
    dateAdded: "",
    assignedUser: null,
  };
}

type SendMode = "contacts" | "manual";

export function SendMessagePage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SendMode>("manual");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState("");
  const [numberId, setNumberId] = useState("");
  const [message, setMessage] = useState("Hi {{first_name}}, ");
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [pools, setPools] = useState<{ id: string; name: string }[]>([]);
  const [senderPoolId, setSenderPoolId] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [showMedia, setShowMedia] = useState(false);

  useEffect(() => {
    const to = searchParams.get("to");
    if (to) {
      setManualPhone(to);
      setMode("manual");
    }
    const body = searchParams.get("body");
    if (body) setMessage(body);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/contacts?status=subscribed")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setContacts(json.data.map(mapContact));
      })
      .catch(() => undefined);
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length) {
          setPhoneNumbers(json.data);
          const preferred =
            json.data.find((n: PhoneNumber) => n.number.includes("571407")) || json.data[0];
          setNumberId(preferred.id);
        }
      })
      .catch(() => undefined);
    fetch("/api/numbers/pools")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setPools(json.data);
      })
      .catch(() => undefined);
  }, []);

  const sendableContacts = contacts.filter((c) => c.status === "Subscribed");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sendableContacts;
    return sendableContacts.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [search, sendableContacts]);

  const { characters, segments } = estimateSmsSegments(message);
  const recipientCount = mode === "manual" ? (manualPhone.trim() ? 1 : 0) : selectedIds.length;
  const estimatedCost = recipientCount * segments * 0.015;
  const selectedNumber = phoneNumbers.find((n) => n.id === numberId);

  function toggleContact(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    const visibleIds = filtered.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  }

  async function sendToPhone(phone: string, firstName = "", lastName = "") {
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        message: message
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{last_name\}\}/g, lastName),
        from: selectedNumber?.number,
        customerName: `${firstName} ${lastName}`.trim() || undefined,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        senderPoolId: senderPoolId || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to send message");
    return json.data;
  }

  async function handleSend() {
    if (!selectedNumber || recipientCount === 0 || !message.trim()) return;
    setSending(true);
    setError("");
    try {
      let count = 0;
      if (mode === "manual") {
        await sendToPhone(manualPhone.trim());
        count = 1;
      } else {
        const selected = sendableContacts.filter((c) => selectedIds.includes(c.id));
        for (const contact of selected) {
          await sendToPhone(contact.phone, contact.firstName, contact.lastName);
          count += 1;
        }
      }
      setSentCount(count);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send messages");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div>
        <PageHeader title="Send" description="One-off SMS to contacts or a phone number." />
        <Card className="mx-auto max-w-lg text-center">
          <StatusChip status="Approved" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Message sent</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatNumber(sentCount)} recipient{sentCount === 1 ? "" : "s"} · {segments} segment
            {segments === 1 ? "" : "s"} each · est. {formatCurrency(estimatedCost)}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setSent(false)}>
              Send another
            </Button>
            <Link href="/conversations">
              <Button>View conversations</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Send"
        description="Send a one-off SMS from your business number."
        actions={
          <>
            <Link href="/campaigns/new/promotion">
              <Button variant="outline">New campaign</Button>
            </Link>
            <Link href="/send/ai">
              <Button variant="outline">AI Composer</Button>
            </Link>
          </>
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="mb-4 flex gap-2">
        {(
          [
            ["manual", "Phone number"],
            ["contacts", "From contacts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              mode === id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          {mode === "manual" ? (
            <>
              <CardTitle>Recipient phone number</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter a mobile number in any format. Must be opted in for marketing sends.
              </p>
              <div className="mt-4">
                <Label htmlFor="manual-phone">Phone</Label>
                <Input
                  id="manual-phone"
                  placeholder="(571) 477-6175"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Select contacts</CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllVisible}>
                  {filtered.every((c) => selectedIds.includes(c.id)) && filtered.length > 0
                    ? "Deselect visible"
                    : "Select visible"}
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, phone, or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ul className="mt-4 max-h-[420px] space-y-1 overflow-y-auto">
                {filtered.map((contact) => {
                  const selected = selectedIds.includes(contact.id);
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => toggleContact(contact.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                          selected ? "border-primary bg-violet-50" : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                          )}
                        >
                          {selected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatPhone(contact.phone)}</p>
                        </div>
                        <StatusChip status={contact.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Compose message</CardTitle>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Sending number</Label>
                <Select
                  value={numberId}
                  onChange={(e) => setNumberId(e.target.value)}
                  disabled={phoneNumbers.length === 0 || senderPoolId !== ""}
                >
                  {phoneNumbers.length === 0 ? (
                    <option value="">No numbers available</option>
                  ) : (
                    phoneNumbers.map((n) => (
                      <option key={n.id} value={n.id}>
                        {formatPhone(n.number)} · {n.friendlyName || "Line"}
                      </option>
                    ))
                  )}
                </Select>
              </div>
              {pools.length > 0 ? (
                <div>
                  <Label>Sender pool (optional)</Label>
                  <Select value={senderPoolId} onChange={(e) => setSenderPoolId(e.target.value)}>
                    <option value="">Use single number above</option>
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div>
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowMedia(true)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Attach media
                  </button>
                </div>
                <Textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message…"
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Send summary</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Recipients</dt>
                <dd className="font-medium">{formatNumber(recipientCount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SMS segments</dt>
                <dd className="font-medium">{segments}</dd>
              </div>
            </dl>
            <Button
              className="mt-4 w-full"
              disabled={sending || recipientCount === 0 || !message.trim() || !selectedNumber}
              onClick={handleSend}
            >
              {sending ? "Sending…" : `Send message`}
            </Button>
          </Card>
        </div>
      </div>
      <MediaPicker
        open={showMedia}
        onClose={() => setShowMedia(false)}
        initialSelected={mediaUrls}
        onConfirm={setMediaUrls}
      />
    </div>
  );
}
