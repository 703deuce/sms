import { useState } from "react";
import { Button, Input, Label } from "./ui";
import { ArrowLeft, MessageSquareText, RefreshCcw, ShieldCheck } from "lucide-react";

export function OtpStep({
  phone,
  onVerified,
  onBack,
}: {
  phone: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(1);

  async function sendOtp() {
    setSending(true);
    setError("");
    // Sandbox: simulate POST /api/public/book/[slug]/otp
    await new Promise((r) => setTimeout(r, 900));
    setSending(false);
    setSentCount((n) => n + 1);
  }

  async function verifyOtp() {
    setError("");
    if (code.replace(/\D/g, "").length < 6) return setError("Enter the 6-digit code from the text message.");
    setVerifying(true);
    // Sandbox: simulate verification round trip
    await new Promise((r) => setTimeout(r, 1100));
    if (code.replace(/\D/g, "") !== "123456") {
      setVerifying(false);
      setError("That code didn't match. Check the latest text and try again — or request a new code.");
      return;
    }
    onVerified();
  }

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Edit details
      </button>

      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessageSquareText className="h-5 w-5" />
      </div>
      <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
        Verify your number
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        We texted a 6-digit code to <span className="font-semibold text-foreground">{phone}</span> to protect your booking. Enter it below to finish.{" "}
        <span className="text-muted-foreground/70">(Sandbox code: 123456)</span>
      </p>

      <div className="mt-5">
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          className="text-center text-[16px] tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      <Button size="lg" className="mt-5 w-full" onClick={verifyOtp} disabled={verifying || sending}>
        {verifying ? "Verifying…" : "Verify & confirm booking"}
      </Button>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
        Didn't get it?
        <button
          type="button"
          onClick={sendOtp}
          disabled={sending || verifying}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
        >
          <RefreshCcw className={sending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {sending ? "Sending…" : sentCount > 1 ? "Resend code" : "Send again"}
        </button>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Verification prevents someone else from booking with your number.
      </p>
    </div>
  );
}
