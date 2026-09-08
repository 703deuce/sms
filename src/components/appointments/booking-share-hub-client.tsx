"use client";

import { useEffect, useMemo, useState } from "react";

function buildEmbedUrl(slug: string, typeId?: string) {
  const params = new URLSearchParams();
  if (typeId) params.set("type", typeId);
  const q = params.toString();
  return `${window.location.origin}/embed/book/${slug}${q ? `?${q}` : ""}`;
}

type BookingTypeRow = { id: string; name: string; slug?: string | null };

export function BookingShareHubClient({
  workspaceSlug,
  workspaceName,
  types,
}: {
  workspaceSlug: string;
  workspaceName: string;
  types: BookingTypeRow[];
}) {
  const [selectedTypeId, setSelectedTypeId] = useState(types[0]?.id || "");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const publicUrl = useMemo(() => {
    const params = selectedTypeId ? `?type=${encodeURIComponent(selectedTypeId)}` : "";
    return `${baseUrl}/book/${workspaceSlug}${params}`;
  }, [baseUrl, selectedTypeId, workspaceSlug]);

  const embedUrl = useMemo(
    () => (baseUrl ? buildEmbedUrl(workspaceSlug, selectedTypeId || undefined) : ""),
    [baseUrl, selectedTypeId, workspaceSlug],
  );
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="720" style="border:0" title="Book with ${workspaceName}"></iframe>`;

  const qrApiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedTypeId) params.set("typeId", selectedTypeId);
    return `/api/appointments/booking/qr?${params.toString()}`;
  }, [selectedTypeId]);

  useEffect(() => {
    if (!selectedTypeId && !workspaceSlug) return;
    void fetch("/api/appointments/booking/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeId: selectedTypeId || undefined }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) setQrDataUrl(json.data?.dataUrl || null);
      })
      .catch(() => setQrDataUrl(null));
  }, [selectedTypeId, workspaceSlug]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `booking-qr-${workspaceSlug}.png`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Share booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy links, embed code, QR codes, and channel-friendly URLs for {workspaceName}.
        </p>
      </header>

      {types.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Booking type</span>
          <select
            className="h-9 rounded-md border px-2"
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
          >
            <option value="">All services (booking page)</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Public booking link</h2>
        <p className="break-all text-sm text-muted-foreground">{publicUrl}</p>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => copy(publicUrl)}
        >
          Copy link
        </button>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">QR code</h2>
        <p className="text-sm text-muted-foreground">
          Print or display this code so customers can scan to book{selectedTypeId ? " this service" : ""}.
        </p>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for booking ${workspaceName}`}
            className="h-48 w-48 rounded border bg-white p-2"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Generating QR code…</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={downloadQr}
            disabled={!qrDataUrl}
          >
            Download QR
          </button>
          <a
            className="rounded-md border px-3 py-1.5 text-sm"
            href={qrApiUrl}
            download={`booking-qr-${workspaceSlug}.png`}
          >
            Open PNG
          </a>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Website embed</h2>
        <pre className="overflow-x-auto rounded bg-muted/40 p-3 text-xs">{embedCode}</pre>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => copy(embedCode)}
        >
          Copy embed code
        </button>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Class enrollment</h2>
        <p className="break-all text-sm text-muted-foreground">
          {baseUrl}/book/{workspaceSlug}/classes
        </p>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => copy(`${baseUrl}/book/${workspaceSlug}/classes`)}
        >
          Copy classes link
        </button>
      </section>
    </div>
  );
}
