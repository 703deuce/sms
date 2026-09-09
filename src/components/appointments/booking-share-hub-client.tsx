"use client";

import { useEffect, useMemo, useState } from "react";

function directLinks(
  baseUrl: string,
  workspaceSlug: string,
  input?: { categorySlug?: string; typeId?: string; staffId?: string; locationId?: string },
) {
  const root = `${baseUrl.replace(/\/$/, "")}/book/${workspaceSlug}`;
  return {
    bookingPage: root,
    category: input?.categorySlug ? `${root}?category=${input.categorySlug}` : undefined,
    bookingType: input?.typeId ? `${root}/${input.typeId}` : undefined,
    provider: input?.staffId ? `${root}?staff=${input.staffId}` : undefined,
    location: input?.locationId ? `${root}?location=${input.locationId}` : undefined,
  };
}

function buildEmbedUrl(slug: string, typeId?: string) {
  const params = new URLSearchParams();
  if (typeId) params.set("type", typeId);
  const q = params.toString();
  return `${window.location.origin}/embed/book/${slug}${q ? `?${q}` : ""}`;
}

type BookingTypeRow = { id: string; name: string; slug?: string | null };
type CategoryRow = { id: string; name: string; slug: string };
type StaffRow = { id: string; name: string };
type LocationRow = { id: string; name: string };

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
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [qrLoadError, setQrLoadError] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    void fetch("/api/appointments/service-booking/categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data || []))
      .catch(() => setCategories([]));
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || json;
        setStaff((data.staff || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
        setLocations(
          (data.locations || []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })),
        );
      })
      .catch(() => {
        setStaff([]);
        setLocations([]);
      });
  }, []);

  const deepLinks = useMemo(() => {
    if (!baseUrl || !workspaceSlug) return null;
    return directLinks(baseUrl, workspaceSlug, {
      categorySlug: selectedCategorySlug || undefined,
      typeId: selectedTypeId || undefined,
      staffId: selectedStaffId || undefined,
      locationId: selectedLocationId || undefined,
    });
  }, [baseUrl, workspaceSlug, selectedCategorySlug, selectedTypeId, selectedStaffId, selectedLocationId]);

  const publicUrl = deepLinks?.bookingType || deepLinks?.bookingPage || `${baseUrl}/book/${workspaceSlug}`;

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
    setQrLoadError(false);
  }, [qrApiUrl]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
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

      <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
        {categories.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Category deep link</span>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedCategorySlug}
              onChange={(e) => setSelectedCategorySlug(e.target.value)}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {staff.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Staff deep link</span>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">None</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {locations.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Location deep link</span>
            <select
              className="h-9 rounded-md border px-2"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

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
        {deepLinks?.category ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium">Category URL</p>
            <p className="break-all text-muted-foreground">{deepLinks.category}</p>
            <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => copy(deepLinks.category!)}>
              Copy category link
            </button>
          </div>
        ) : null}
        {deepLinks?.provider ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium">Staff URL</p>
            <p className="break-all text-muted-foreground">{deepLinks.provider}</p>
            <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => copy(deepLinks.provider!)}>
              Copy staff link
            </button>
          </div>
        ) : null}
        {deepLinks?.location ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-medium">Location URL</p>
            <p className="break-all text-muted-foreground">{deepLinks.location}</p>
            <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => copy(deepLinks.location!)}>
              Copy location link
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">QR code</h2>
        <p className="text-sm text-muted-foreground">
          Print or display this code so customers can scan to book{selectedTypeId ? " this service" : ""}.
        </p>
        {qrLoadError ? (
          <p className="text-sm text-destructive">Could not load QR code. Use Open PNG below.</p>
        ) : (
          <img
            src={qrApiUrl}
            alt={`QR code for booking ${workspaceName}`}
            className="h-48 w-48 rounded border bg-white p-2"
            onError={() => setQrLoadError(true)}
            onLoad={() => setQrLoadError(false)}
          />
        )}
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded-md border px-3 py-1.5 text-sm"
            href={qrApiUrl}
            download={`booking-qr-${workspaceSlug}.png`}
          >
            Download QR
          </a>
          <a
            className="rounded-md border px-3 py-1.5 text-sm"
            href={qrApiUrl}
            target="_blank"
            rel="noreferrer"
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
