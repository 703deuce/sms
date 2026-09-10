"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_API = "/api/appointments/service-booking/scheduler-theme";

export function BookingBrandingPanel() {
  const [primaryColor, setPrimaryColor] = useState("#5b4bff");
  const [logoUrl, setLogoUrl] = useState("");
  const [noIndex, setNoIndex] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<"not_configured" | "pending" | "connected">("not_configured");
  const [customCss, setCustomCss] = useState("");
  const [serviceLabel, setServiceLabel] = useState("Service");
  const [staffLabel, setStaffLabel] = useState("Staff member");
  const [bookButtonLabel, setBookButtonLabel] = useState("Book now");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(THEME_API);
    if (!res.ok) return;
    const json = await res.json();
    const theme = json.data?.theme || json.theme || {};
    const t = (theme.terminology || {}) as Record<string, string>;
    setPrimaryColor(String(theme.primaryColor || "#5b4bff"));
    setLogoUrl(String(theme.logoUrl || ""));
    setNoIndex(theme.noIndex === true);
    const domain = String(theme.customDomain || "");
    setCustomDomain(domain);
    setDomainStatus(domain ? "pending" : "not_configured");
    setCustomCss(String(theme.customCss || ""));
    setServiceLabel(String(t.serviceLabel || "Service"));
    setStaffLabel(String(t.staffLabel || "Staff member"));
    setBookButtonLabel(String(t.bookButtonLabel || "Book now"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(THEME_API, {
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
    if (customDomain.trim()) setDomainStatus("pending");
    else setDomainStatus("not_configured");
    await load();
  }

  return (
    <div className="booking-card space-y-6">
      <div>
        <h2 className="booking-card-title">Branding</h2>
        <p className="booking-card-desc">Logo, colors, and customer-facing labels on your booking page.</p>
      </div>

      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Primary color</span>
          <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Logo URL</span>
          <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
          Hide booking page from search engines
        </label>
      </div>

      <div className="space-y-3 border-t border-[#eceaf3] pt-4">
        <h3 className="text-[13px] font-semibold">Customer-facing terminology</h3>
        <p className="text-[12px] text-[#8a87a0]">
          Preview: &ldquo;{bookButtonLabel} a {serviceLabel.toLowerCase()} with a {staffLabel.toLowerCase()}&rdquo;
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span>Default: Service</span>
            <input className="input" value={serviceLabel} onChange={(e) => setServiceLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span>Default: Staff</span>
            <input className="input" value={staffLabel} onChange={(e) => setStaffLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span>Book button</span>
            <input className="input" value={bookButtonLabel} onChange={(e) => setBookButtonLabel(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#eceaf3] pt-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Custom domain</span>
          <input
            className="input"
            placeholder="book.example.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
        </label>
        <p className="text-[11px] text-[#8a87a0]">
          Status:{" "}
          {domainStatus === "not_configured"
            ? "Not configured"
            : domainStatus === "pending"
              ? "Pending verification — point CNAME to your Transovo booking host, then save"
              : "Connected"}
        </p>
      </div>

      <div className="border-t border-[#eceaf3] pt-4">
        <button
          type="button"
          className="text-[13px] font-medium text-[#5b4bff] hover:underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide advanced CSS" : "Advanced CSS"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="input font-mono text-[12px] min-h-[100px]"
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder=".booking-header { … }"
            />
            <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1">
              Custom CSS may affect booking-page appearance. Clear to reset.
            </p>
          </div>
        ) : null}
      </div>

      <Button size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save branding"}
      </Button>
      {message ? <p className="text-[12px] text-[#6b6f82]">{message}</p> : null}
    </div>
  );
}
