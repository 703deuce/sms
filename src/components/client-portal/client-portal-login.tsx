"use client";

import { useState } from "react";
import "@/components/client-portal/client-portal.css";

export function ClientPortalLogin({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/client/portal/auth/login/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error || "Could not send code");
      return;
    }
    setOtpSent(true);
    setMessage(json.data?.message || "Check your email for a sign-in code.");
  }

  async function verify() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/client/portal/auth/login/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "verify", email, code }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error || "Invalid code");
      return;
    }
    if (json.data?.ok) {
      window.location.href = "/client";
      return;
    }
    setMessage(json.data?.message || "Signed in.");
  }

  return (
    <div className="client-portal-root">
      <main className="client-portal-main">
        <h1 className="text-2xl font-semibold">Your account</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--cp-muted)" }}>
          Enter your email. We&apos;ll send a one-time code to sign in securely.
        </p>
        <div className="client-portal-card mt-6 space-y-4">
          <label className="block text-sm">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2.5"
              style={{ borderColor: "var(--cp-border)" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {otpSent && (
            <label className="block text-sm">
              Sign-in code
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
                style={{ borderColor: "var(--cp-border)" }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {!otpSent ? (
              <button
                type="button"
                className="client-portal-btn client-portal-btn-primary"
                disabled={loading || !email.trim()}
                onClick={() => void sendCode()}
              >
                {loading ? "Sending…" : "Email me a code"}
              </button>
            ) : (
              <button
                type="button"
                className="client-portal-btn client-portal-btn-primary"
                disabled={loading || !code.trim()}
                onClick={() => void verify()}
              >
                {loading ? "Signing in…" : "Continue"}
              </button>
            )}
          </div>
          {message && <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{message}</p>}
        </div>
      </main>
    </div>
  );
}
