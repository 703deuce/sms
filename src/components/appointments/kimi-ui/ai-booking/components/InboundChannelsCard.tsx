"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail, MessageSquareText, AlertTriangle, Copy, Check } from "lucide-react";

type ChannelStatus = "connected" | "unconfigured";

type InboundChannel = {
  id: "sms" | "email";
  label: string;
  status: ChannelStatus;
  detail: string;
  hint: string;
  copyValue?: string;
};

function formatPhoneDisplay(e164: string) {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164;
}

export function InboundChannelsCard() {
  const [channels, setChannels] = useState<InboundChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/appointments/ai-booking/channels")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((json) => {
        const sms = json.data?.sms;
        const email = json.data?.email;
        const next: InboundChannel[] = [
          {
            id: "sms",
            label: "SMS inbound",
            status: sms?.configured ? "connected" : "unconfigured",
            detail: sms?.configured
              ? `Shared inbox number ${formatPhoneDisplay(String(sms.e164))}`
              : "No approved sending number configured for this workspace.",
            hint: sms?.configured
              ? "Customers text this number to book via AI assistant."
              : "Add and approve a phone number under Settings → Messaging.",
          },
          {
            id: "email",
            label: "Email webhook",
            status: email?.configured ? "connected" : "unconfigured",
            detail: email?.configured
              ? String(email.address)
              : "Workspace slug required to generate inbound booking email.",
            hint: email?.configured
              ? "Forward booking@yourdomain.com to this address."
              : "Set a workspace slug in business settings to enable inbound email booking.",
            copyValue: email?.configured ? String(email.address) : undefined,
          },
        ];
        setChannels(next);
      })
      .catch(() => {
        setError(true);
        setChannels([]);
      })
      .finally(() => setLoading(false));
  }, []);

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

      {loading ? (
        <p className="field-hint">Loading channel configuration…</p>
      ) : null}

      {error ? (
        <p className="field-hint" style={{ color: "var(--destructive)" }}>
          Could not load inbound channel settings. Try refreshing the page.
        </p>
      ) : null}

      {!loading && !error ? (
        <ul className="channel-list">
          {channels.map((ch) => {
            const Icon = ch.id === "sms" ? MessageSquareText : Mail;
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
      ) : null}

      <p className="field-hint" style={{ marginTop: 12 }}>
        SMS replies appear in{" "}
        <a href="/conversations" className="link">Messages</a>. Email bookings are processed asynchronously.
      </p>
    </section>
  );
}
