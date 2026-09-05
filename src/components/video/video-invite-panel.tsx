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
};

export function VideoInvitePanel({
  videoMeetingId,
  token,
  title,
  scheduledStartAt,
  variant = "light",
}: Props) {
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={
          variant === "dark"
            ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        <Link2 className="mr-2 h-4 w-4" />
        Invite
      </Button>
    );
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-medium ${variant === "dark" ? "text-white" : ""}`}>
          Invite to meeting
        </p>
        <Button
          size="sm"
          variant="ghost"
          className={variant === "dark" ? "text-white/70 hover:text-white" : undefined}
          onClick={() => setOpen(false)}
        >
          Close
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className={
            variant === "dark"
              ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
              : undefined
          }
          onClick={() => void copyLink()}
        >
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>

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
              className={variant === "dark" ? "border-white/10 bg-slate-950 text-white" : undefined}
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
              className={variant === "dark" ? "border-white/10 bg-slate-950 text-white" : undefined}
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

      {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
    </div>
  );
}
