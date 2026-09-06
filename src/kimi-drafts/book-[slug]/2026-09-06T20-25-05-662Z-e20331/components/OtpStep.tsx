"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export function OtpStep({
  phone,
  onVerified,
  onBack,
}: {
  phone: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    // POST /api/public/book/{slug}/otp — send
    const t = setTimeout(() => setSent(true), 600);
    return () => clearTimeout(t);
  }, []);

  function setDigit(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    setCode((c) => {
      const next = [...c];
      next[i] = digit;
      return next;
    });
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  }

  async function verify() {
    // POST /api/public/book/{slug}/otp — verify
    setVerifying(true);
    setError("");
    await new Promise((r) => setTimeout(r, 900));
    if (code.join("") === "123456" || code.join("").length === 6) {
      onVerified();
    } else {
      setError("That code didn't match. Check the message and try again.");
    }
    setVerifying(false);
  }

  return (
    <div className="tv-fade-up mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h2 className="font-display text-[17px] font-semibold text-foreground">Verify your number</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {sent ? `We sent a 6-digit code to ${phone}.` : "Sending a verification code…"}
        </p>

        <div className="mt-5 flex justify-center gap-2" role="group" aria-label="Verification code">
          {code.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) inputs.current[i - 1]?.focus();
              }}
              className="h-12 w-10 rounded-lg border border-border bg-card text-center font-display text-[18px] font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          ))}
        </div>

        {error ? <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p> : null}

        <button
          onClick={verify}
          disabled={verifying || code.join("").length < 6}
          className="mt-5 w-full rounded-lg px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {verifying ? "Verifying…" : "Verify & book"}
        </button>
        <div className="mt-3 flex items-center justify-center gap-4 text-[12px]">
          <button onClick={onBack} className="font-medium text-muted-foreground hover:text-foreground">Back</button>
          <button className="font-medium text-primary hover:underline" onClick={() => setSent(true)}>Resend code</button>
        </div>
      </div>
    </div>
  );
}
