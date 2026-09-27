"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

type Order = {
  id: string;
  provider: string;
  externalId: string;
  orderNumber: string | null;
  status: string | null;
  total: string | null;
  currency: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  contactId: string | null;
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  products: unknown;
  shipping: unknown;
  providerUrl: string | null;
  relatedCalls: number;
  relatedSms: number;
  supportTickets: number;
  automationHistory: number;
  safeActions: Record<string, boolean>;
};

export function NativeOrdersOpus() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/native/orders")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setOrders(j.data?.orders || []);
      })
      .catch(() => setError("Failed to load orders"));
  }, []);

  async function safeAction(o: Order, action: string) {
    if (action === "sendSms") {
      window.location.href = o.contactId ? `/conversations?contact=${o.contactId}` : "/conversations";
      return;
    }
    if (action === "call") {
      window.location.href = o.contactId ? `/phone?contact=${o.contactId}` : "/phone";
      return;
    }
    if (action === "addInternalNote") {
      const note = window.prompt("Internal Transovo note");
      if (!note || !o.contactId) return;
      await fetch("/api/integrations/native/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "internal_note",
          contactId: o.contactId,
          orderId: o.externalId,
          note,
        }),
      });
      return;
    }
    if (action === "addOrderNote") {
      const note = window.prompt("Order note (visible in provider)");
      if (!note) return;
      const res = await fetch("/api/integrations/native/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order.add_note",
          provider: o.provider,
          orderId: o.externalId,
          note,
          contactId: o.contactId,
          params: { orderId: o.externalId, note },
        }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "Failed");
      return;
    }
    if (action === "createSupportTicket") {
      const subject = window.prompt("Ticket subject", `Order ${o.orderNumber || o.externalId}`);
      if (!subject) return;
      const res = await fetch("/api/integrations/native/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ticket.create",
          provider: "freshdesk",
          contactId: o.contactId,
          params: {
            subject,
            requesterEmail: o.customerEmail,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Orders & commerce"
        description="WooCommerce orders and Klaviyo commerce profiles synced locally. Refunds, payments, pricing, inventory, and fulfillment changes are not available."
      >
        <ButtonLink href="/integrations/native" variant="outline">← Native integrations</ButtonLink>
      </Panel>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {orders.map((o) => (
        <Panel
          key={o.id}
          title={`Order ${o.orderNumber || o.externalId}`}
          description={`${o.customerName || o.customerEmail || o.customerPhone || "Customer"} · ${o.provider}`}
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral">{o.provider}</Pill>
            <Pill tone="neutral">{o.status || "unknown"}</Pill>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Contact match</dt>
              <dd>
                {o.contactId ? (
                  <Link href={`/contacts/${o.contactId}`} className="text-primary hover:underline">
                    Open contact
                  </Link>
                ) : (
                  "Unmatched"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd>{o.total || "—"} {o.currency || ""}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid</dt>
              <dd>{o.paidAt ? new Date(o.paidAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd>{o.completedAt ? new Date(o.completedAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Related</dt>
              <dd>
                {o.relatedCalls} calls · {o.relatedSms} SMS · {o.supportTickets} tickets ·{" "}
                {o.automationHistory} automations
              </dd>
            </div>
          </dl>
          {o.products ? (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-muted/40 p-2 text-xs">
              {JSON.stringify(o.products, null, 2)}
            </pre>
          ) : null}
          {o.shipping ? (
            <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-muted/40 p-2 text-xs">
              {JSON.stringify(o.shipping, null, 2)}
            </pre>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {o.safeActions.openProvider && o.providerUrl ? (
              <ButtonLink href={o.providerUrl} variant="ghost" size="sm" target="_blank" rel="noreferrer">
                Open provider
              </ButtonLink>
            ) : null}
            {(
              [
                ["sendSms", "Send SMS"],
                ["call", "Call"],
                ["addOrderNote", "Add order note"],
                ["createSupportTicket", "Create support ticket"],
                ["addInternalNote", "Internal note"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                disabled={!o.safeActions[key]}
                onClick={() => safeAction(o, key)}
              >
                {label}
              </Button>
            ))}
            <span className="text-sm text-muted-foreground">Refund / payment / inventory (disabled)</span>
          </div>
        </Panel>
      ))}
      {!orders.length && !error ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            No orders synced yet. Connect WooCommerce or Klaviyo and run a sync.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
