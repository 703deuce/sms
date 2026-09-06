"use client";

import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function OtpStep({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) verify(next.join(""));
  }

  function verify(code: string) {
    setVerifying(true);
    setError("");
    // Sandbox: simulate /api/public/book/[slug]/otp verify; accept any 6 digits
    setTimeout(() => {
      setVerifying(false);
      if (code === "000000") {
        setError("That code didn't match. Check the text message and try again.");
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
      } else {
        onVerified();
      }
    }, 700);
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div className="eb-done__icon" style={{ background: "rgba(47,63,224,0.08)", color: "#2f3fe0" }}>
        <ShieldCheck size={26} aria-hidden />
      </div>
      <h1 className="eb-done__title">Verify your number</h1>
      <p className="eb-done__sub">
        We sent a 6-digit code to <strong>{phone || "your phone"}</strong>. Enter it below to
        confirm your appointment.
      </p>
      <div className="eb-otp-row" role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="eb-otp-cell"
            inputMode="numeric"
            aria-label={`Digit ${i + 1}`}
            value={d}
            disabled={verifying}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
          />
        ))}
      </div>
      {error ? (
        <p className="eb-field__err" style={{ justifyContent: "center" }} role="alert">
          {error}
        </p>
      ) : null}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
        Didn't get a code?{" "}
        <button
          type="button"
          className="eb-btn eb-btn--ghost eb-btn--sm"
          onClick={() => setDigits(["", "", "", "", "", ""])}
        >
          Resend
        </button>
      </p>
    </div>
  );
}
