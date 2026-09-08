"use client";

import { useMemo, useState } from "react";

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

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Share booking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy links, embed code, and QR-friendly URLs for {workspaceName}.
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
