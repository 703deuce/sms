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
};

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  types: BookingTypeRow[];
};

function linkStatus(link: SingleUseLink): string {
  if (link.usedCount >= link.maxUses) return "Used";
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return "Expired";
  return "Available";
}

export function BookingShareEmbedSection({ workspaceSlug, workspaceName, types }: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [embedUrl, setEmbedUrl] = useState("");
  const [popupScript, setPopupScript] = useState("");
  const [singleUseLinks, setSingleUseLinks] = useState<SingleUseLink[]>([]);
  const [createTypeId, setCreateTypeId] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

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

  const qrUrl = `/api/appointments/booking/qr?${selectedTypeId ? `typeId=${selectedTypeId}` : ""}`;

  function copyText(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function createSingleUse() {
    if (!createTypeId) return;
    await fetch("/api/appointments/booking-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentTypeId: createTypeId, maxUses: 1 }),
    });
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

        <div className="rounded-lg border border-[#eceaf3] p-4">
          <p className="text-[12px] font-medium flex items-center gap-1 mb-2">
            <QrCode size={14} /> QR code
          </p>
          {!qrError ? (
            <img
              src={qrUrl}
              alt={`QR code for ${workspaceName} booking`}
              className="h-32 w-32 border rounded"
              onError={() => setQrError(true)}
            />
          ) : (
            <p className="text-[12px] text-[#8a87a0]">Could not load QR preview.</p>
          )}
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <a href={qrUrl} download={`booking-qr-${workspaceSlug}.png`}>Download QR</a>
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
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-[12px]">
            Booking type
            <select className="input" value={createTypeId} onChange={(e) => setCreateTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <Button size="sm" onClick={() => void createSingleUse()}>Create link</Button>
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
                    {typeName} · <span className="text-[#8a87a0]">{status}</span>
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyText(url, link.id)}>
                      Copy
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-[#8a87a0]">No single-use links yet.</p>
        )}
      </div>
    </div>
  );
}
