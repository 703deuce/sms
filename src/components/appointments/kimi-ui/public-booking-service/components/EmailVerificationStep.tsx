"use client";

import { Mail, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button, Input, Label } from "./ui";

export function EmailVerificationStep({
  email,
  otpCode,
  otpSent,
  submitting,
  error,
  onEmailChange,
  onOtpChange,
  onSend,
  onVerify,
  onBack,
}: {
  email: string;
  otpCode: string;
  otpSent: boolean;
  submitting: boolean;
  error: string;
  onEmailChange: (v: string) => void;
  onOtpChange: (v: string) => void;
  onSend: () => void;
  onVerify: () => void;
  onBack: () => void;
}) {
  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back
      </button>

      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Mail className="h-5 w-5" />
      </div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
        Verify your email
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Email verification is required to complete your booking. We&apos;ll send a one-time code to confirm it&apos;s you.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="verify-email">Email address</Label>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={otpSent}
          />
        </div>

        {otpSent ? (
          <div>
            <Label htmlFor="verify-code">Verification code</Label>
            <Input
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter code"
              value={otpCode}
              onChange={(e) => onOtpChange(e.target.value)}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        {otpSent ? (
          <Button size="lg" className="w-full" onClick={onVerify} disabled={submitting}>
            {submitting ? "Verifying…" : "Verify & continue booking"}
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={onSend} disabled={submitting || !email.trim()}>
            {submitting ? "Sending…" : "Send verification code"}
          </Button>
        )}
        {otpSent ? (
          <button
            type="button"
            onClick={onSend}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:opacity-50"
          >
            <RefreshCcw className={submitting ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
            Resend code
          </button>
        ) : null}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Verification helps prevent fraudulent bookings.
      </p>
    </div>
  );
}
