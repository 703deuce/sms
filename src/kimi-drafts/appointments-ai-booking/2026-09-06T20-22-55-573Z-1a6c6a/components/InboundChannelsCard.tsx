"use client";

import { CheckCircle2, Mail, MessageSquareText, AlertTriangle, Copy, Check } from "lucide-react";
import { useState } from "react";

const INBOUND_CHANNELS = [
  {
    id: "sms",
    label: "SMS inbound",
    icon: MessageSquareText,
    status: "connected" as const,
    detail: "Shared inbox number +1 (571) 407-3615",
    hint: "Customers text this number to book via AI assistant.",
  },
  {
    id: "email",
    label: "Email webhook",
    icon: Mail,
    status: "connected" as const,
    detail: "booking+riverside@inbound.transovo.com",
    hint: "Forward booking@yourdomain.com to this address.",
    copyValue: "booking+riverside@inbound.transovo.com",
  },
];

export function InboundChannelsCard() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="surface card-pad">
      <div className="card-head">
        <div>
          <h2 className="card-title">Inbound channels</h2>
          <p className="card-sub">
            Where customers can reach the AI booking assistant outside your public booking page.
          </p>
        </div>
      </div>

      <ul className="channel-list">
        {INBOUND_CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const ok = ch.status === "connected";
          return (
            <li key={ch.id} className="channel-row">
              <span className={`channel-icon ${ok ? "channel-icon-ok" : "channel-icon-warn"}`}>
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="channel-label">{ch.label}</span>
                  <span className={`chip ${ok ? "chip-success" : "chip-warning"}`}>
                    {ok ? (
                      <>
                        <CheckCircle2 size={12} /> Connected
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} /> Needs setup
                      </>
                    )}
                  </span>
                </div>
                <p className="channel-detail">{ch.detail}</p>
                <p className="channel-hint">{ch.hint}</p>
              </div>
              {ch.copyValue ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => copy(ch.copyValue!, ch.id)}
                >
                  {copied === ch.id ? <Check size={13} /> : <Copy size={13} />}
                  {copied === ch.id ? "Copied" : "Copy"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="field-hint" style={{ marginTop: 12 }}>
        SMS replies appear in{" "}
        <a href="/conversations" className="link">Messages</a>. Email bookings are processed asynchronously.
      </p>
    </section>
  );
}
