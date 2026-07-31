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

export default function QuickSendPage() {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [numberId, setNumberId] = useState("");
  const [message, setMessage] = useState("Hi {{first_name}}, ");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [pools, setPools] = useState<{ id: string; name: string }[]>([]);
  const [senderPoolId, setSenderPoolId] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [showMedia, setShowMedia] = useState(false);

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
          setNumberId(json.data[0].id);
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
  const recipientCount = selectedIds.length;
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

  async function handleSend() {
    if (!selectedNumber || recipientCount === 0 || !message.trim()) return;
    setSending(true);
    setError("");
    try {
      const selected = sendableContacts.filter((c) => selectedIds.includes(c.id));
      for (const contact of selected) {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: contact.phone,
            message: message
              .replace(/\{\{first_name\}\}/g, contact.firstName)
              .replace(/\{\{last_name\}\}/g, contact.lastName),
            from: selectedNumber.number,
            customerName: `${contact.firstName} ${contact.lastName}`.trim(),
            mediaUrls: mediaUrls.length ? mediaUrls : undefined,
            senderPoolId: senderPoolId || undefined,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to send message");
        }
      }
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
        <PageHeader title="Quick text" description="One-off message to selected contacts." />
        <Card className="mx-auto max-w-lg text-center">
          <StatusChip status="Sending" />
          <h2 className="mt-4 font-display text-2xl font-semibold">Message queued</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatNumber(recipientCount)} recipient{recipientCount === 1 ? "" : "s"} · {segments} segment
            {segments === 1 ? "" : "s"} each · est. {formatCurrency(estimatedCost)}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setSent(false)}>
              Send another
            </Button>
            <Link href="/inbox">
              <Button>View inbox</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Quick text"
        description="Send a one-off SMS to selected contacts without creating a full campaign."
        actions={
          <>
            <Link href="/send">
              <Button variant="outline">Campaign wizard</Button>
            </Link>
            <Link href="/send/test">
              <Button variant="outline">Send test</Button>
            </Link>
          </>
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
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
                      selected ? "border-primary bg-teal-50" : "border-border hover:bg-muted/50",
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
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(contact.phone)} · {contact.lists.join(", ") || "No lists"}
                      </p>
                    </div>
                    <StatusChip status={contact.status} />
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No subscribed contacts match your search.
            </p>
          ) : null}
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
                        {formatPhone(n.number)} · {n.friendlyName}
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rotate sends across all numbers in the pool.
                  </p>
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
                    {mediaUrls.length ? ` (${mediaUrls.length})` : ""}
                  </button>
                </div>
                <Textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message…"
                />
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {["{{first_name}}", "{{last_name}}", "{{business_name}}"].map((token) => (
                    <button
                      key={token}
                      type="button"
                      className="rounded-md border border-border px-2 py-1 hover:bg-muted"
                      onClick={() => setMessage((m) => m + token)}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                {mediaUrls.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mediaUrls.map((url) => (
                      <span
                        key={url}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                      >
                        MMS media
                        <button
                          type="button"
                          className="text-rose-600"
                          onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
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
                <dt className="text-muted-foreground">Characters</dt>
                <dd className="font-medium">{characters}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SMS segments</dt>
                <dd className="font-medium">{segments}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-muted-foreground">Estimated cost</dt>
                <dd className="font-medium">{formatCurrency(estimatedCost)}</dd>
              </div>
            </dl>
            <Button
              className="mt-4 w-full"
              disabled={
                sending ||
                recipientCount === 0 ||
                !message.trim() ||
                segments === 0 ||
                !selectedNumber
              }
              onClick={handleSend}
            >
              {sending
                ? "Sending…"
                : `Send to ${formatNumber(recipientCount)} contact${recipientCount === 1 ? "" : "s"}`}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Unsubscribed and blocked contacts are excluded automatically.
            </p>
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
