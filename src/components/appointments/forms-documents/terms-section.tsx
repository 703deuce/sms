"use client";

import { useEffect, useState } from "react";

export function TermsSection() {
  const [name, setName] = useState("Booking terms");
  const [termsVersion, setTermsVersion] = useState("1");
  const [termsText, setTermsText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || {};
        setTermsVersion(String(data.termsVersion || "1"));
        setTermsText(String(data.termsText || data.termsAcceptanceText || ""));
        if (data.updatedAt) setUpdatedAt(data.updatedAt);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsVersion,
        termsText,
        termsAcceptanceText: termsText,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Terms saved");
    setUpdatedAt(new Date().toISOString());
  }

  const versionLabel = `Version ${termsVersion}`;

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-[#1a1d29]">Require customers to accept booking terms</h3>
        <p className="text-[13px] text-[#8a8fa3] mt-1">
          Customers will be required to accept these terms before completing the booking.
        </p>
      </div>

      {!termsText ? (
        <p className="text-[13px] text-[#8a8fa3] rounded-lg border border-dashed p-6 text-center">
          No terms configured yet. Add content below to require acceptance at booking.
        </p>
      ) : null}

      <div>
        <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="terms-name">Name</label>
        <input
          id="terms-name"
          className="w-full max-w-md rounded-lg border px-3 py-2 text-[13px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="terms-version">
          Current version
        </label>
        <input
          id="terms-version"
          className="w-32 rounded-lg border px-3 py-2 text-[13px]"
          value={termsVersion}
          onChange={(e) => setTermsVersion(e.target.value)}
        />
        <p className="text-[11px] text-[#8a8fa3] mt-1">{versionLabel}{updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleDateString()}` : ""}</p>
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1" htmlFor="terms-body">
          Customer-facing content
        </label>
        <textarea
          id="terms-body"
          className="w-full min-h-[160px] rounded-lg border px-3 py-2 text-[13px]"
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
        />
      </div>
      <button
        type="button"
        disabled={saving}
        className="rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save terms"}
      </button>
      {message ? <p className="text-[12px] text-[#8a8fa3]">{message}</p> : null}
    </div>
  );
}
