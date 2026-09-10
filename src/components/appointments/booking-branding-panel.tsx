"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_API = "/api/appointments/service-booking/scheduler-theme";

export function BookingBrandingPanel() {
  const [primaryColor, setPrimaryColor] = useState("#5b4bff");
  const [logoUrl, setLogoUrl] = useState("");
  const [noIndex, setNoIndex] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<"not_configured" | "pending" | "connected" | "needs_attention">("not_configured");
  const [appointmentLabel, setAppointmentLabel] = useState("Appointment");
  const [serviceLabel, setServiceLabel] = useState("Service");
  const [staffLabel, setStaffLabel] = useState("Staff");
  const [bookButtonLabel, setBookButtonLabel] = useState("Book now");
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
    const verified = theme.customDomainVerified === true;
    setDomainStatus(!domain ? "not_configured" : verified ? "connected" : "pending");
    setAppointmentLabel(String(t.appointmentLabel || "Appointment"));
    setServiceLabel(String(t.serviceLabel || "Service"));
    setStaffLabel(String(t.staffLabel || "Staff"));
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
        terminology: {
          appointmentLabel: appointmentLabel.trim() || undefined,
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
        <p className="booking-card-desc">Customize how your public booking page looks to customers.</p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[13px] font-medium mb-2">Logo</p>
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="" className="h-12 max-w-[160px] object-contain rounded border border-[#eceaf3] bg-white p-2" />
              <div className="flex gap-2">
                <label className="text-[12px] text-[#5b4bff] hover:underline cursor-pointer">
                  Change logo
                  <input type="url" className="sr-only" onChange={(e) => setLogoUrl(e.target.value)} />
                </label>
                <button type="button" className="text-[12px] text-[#6b6880] hover:underline" onClick={() => setLogoUrl("")}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-[#8a87a0]">No logo set</span>
              <input className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://… or paste image URL" />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">Primary color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 rounded border border-[#eceaf3] cursor-pointer"
              value={primaryColor.startsWith("#") ? primaryColor : "#5b4bff"}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
            <input className="input flex-1 font-mono text-[12px]" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </div>
        </label>

        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={noIndex} onChange={(e) => setNoIndex(e.target.checked)} />
          Hide booking page from search engines
        </label>
      </div>

      <div className="space-y-3 border-t border-[#eceaf3] pt-4">
        <h3 className="text-[13px] font-semibold">Terminology</h3>
        <p className="text-[12px] text-[#8a87a0]">Use the words your customers already know.</p>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[#8a87a0] border-b border-[#eceaf3]">
              <th className="py-2 font-medium">System term</th>
              <th className="py-2 font-medium">Customers see</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f1f7]">
            {[
              { system: "Service", value: serviceLabel, set: setServiceLabel },
              { system: "Staff", value: staffLabel, set: setStaffLabel },
              { system: "Appointment", value: appointmentLabel, set: setAppointmentLabel },
            ].map((row) => (
              <tr key={row.system}>
                <td className="py-2 pr-4 text-[#6b6880]">{row.system}</td>
                <td className="py-2">
                  <input className="input w-full" value={row.value} onChange={(e) => row.set(e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rounded-lg bg-[#faf9fc] border border-[#eceaf3] px-3 py-2 text-[12px] text-[#4a4763]">
          <p>&ldquo;Choose a {serviceLabel}&rdquo;</p>
          <p>&ldquo;Select a {staffLabel}&rdquo;</p>
          <p>&ldquo;{bookButtonLabel}&rdquo;</p>
        </div>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-[#6b6880]">Book button label</span>
          <input className="input" value={bookButtonLabel} onChange={(e) => setBookButtonLabel(e.target.value)} />
        </label>
      </div>

      <div className="space-y-3 border-t border-[#eceaf3] pt-4">
        <h3 className="text-[13px] font-semibold">Custom domain</h3>
        {domainStatus === "not_configured" ? (
          <>
            <p className="text-[12px] text-[#8a87a0]">Use your own domain for your booking page.</p>
            <Button size="sm" variant="outline" onClick={() => setCustomDomain("book.example.com")}>Add domain</Button>
          </>
        ) : (
          <>
            <input
              className="input"
              placeholder="book.example.com"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
            />
            <p className="text-[12px] text-[#6b6880]">
              {domainStatus === "connected"
                ? `${customDomain} — Connected`
                : domainStatus === "needs_attention"
                  ? "DNS settings no longer match."
                  : `${customDomain} — Pending verification`}
            </p>
            {domainStatus === "pending" ? (
              <div className="rounded-lg border border-[#eceaf3] p-3 text-[11px] font-mono space-y-1">
                <p className="font-sans text-[12px] font-medium text-[#1a1830] mb-2">Required DNS record</p>
                <p>Type: CNAME · Host: book · Value: booking.transovo.com</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => void save()}>Verify</Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Button size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save branding"}
      </Button>
      {message ? <p className="text-[12px] text-[#6b6f82]">{message}</p> : null}
    </div>
  );
}
