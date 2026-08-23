"use client";

import { Button } from "@/components/ui/button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { toSmartRoutingCustomerError } from "@/lib/smart-routing/customer-errors";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

type CallerIdState = {
  status: string;
  publicBusinessE164: string | null;
  method: string | null;
  verifiedAt?: string | null;
};

export function CallerIdVerificationPanel({
  businessNumber,
  callerId,
  onVerified,
}: {
  businessNumber: string;
  callerId: CallerIdState;
  onVerified: () => void;
}) {
  const [method, setMethod] = useState<"sms" | "call">("sms");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const verified = callerId.status === "verified";
  const pending = callerId.status === "pending";

  async function start() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/smart-routing/caller-id-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", phoneE164: businessNumber, method }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(toSmartRoutingCustomerError(json.error || "Verification failed"));
        return;
      }
      setMessage(
        method === "sms"
          ? "We sent a text with your verification code."
          : "You should receive a call with your verification code shortly.",
      );
      onVerified();
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/smart-routing/caller-id-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_code", code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(toSmartRoutingCustomerError(json.error || "Code rejected"));
        return;
      }
      setMessage("Your business number is verified.");
      setCode("");
      onVerified();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4" id="verify-caller-id">
      <div>
        <h2 className="font-medium">Verify business caller ID</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your existing business number so your team can return calls through Transovo while
          customers still see your business number.
        </p>
      </div>

      {verified ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Check className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">Verified</p>
            <p className="text-sm text-emerald-800">
              {fmtPhoneDisplay(callerId.publicBusinessE164 || businessNumber)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Calls returned through Transovo can now display this number.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm">
            Status:{" "}
            <span className="font-semibold capitalize">
              {pending ? "Verification in progress" : "Not verified"}
            </span>
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Verification method</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMethod("sms")}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  method === "sms"
                    ? "border-primary bg-primary/5 font-semibold"
                    : "border-border"
                }`}
              >
                Text me a code
              </button>
              <button
                type="button"
                onClick={() => setMethod("call")}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  method === "call"
                    ? "border-primary bg-primary/5 font-semibold"
                    : "border-border"
                }`}
              >
                Call me with a code
              </button>
            </div>
          </div>

          <Button disabled={loading || !businessNumber.trim()} onClick={() => void start()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify business number
          </Button>

          {(pending || message) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Enter code</p>
              <div className="flex flex-wrap gap-2">
                <input
                  className="h-10 w-36 rounded-lg border px-3 text-center text-lg tracking-widest"
                  placeholder="______"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <Button variant="outline" disabled={loading || !code} onClick={() => void submitCode()}>
                  Verify
                </Button>
                <Button variant="ghost" size="sm" disabled={loading} onClick={() => void start()}>
                  Resend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => setMethod(method === "sms" ? "call" : "sms")}
                >
                  Switch method
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
