"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import { cn } from "@/lib/utils";

type Biz = { id: string; name: string };

export function QrClaimClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [token, setToken] = useState("");
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = search.get("claim") ?? search.get("token") ?? "";
    const fromStorage =
      typeof window !== "undefined" ? localStorage.getItem("lse_qr_claim_token") ?? "" : "";
    setToken(fromQuery || fromStorage);
    void fetch("/api/businesses")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.businesses ?? j ?? []) as Biz[];
        setBusinesses(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list[0]?.id) setBusinessId(list[0].id);
      })
      .catch(() => setBusinesses([]));
  }, [search]);

  async function claim() {
    if (!token || !businessId) {
      setError("Select a business and make sure your claim token is present.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/qr/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimToken: token, businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Claim failed");
      localStorage.removeItem("lse_qr_claim_token");
      router.push(json.nextHref || `/businesses/${businessId}/reputation/qr-campaigns`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className={cn(qrUi.cardPad, "overflow-hidden")}>
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
            <QrCode className="h-7 w-7" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#027A48]">
              Claim your QR campaign
            </p>
            <h1 className="mt-1 text-xl font-bold text-[#0B1B32]">
              Save your tracked QR to your account
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              After you create a free QR poster, we save a secure claim token so your tracked link
              and any early scans stay with you after signup.
            </p>
          </div>
        </div>

        {!token ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            No claim token found. Generate a QR on the public tool, then create an account from
            that page.
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_60%)] px-4 py-3 text-sm text-[#027A48]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Claim token ready — choose which business should own this QR campaign.</p>
          </div>
        )}

        <div className="mt-5">
          <label className={qrUi.label}>Business</label>
          <select
            className={cn(qrUi.input, "mt-1.5")}
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          >
            {businesses.length === 0 ? <option value="">No businesses found</option> : null}
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={saving || !token || !businessId}
          className={cn(qrUi.btnPrimary, "mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50")}
          onClick={() => void claim()}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Claim QR campaign
            </>
          )}
        </button>
      </div>
    </div>
  );
}
