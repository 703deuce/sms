"use client";

import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

type Step = "enter" | "code" | "verified";

export function SmsOptIn({ onVerified }: { onVerified?: (phone: string) => void }) {
  const [step, setStep] = useState<Step>("enter");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function sendCode() {
    setError("");
    setInfo("");
    if (!consent) {
      setError("Please agree to receive SMS before continuing.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, consent }),
    });
    setLoading(false);
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      delivered?: boolean;
    };
    if (!res.ok) {
      setError(data.error || "Could not send a code. Check the number and try again.");
      return;
    }
    setStep("code");
    setInfo(
      data.delivered
        ? `We sent a 6-digit verification code to ${phone}.`
        : `A 6-digit verification code was generated for ${phone}.`,
    );
  }

  async function verifyCode() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/phone/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    setLoading(false);
    const data = (await res.json().catch(() => ({}))) as { error?: string; phone?: string };
    if (!res.ok) {
      setError(data.error || "That code is not correct.");
      return;
    }
    setStep("verified");
    setInfo("");
    onVerified?.(data.phone || phone);
  }

  return (
    <div className="space-y-4">
      {step !== "verified" ? (
        <>
          <div>
            <Label htmlFor="opt-in-phone">Mobile number</Label>
            <Input
              id="opt-in-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              disabled={step === "code"}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {step === "enter" ? (
            <>
              <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Enter your mobile number to receive a one-time verification code from {BRAND_NAME}{" "}
                  by SMS. Message and data rates may apply. Message frequency varies. Reply STOP to
                  opt out and HELP for help. View our{" "}
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
              <Button type="button" className="w-full" onClick={sendCode} disabled={loading}>
                {loading ? "Sending..." : "Send verification code"}
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="opt-in-code">Verification code</Label>
                <Input
                  id="opt-in-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button type="button" className="w-full" onClick={verifyCode} disabled={loading}>
                {loading ? "Verifying..." : "Verify code"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:underline"
                onClick={() => {
                  setStep("enter");
                  setCode("");
                  setInfo("");
                  setError("");
                }}
              >
                Use a different number
              </button>
            </>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-center">
          <p className="text-sm font-medium text-success">Mobile number verified</p>
          <p className="mt-1 text-xs text-muted-foreground">{phone} is confirmed for SMS.</p>
        </div>
      )}

      {info ? <p className="text-xs text-muted-foreground">{info}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
