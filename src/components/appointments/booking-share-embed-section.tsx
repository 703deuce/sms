"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
function directLinks(
  baseUrl: string,
  workspaceSlug: string,
  input?: { typeId?: string },
) {
  const root = `${baseUrl.replace(/\/$/, "")}/book/${workspaceSlug}`;
  return {
    bookingPage: root,
    bookingType: input?.typeId ? `${root}/${input.typeId}` : undefined,
  };
}

type BookingTypeRow = { id: string; name: string; bookingTypeKind?: string };
type CategoryRow = { id: string; name: string; slug: string };

type SingleUseLink = {
  id: string;
  token: string;
  appointmentTypeId: string;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
  revokedAt?: string;
  createdAt?: string;
};

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  types: BookingTypeRow[];
};

function linkStatus(link: SingleUseLink): string {
  if (link.revokedAt) return "Revoked";
  if (link.usedCount >= link.maxUses) return "Used";
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return "Expired";
  return "Available";
}

export function BookingShareEmbedSection({ workspaceSlug, workspaceName, types }: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [_categories, setCategories] = useState<CategoryRow[]>([]);
  const [embedUrl, setEmbedUrl] = useState("");
  const [popupScript, setPopupScript] = useState("");
  const [singleUseLinks, setSingleUseLinks] = useState<SingleUseLink[]>([]);
  const [createTypeId, setCreateTypeId] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<"never" | "24h" | "7d" | "custom">("7d");
  const [customExpiry, setCustomExpiry] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDestType, setQrDestType] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const meetings = types.filter((t) => t.bookingTypeKind === "MEETING" || !t.bookingTypeKind);
  const services = types.filter((t) => t.bookingTypeKind === "SERVICE");
  const classes = types.filter((t) => t.bookingTypeKind === "CLASS");

  const load = useCallback(async () => {
    const [linksRes, catRes] = await Promise.all([
      fetch("/api/appointments/booking-links"),
      fetch("/api/appointments/service-booking/categories"),
    ]);
    if (linksRes.ok) {
      const json = await linksRes.json();
      setEmbedUrl(json.data?.embedUrl || "");
      setPopupScript(json.data?.popupScript || "");
      setSingleUseLinks(json.data?.links || []);
    }
    if (catRes.ok) {
      const json = await catRes.json();
      setCategories(json.data || []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (types[0]?.id && !createTypeId) setCreateTypeId(types[0].id);
  }, [types, createTypeId]);

  const links = useMemo(() => {
    if (!origin || !workspaceSlug) return null;
    return directLinks(origin, workspaceSlug, {
      typeId: selectedTypeId || undefined,
    });
  }, [origin, workspaceSlug, selectedTypeId]);

  const publicUrl = links?.bookingType || links?.bookingPage || `${origin}/book/${workspaceSlug}`;
  const embedIframe = embedUrl
    ? `<iframe src="${embedUrl}${selectedTypeId ? (embedUrl.includes("?") ? "&" : "?") + `type=${selectedTypeId}` : ""}" width="100%" height="720" frameborder="0" title="Book with ${workspaceName}"></iframe>`
    : "";

  function copyText(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function expiryDate(): string | undefined {
    if (expiryPreset === "never") return undefined;
    const now = Date.now();
    if (expiryPreset === "24h") return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (expiryPreset === "7d") return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (expiryPreset === "custom" && customExpiry) return new Date(customExpiry).toISOString();
    return undefined;
  }

  async function createSingleUse() {
    if (!createTypeId) return;
    await fetch("/api/appointments/booking-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId: createTypeId,
        maxUses: 1,
        expiresAt: expiryDate(),
      }),
    });
    await load();
  }

  async function revokeLink(linkId: string) {
    await fetch(`/api/appointments/booking-links?id=${encodeURIComponent(linkId)}`, { method: "DELETE" });
    await load();
  }

  function DirectLinkGroup({
    title,
    items,
  }: {
    title: string;
    items: BookingTypeRow[];
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[#6b6880]">{title}</p>
        <ul className="space-y-2">
          {items.map((t) => {
            const url = `${origin}/book/${workspaceSlug}/${t.id}`;
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eceaf3] px-3 py-2 text-[12px]">
                <span className="font-medium">{t.name}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => copyText(url, t.id)}>
                    <Copy size={14} /> {copied === t.id ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Preview
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="booking-card space-y-6">
      <div>
        <h2 className="booking-card-title">Share & embed</h2>
        <p className="booking-card-desc">Links, QR codes, embed snippets, and one-time booking URLs.</p>
      </div>

      <div className="space-y-3">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">QR & embed destination</span>
          <select className="input" value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)}>
            <option value="">Main booking page</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>

        <div className="rounded-lg border border-[#eceaf3] p-4 space-y-2">
          <p className="text-[12px] font-medium">Public page link</p>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1 text-[12px]" readOnly value={publicUrl} />
            <Button size="sm" variant="outline" onClick={() => copyText(publicUrl, "main")}>
              {copied === "main" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-[#eceaf3] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium flex items-center gap-1">
              <QrCode size={14} /> QR code
            </p>
            <p className="text-[11px] text-[#8a87a0] mt-1">Create a QR code for your main page or a specific booking type.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setQrDestType(selectedTypeId); setQrModalOpen(true); }}>
            Create QR code
          </Button>
        </div>

        <div className="rounded-lg border border-[#eceaf3] p-4 space-y-2">
          <p className="text-[12px] font-medium">Website embed</p>
          <textarea className="input font-mono text-[11px] min-h-[72px]" readOnly value={embedIframe} />
          <Button size="sm" variant="outline" onClick={() => copyText(embedIframe, "embed")}>
            {copied === "embed" ? "Copied" : "Copy embed code"}
          </Button>
        </div>

        {popupScript ? (
          <div className="rounded-lg border border-[#eceaf3] p-4 space-y-2">
            <p className="text-[12px] font-medium">Popup opener</p>
            <textarea className="input font-mono text-[11px] min-h-[48px]" readOnly value={popupScript} />
            <Button size="sm" variant="outline" onClick={() => copyText(popupScript, "popup")}>
              {copied === "popup" ? "Copied" : "Copy script"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#eceaf3] pt-4 space-y-4">
        <h3 className="text-[13px] font-semibold">Direct booking links</h3>
        <DirectLinkGroup title="Meetings" items={meetings} />
        <DirectLinkGroup title="Services" items={services} />
        <DirectLinkGroup title="Classes & workshops" items={classes} />
      </div>

      <div className="border-t border-[#eceaf3] pt-4 space-y-3">
        <h3 className="text-[13px] font-semibold">Single-use links</h3>
        <p className="text-[12px] text-[#8a87a0]">One-time URLs for a specific booking type.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-[12px]">
            Booking destination
            <select className="input" value={createTypeId} onChange={(e) => setCreateTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <fieldset className="text-[12px]">
            <legend className="mb-1">Expires</legend>
            <div className="flex flex-wrap gap-2">
              {(["never", "24h", "7d", "custom"] as const).map((p) => (
                <label key={p} className="flex items-center gap-1">
                  <input type="radio" name="expiry" checked={expiryPreset === p} onChange={() => setExpiryPreset(p)} />
                  {p === "never" ? "Never" : p === "24h" ? "24 hours" : p === "7d" ? "7 days" : "Custom"}
                </label>
              ))}
            </div>
            {expiryPreset === "custom" ? (
              <input type="datetime-local" className="input mt-2" value={customExpiry} onChange={(e) => setCustomExpiry(e.target.value)} />
            ) : null}
          </fieldset>
          <Button size="sm" onClick={() => void createSingleUse()}>Create single-use link</Button>
        </div>
        {singleUseLinks.length > 0 ? (
          <ul className="space-y-2">
            {singleUseLinks.map((link) => {
              const typeName = types.find((t) => t.id === link.appointmentTypeId)?.name || "Booking type";
              const url = `${origin}/book/${workspaceSlug}?singleUse=${link.token}`;
              const status = linkStatus(link);
              return (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px]">
                  <span>
                    {typeName}
                    {link.createdAt ? ` · ${new Date(link.createdAt).toLocaleDateString()}` : ""}
                    {link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleDateString()}` : ""}
                    {" · "}
                    <span className="text-[#8a87a0]">{status}</span>
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyText(url, link.id)}>
                      Copy
                    </Button>
                    {status === "Available" ? (
                      <Button size="sm" variant="ghost" onClick={() => void revokeLink(link.id)}>
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-[#8a87a0]">No single-use links yet.</p>
        )}
      </div>
      {qrModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setQrModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <h3 id="qr-modal-title" className="text-[15px] font-bold">Create QR code</h3>
            <label className="flex flex-col gap-1 text-[13px]">
              <span>Destination</span>
              <select className="input" value={qrDestType} onChange={(e) => setQrDestType(e.target.value)}>
                <option value="">Main booking page</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            {!qrError ? (
              <img
                src={`/api/appointments/booking/qr?${qrDestType ? `typeId=${qrDestType}` : ""}`}
                alt={`QR code for ${workspaceName}`}
                className="h-40 w-40 mx-auto border rounded"
                onError={() => setQrError(true)}
              />
            ) : (
              <p className="text-[12px] text-center text-[#8a87a0]">Could not load QR preview.</p>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => copyText(qrDestType ? `${origin}/book/${workspaceSlug}/${qrDestType}` : `${origin}/book/${workspaceSlug}`, "qr-link")}>
                Copy link
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/appointments/booking/qr?${qrDestType ? `typeId=${qrDestType}` : ""}`} download={`booking-qr-${workspaceSlug}.png`}>
                  Download
                </a>
              </Button>
              <Button size="sm" onClick={() => setQrModalOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
