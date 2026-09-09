"use client";

import { useEffect, useState } from "react";

export function BookingBrandingSection() {
  const [primaryColor, setPrimaryColor] = useState("#5b4bff");
  const [logoUrl, setLogoUrl] = useState("");
  const [noIndex, setNoIndex] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [serviceLabel, setServiceLabel] = useState("Service");
  const [staffLabel, setStaffLabel] = useState("Staff member");
  const [bookButtonLabel, setBookButtonLabel] = useState("Book now");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/appointments/service-booking/scheduler-theme")
      .then((r) => r.json())
      .then((json) => {
        const extra = json.data || json || {};
        const t = (extra.terminology || {}) as Record<string, string>;
        setPrimaryColor(String(extra.primaryColor || "#5b4bff"));
        setLogoUrl(String(extra.logoUrl || ""));
        setNoIndex(extra.noIndex === true);
        setCustomDomain(String(extra.customDomain || ""));
        setCustomCss(String(extra.customCss || ""));
        setServiceLabel(String(t.serviceLabel || "Service"));
        setStaffLabel(String(t.staffLabel || "Staff member"));
        setBookButtonLabel(String(t.bookButtonLabel || "Book now"));
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/appointments/service-booking/scheduler-theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryColor,
        logoUrl: logoUrl || undefined,
        noIndex,
        customDomain: customDomain.trim() || undefined,
        customCss: customCss.trim() || undefined,
        terminology: {
          serviceLabel: serviceLabel.trim() || undefined,
          staffLabel: staffLabel.trim() || undefined,
          bookButtonLabel: bookButtonLabel.trim() || undefined,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Branding saved");
  }

  return (
    <div className="space-y-6 rounded-xl border bg-white p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[#1a1d29]">Branding</h2>
        <p className="text-[13px] text-[#8a8fa3] mt-1">Logo, colors, terminology, and custom domain for your booking page.</p>
      </div>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="font-semibold text-[#6b6f82]">Primary color</span>
        <input className="rounded-lg border px-3 py-2 max-w-xs" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="font-semibold text-[#6b6f82]">Logo URL</span>
        <input className="rounded-lg border px-3 py-2" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
        Hide booking page from search engines
      </label>

      <div className="border-t pt-4 space-y-3">
        <h3 className="text-[13px] font-semibold text-[#1a1d29]">Terminology</h3>
        <p className="text-[12px] text-[#8a8fa3]">
          Preview: &ldquo;{bookButtonLabel} a {serviceLabel.toLowerCase()} with a {staffLabel.toLowerCase()}&rdquo;
        </p>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#6b6f82]">Service label</span>
          <input className="rounded-lg border px-3 py-2 max-w-sm" value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#6b6f82]">Staff label</span>
          <input className="rounded-lg border px-3 py-2 max-w-sm" value={staffLabel} onChange={(e) => setStaffLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#6b6f82]">Book button label</span>
          <input className="rounded-lg border px-3 py-2 max-w-sm" value={bookButtonLabel} onChange={(e) => setBookButtonLabel(e.target.value)} />
        </label>
      </div>

      <div className="border-t pt-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold text-[#6b6f82]">Custom domain</span>
          <input
            className="rounded-lg border px-3 py-2 max-w-md"
            placeholder="book.example.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <span className="text-[11px] text-[#8a8fa3]">
            Point a CNAME to your Transovo booking host, then save and verify DNS.
          </span>
        </label>
      </div>

      <div className="border-t pt-4">
        <button
          type="button"
          className="text-[13px] font-medium text-[#5b4bff]"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide advanced" : "Advanced customization"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 space-y-2">
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#6b6f82]">Custom CSS</span>
              <textarea
                className="rounded-lg border px-3 py-2 font-mono text-xs min-h-[120px]"
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
              />
            </label>
            <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1">
              Invalid CSS can affect how your booking page appears. Clear the field to reset.
            </p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save branding"}
      </button>
      {message ? <p className="text-[12px] text-[#8a8fa3]">{message}</p> : null}
    </div>
  );
}
