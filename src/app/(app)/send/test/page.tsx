"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { SMS_OPT_IN_DISCLOSURE } from "@/lib/auth/sms-opt-in-copy";
import type { DashboardMetrics, PhoneNumber } from "@/lib/types";
import { estimateSmsSegments, formatPhone } from "@/lib/utils";
import { pickPreferredSmsSendingNumber } from "@/lib/messaging/preferred-sending-number";
import { CheckCircle2, MessageSquare, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEMO_MESSAGE =
  "Transovo: Welcome! This is a test message from your Transovo account. Reply HELP for help, STOP to opt out.";

export default function SendTestPage() {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState(DEMO_MESSAGE);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setPhoneNumbers(json.data);
      })
      .catch(() => undefined);
    fetch("/api/reports/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.metrics) setMetrics(json.data.metrics);
      })
      .catch(() => undefined);
  }, []);

  const sendingNumber = pickPreferredSmsSendingNumber(phoneNumbers) || phoneNumbers[0];
  const { characters, segments } = estimateSmsSegments(message);

  async function sendOtp() {
    setError("");
    setInfo("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid mobile number to receive the verification code.");
      return;
    }
    if (!consent) {
      setError("Please agree to receive SMS before continuing.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/auth/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, consent }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        delivered?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not send a verification code. Try again.");
      }
      setOtpSent(true);
      setOtp("");
      setInfo(
        data.delivered
          ? `We sent a 6-digit verification code to ${formatPhone(phone)}.`
          : `A verification code was generated for ${formatPhone(phone)}. If you do not receive a text, check that SMS verification is configured for this environment.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setInfo("");
    if (!otp.trim()) {
      setError("Enter the 6-digit verification code from your text message.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/auth/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; phone?: string };
      if (!res.ok) {
        throw new Error(data.error || "That code is not correct.");
      }
      setVerified(true);
      setInfo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify code.");
    } finally {
      setVerifying(false);
    }
  }

  async function sendDemo() {
    if (!verified || !sendingNumber) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          message,
          from: sendingNumber.number,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send test message");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Test message"
        description="Verify your personal mobile number and send a Transovo-branded demo SMS."
        actions={
          <>
            <Link href="/send">
              <Button variant="outline">Campaign wizard</Button>
            </Link>
            <Link href="/send/quick">
              <Button variant="outline">Quick text</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-50 p-2 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Verify personal test number</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your mobile number to receive test messages before sending to customers.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label>Your mobile number</Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={verified || otpSent}
                />
              </div>

              {!verified ? (
                <>
                  {!otpSent ? (
                    <>
                      <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-border"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        <span>
                          {SMS_OPT_IN_DISCLOSURE} View our{" "}
                          <Link href="/terms" className="text-primary hover:underline">
                            Terms
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy" className="text-primary hover:underline">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>
                      <Button onClick={() => void sendOtp()} disabled={sending}>
                        {sending ? "Sending…" : "Send verification code"}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label>Verification code</Label>
                        <Input
                          placeholder="6-digit code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          maxLength={6}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void verifyOtp()} disabled={verifying}>
                          {verifying ? "Verifying…" : "Verify number"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setOtpSent(false);
                            setOtp("");
                            setInfo("");
                            setError("");
                          }}
                        >
                          Change number
                        </Button>
                        <Button variant="outline" onClick={() => void sendOtp()} disabled={sending}>
                          {sending ? "Resending…" : "Resend code"}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{formatPhone(phone)}</strong> verified for test sends
                  </span>
                </div>
              )}

              {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-50 p-2 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Send Transovo demo message</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preview how messages appear from your workspace with compliance footer included.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label>From</Label>
                {sendingNumber ? (
                  <p className="text-sm font-medium">
                    {formatPhone(sendingNumber.number)} · {sendingNumber.friendlyName}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No sending number configured.</p>
                )}
              </div>
              <div>
                <Label>Message body</Label>
                <Textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!verified}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {characters} characters · {segments} segment{segments === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                disabled={!verified || sent || !message.trim() || !sendingNumber || sending}
                onClick={() => void sendDemo()}
              >
                {sent ? "Demo sent" : sending ? "Sending…" : "Send demo to my phone"}
              </Button>
              {sent ? (
                <div className="flex items-center gap-2 text-sm text-violet-800">
                  <StatusChip status="Delivered" />
                  <span>Demo message delivered to {formatPhone(phone)}</span>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden p-0">
            <div className="bg-sidebar px-4 py-3">
              <p className="font-display text-sm font-semibold text-white">Transovo preview</p>
              <p className="text-xs text-sidebar-muted">iPhone message thread</p>
            </div>
            <div className="space-y-3 bg-muted/30 p-4">
              <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
                Today
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                <p className="whitespace-pre-wrap">{message || DEMO_MESSAGE}</p>
                <p className="mt-1 text-[10px] opacity-70">Delivered</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <CardTitle>Account status</CardTitle>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center justify-between gap-2">
                    <span>A2P registration</span>
                    <StatusChip status={metrics?.a2pStatus ?? "Pending"} />
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Active number</span>
                    <span className="font-medium text-foreground">
                      {metrics?.activeNumber ?? "No number"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Test number</span>
                    <span className="font-medium text-foreground">
                      {verified ? formatPhone(phone) : "Not verified"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
