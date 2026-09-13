"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { formatMoneyMinor, parseAmountToMinor } from "@/lib/payment-requests/format";
import { searchContacts } from "@/lib/inbox/kimi-inbox-adapter";

type Props = {
  open: boolean;
  onClose: () => void;
  stripeConnected: boolean;
  prefill: Record<string, string> | null;
  onSuccess: (id: string) => void;
};

export function RequestPaymentDrawer({ open, onClose, stripeConnected, prefill, onSuccess }: Props) {
  const formId = useId();
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactId, setContactId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [missedCallId, setMissedCallId] = useState("");
  const [sourceType, setSourceType] = useState("standalone");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [expiration, setExpiration] = useState("none");
  const [deliveryMethod, setDeliveryMethod] = useState<"checkout" | "invoice">("checkout");
  const [preview, setPreview] = useState<{ body: string; modeLabel: string; canSend: boolean } | null>(null);
  const [phase, setPhase] = useState<"form" | "sending" | "success">("form");
  const [sendStep, setSendStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [smsFailed, setSmsFailed] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; name: string; phone: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setError(null);
    setSmsFailed(false);
    setCreatedId(null);
    if (prefill) {
      setPhone(prefill.phone || "");
      setCustomerName(prefill.customerName || "");
      setContactId(prefill.contactId || "");
      setConversationId(prefill.conversationId || "");
      setMissedCallId(prefill.missedCallId || "");
      setSourceType(prefill.sourceType || "conversation");
      setCustomerQuery(prefill.name || prefill.phone || "");
    } else {
      setPhone("");
      setCustomerName("");
      setContactId("");
      setConversationId("");
      setMissedCallId("");
      setSourceType("standalone");
      setCustomerQuery("");
    }
    setAmount("");
    setDescription("");
    setNote("");
    setExpiration("none");
    setDeliveryMethod("checkout");
  }, [open, prefill]);

  useEffect(() => {
    if (!open) return;
    const minor = parseAmountToMinor(amount);
    if (!minor || !description.trim()) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      void fetch("/api/payment-requests/preview-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description,
          customerNote: note,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setPreview(json.data);
        })
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [open, amount, description, note]);

  useEffect(() => {
    if (!customerQuery.trim() || conversationId) return;
    void searchContacts(customerQuery).then(setContactOptions);
  }, [customerQuery, conversationId]);

  const submit = async () => {
    setError(null);
    const minor = parseAmountToMinor(amount);
    if (!minor) {
      setError("Enter a valid amount greater than $0");
      return;
    }
    if (!phone.trim()) {
      setError("Customer phone is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!stripeConnected) {
      setError("Connect Stripe before sending payment requests");
      return;
    }

    setPhase("sending");
    setSendStep(
      deliveryMethod === "invoice"
        ? "Creating and sending invoice…"
        : "Creating secure payment link…",
    );
    try {
      const idempotencyKey = `payment-request:${conversationId || "standalone"}:${Date.now()}`;
      const res = await fetch("/api/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          amountMinor: minor,
          description,
          customerNote: note,
          customerName: customerName || undefined,
          customerPhoneE164: phone,
          contactId: contactId || undefined,
          conversationId: conversationId || undefined,
          missedCallId: missedCallId || undefined,
          sourceType,
          expiration,
          deliveryMethod,
        }),
      });
      setSendStep("Sending request…");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create payment request");
      const id = json.data?.request?.id as string;
      setCreatedId(id);
      setSmsFailed(Boolean(json.data?.smsFailed));
      setPhase("success");
    } catch (e) {
      setPhase("form");
      setError(e instanceof Error ? e.message : "Could not create payment request");
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="payments-drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="payments-drawer" role="dialog" aria-labelledby={`${formId}-title`} aria-modal="true">
        <div className="payments-drawer-header">
          <h2 id={`${formId}-title`} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Request payment</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            Send a secure checkout link or a formal Stripe invoice by text.
          </p>
        </div>

        <div className="payments-drawer-body">
          {phase === "success" && createdId ? (
            <div>
              <p style={{ fontWeight: 700 }}>Payment request {smsFailed ? "created" : "sent"}</p>
              <p>{customerName || phone}</p>
              <p>
                {formatMoneyMinor(parseAmountToMinor(amount) || 0)} · {description}
                {deliveryMethod === "invoice" ? " · Invoice sent" : " · Payment link"}
              </p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>Sent to: {phone}</p>
              {smsFailed ? (
                <p role="alert" style={{ color: "#b45309", fontSize: 13 }}>
                  Payment link is ready, but the text could not be sent. Retry from request details or copy the link.
                </p>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" className="payments-primary-btn" onClick={() => onSuccess(createdId)}>Open request</button>
                <button type="button" className="payments-primary-btn" style={{ background: "#fff", color: "#111", border: "1px solid #e5e7eb" }} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <>
              {!stripeConnected ? (
                <div className="payments-setup-banner">
                  <span>Connect Stripe to send payment requests.</span>
                  <Link href="/integrations?provider=stripe">Connect Stripe</Link>
                </div>
              ) : null}

              <div className="payments-field">
                <div className="payments-field-label">Customer</div>
                <input
                  value={conversationId ? `${customerName || phone}` : customerQuery}
                  onChange={(e) => {
                    if (conversationId) return;
                    setCustomerQuery(e.target.value);
                  }}
                  placeholder="Search customer or enter mobile number"
                  readOnly={Boolean(conversationId)}
                  aria-label="Customer phone or search"
                />
                {!conversationId && contactOptions.length > 0 ? (
                  <div style={{ marginTop: 6, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                    {contactOptions.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "#fff", fontSize: 13 }}
                        onClick={() => {
                          setCustomerName(c.name);
                          setPhone(c.phone);
                          setContactId(c.id);
                          setCustomerQuery(c.name);
                          setContactOptions([]);
                        }}
                      >
                        {c.name} · {c.phone}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!conversationId ? (
                  <input
                    style={{ marginTop: 8 }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number (E.164 or US)"
                    aria-label="Customer phone"
                  />
                ) : null}
              </div>

              <div className="payments-row-2">
                <div className="payments-field">
                  <div className="payments-field-label">Amount</div>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$ 125.00" inputMode="decimal" aria-label="Amount" />
                </div>
                <div className="payments-field">
                  <div className="payments-field-label">Currency</div>
                  <input value="USD" readOnly aria-label="Currency" />
                </div>
              </div>

              <div className="payments-field">
                <div className="payments-field-label">What is this for?</div>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Service deposit" aria-required="true" />
              </div>

              <div className="payments-field">
                <div className="payments-field-label">Note to customer — optional</div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional note…" aria-label="Optional note" />
              </div>

              <div className="payments-field">
                <div className="payments-field-label">How to collect payment</div>
                <div className="payments-delivery-options" role="radiogroup" aria-label="Payment collection method">
                  <label className={`payments-delivery-option ${deliveryMethod === "checkout" ? "payments-delivery-option--on" : ""}`}>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      checked={deliveryMethod === "checkout"}
                      onChange={() => setDeliveryMethod("checkout")}
                    />
                    <span>
                      <strong>Secure payment link</strong>
                      <span className="payments-delivery-hint">Stripe Checkout — pay now</span>
                    </span>
                  </label>
                  <label className={`payments-delivery-option ${deliveryMethod === "invoice" ? "payments-delivery-option--on" : ""}`}>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      checked={deliveryMethod === "invoice"}
                      onChange={() => setDeliveryMethod("invoice")}
                    />
                    <span>
                      <strong>Send invoice</strong>
                      <span className="payments-delivery-hint">Formal invoice with hosted pay page</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="payments-field">
                <div className="payments-field-label">Processor</div>
                <div style={{ fontSize: 14 }}>Stripe {stripeConnected ? "· Connected ✓" : "· Not connected"} <Link href="/integrations?provider=stripe">Manage</Link></div>
              </div>

              {preview ? (
                <>
                  <div className="payments-field">
                    <div className="payments-field-label">Sending via</div>
                    <div style={{ fontSize: 14 }}>{preview.modeLabel}</div>
                  </div>
                  <div className="payments-field">
                    <div className="payments-field-label">Text message</div>
                    <div className="payments-preview">{preview.body}</div>
                  </div>
                </>
              ) : null}

              <div className="payments-field">
                <div className="payments-field-label">Payment link expiration</div>
                <select value={expiration} onChange={(e) => setExpiration(e.target.value)} aria-label="Expiration">
                  <option value="none">No expiration</option>
                  <option value="24h">24 hours</option>
                  <option value="3d">3 days</option>
                  <option value="7d">7 days</option>
                </select>
              </div>

              {error ? <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}
              {phase === "sending" ? <p aria-live="polite">{sendStep}</p> : null}
            </>
          )}
        </div>

        {phase !== "success" ? (
          <div className="payments-drawer-footer">
            <button type="button" onClick={onClose} style={{ height: 40, padding: "0 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>Cancel</button>
            <button type="button" className="payments-primary-btn" disabled={phase === "sending" || !stripeConnected} onClick={() => void submit()}>
              Send payment request
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
