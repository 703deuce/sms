"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useEffect, useState } from "react";

type PaymentLinkRow = {
  id: string;
  phone: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: string;
  url: string;
  createdAt: string;
};

export default function MessagingPaymentsPage() {
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("25.00");
  const [description, setDescription] = useState("Invoice payment");
  const [smsBody, setSmsBody] = useState("Hi! Pay your invoice here: ");
  const [sendSms, setSendSms] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/payments/links");
    const json = await res.json();
    setLinks(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const amountCents = Math.round(parseFloat(amount) * 100);
    try {
      const res = await fetch("/api/payments/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          amountCents,
          description,
          sendSms,
          smsBody,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create link");
      setPhone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Text-to-pay"
        description="Create Stripe checkout links and text them to customers. Mock links are created when STRIPE_SECRET_KEY is not set."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <CardTitle>Create payment link</CardTitle>
          <form onSubmit={createLink} className="space-y-4">
            <div>
              <Label htmlFor="phone">Customer phone</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min="0.50"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
              />
              Send link via SMS immediately
            </label>
            {sendSms ? (
              <div>
                <Label htmlFor="sms">SMS message</Label>
                <Textarea
                  id="sms"
                  rows={2}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                />
              </div>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create & send"}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <CardTitle>Recent links</CardTitle>
          {links.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No payment links yet.</p>
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Phone</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH>Link</TH>
                </TR>
              </THead>
              <TBody>
                {links.map((link) => (
                  <TR key={link.id}>
                    <TD>{link.phone}</TD>
                    <TD>
                      ${(link.amountCents / 100).toFixed(2)} {link.currency.toUpperCase()}
                    </TD>
                    <TD>
                      <StatusChip status={link.status} />
                    </TD>
                    <TD>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Open
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
