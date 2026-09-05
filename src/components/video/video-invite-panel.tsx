"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Check, Copy, Link2, Mail, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  videoMeetingId: string;
  token: string;
  title?: string | null;
  scheduledStartAt?: string | null;
  variant?: "dark" | "light";
  /** compact = lists/cards; card = pre-join / schedule confirmation; header = in-meeting toolbar */
  layout?: "compact" | "card" | "header";
};

export function VideoInvitePanel({
  videoMeetingId,
  token,
  title,
  scheduledStartAt,
  variant = "light",
  layout = "compact",
}: Props) {
  const [showSendOptions, setShowSendOptions] = useState(layout === "card");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<"email" | "sms" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  const guestUrl = useMemo(() => {
    if (typeof window === "undefined") return `/video/${token}`;
    return `${window.location.origin}/video/${token}`;
  }, [token]);

  async function copyLink() {
    const meetingTitle = title || "Transovo Video meeting";
    const when = scheduledStartAt
      ? `When: ${new Date(scheduledStartAt).toLocaleString()}\n`
      : "";
    await navigator.clipboard.writeText(`${meetingTitle}\n${when}Join: ${guestUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function sendInvite(channel: "email" | "sms") {
    const to = channel === "email" ? email.trim() : phone.trim();
    if (!to) {
      setError(channel === "email" ? "Email is required." : "Phone number is required.");
      return;
    }
    setBusy(channel);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/video/meetings/${videoMeetingId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not send invite");
      setSuccess(channel === "email" ? "Invite sent by email." : "Invite sent by SMS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setBusy(null);
    }
  }

  const shell =
    variant === "dark"
      ? "rounded-lg border border-white/10 bg-white/5 p-4"
      : "rounded-lg border bg-card p-4";

  const urlFieldClass =
    variant === "dark"
      ? "border-white/10 bg-slate-950 text-white"
      : "bg-muted/40";

  const copyButtonClass =
    variant === "dark"
      ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
      : undefined;

  const linkRow = (
    <div className="flex flex-wrap items-center gap-2">
      <code
        className={`min-w-0 flex-1 break-all rounded-md border px-3 py-2 text-xs ${
          variant === "dark" ? "border-white/10 bg-slate-950 text-white/90" : "bg-muted/40"
        }`}
      >
        {guestUrl}
      </code>
      <Button
        size="sm"
        variant="outline"
        className={copyButtonClass}
        onClick={() => void copyLink()}
      >
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      {layout === "compact" ? (
        <Button
          size="sm"
          variant="outline"
          className={copyButtonClass}
          onClick={() => setShowSendOptions((v) => !v)}
        >
          <Mail className="mr-2 h-4 w-4" />
          {showSendOptions ? "Hide send" : "Send invite"}
        </Button>
      ) : null}
    </div>
  );

  const sendOptions = showSendOptions ? (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={`invite-email-${videoMeetingId}`}>Send by email</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id={`invite-email-${videoMeetingId}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="guest@example.com"
            className={urlFieldClass}
          />
          <Button
            size="sm"
            disabled={busy === "email"}
            onClick={() => void sendInvite("email")}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor={`invite-sms-${videoMeetingId}`}>Send by SMS</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id={`invite-sms-${videoMeetingId}`}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
            className={urlFieldClass}
          />
          <Button
            size="sm"
            disabled={busy === "sms"}
            onClick={() => void sendInvite("sms")}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (layout === "header") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={copyButtonClass}
          onClick={() => void copyLink()}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy guest link"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={copyButtonClass}
          onClick={() => setShowSendOptions((v) => !v)}
        >
          <Mail className="mr-2 h-4 w-4" />
          {showSendOptions ? "Hide invite" : "Send invite"}
        </Button>
        {showSendOptions ? (
          <div className="w-full rounded-lg border border-white/10 bg-slate-900/95 p-4">
            {sendOptions}
            {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (layout === "card") {
    return (
      <div className={shell}>
        <div className="flex items-start gap-3">
          <Link2
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              variant === "dark" ? "text-white/70" : "text-primary"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${variant === "dark" ? "text-white" : ""}`}>
              Guest join link
            </p>
            <p
              className={`mt-1 text-sm ${
                variant === "dark" ? "text-white/70" : "text-muted-foreground"
              }`}
            >
              Share this link with anyone you want in the meeting. They join from their browser —
              no account required.
            </p>
          </div>
        </div>

        <div className="mt-4">{linkRow}</div>
        {sendOptions}

        {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
        {success ? (
          <p className={`mt-3 text-sm ${variant === "dark" ? "text-emerald-300" : "text-emerald-600"}`}>
            {success}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={shell}>
      <p className={`text-xs font-medium ${variant === "dark" ? "text-white/70" : "text-muted-foreground"}`}>
        Guest link
      </p>
      <div className="mt-2">{linkRow}</div>
      {sendOptions}
      {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
      {success ? (
        <p className={`mt-3 text-sm ${variant === "dark" ? "text-emerald-300" : "text-emerald-600"}`}>
          {success}
        </p>
      ) : null}
    </div>
  );
}
