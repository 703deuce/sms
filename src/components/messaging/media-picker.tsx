"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MASS_TEXT_MMS_ALLOWED_TYPES,
  MASS_TEXT_MMS_MAX_ATTACHMENTS,
  MASS_TEXT_MMS_MAX_BYTES,
} from "@/lib/mass-texting/mms";
import { Check, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type MediaAsset = {
  id: string;
  name: string;
  assetType: string;
  storageUrl: string;
  thumbnailUrl?: string | null;
};

export function AttachedMediaThumbs({
  urls,
  onRemove,
}: {
  urls: string[];
  onRemove?: (url: string) => void;
}) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url) => (
        <span key={url} className="relative inline-flex overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-16 w-16 object-cover" />
          {onRemove ? (
            <button
              type="button"
              className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
              aria-label="Remove picture"
              onClick={() => onRemove(url)}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function MediaPicker({
  open,
  onClose,
  onConfirm,
  initialSelected = [],
  maxSelected = MASS_TEXT_MMS_MAX_ATTACHMENTS,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (urls: string[]) => void;
  initialSelected?: string[];
  maxSelected?: number;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [uploading, setUploading] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected.slice(0, maxSelected));
    setError(null);
    setPasteUrl("");
    setLoading(true);
    fetch("/api/media")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setAssets(json?.data || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open, initialSelected, maxSelected]);

  if (!open) return null;

  function toggle(url: string) {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= maxSelected) {
        setError(`You can attach up to ${maxSelected} pictures.`);
        return prev;
      }
      setError(null);
      return [...prev, url];
    });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      const row = json.data as MediaAsset;
      setAssets((prev) => [row, ...prev.filter((a) => a.id !== row.id)]);
      setSelected((prev) => {
        if (prev.includes(row.storageUrl)) return prev;
        if (prev.length >= maxSelected) return prev;
        return [...prev, row.storageUrl];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function addPastedUrl() {
    const url = pasteUrl.trim();
    if (!url) return;
    setError(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: url.split("/").pop() || "MMS image",
          storageUrl: url,
          assetType: "image",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add URL");
      const row = json.data as MediaAsset;
      setAssets((prev) => [row, ...prev.filter((a) => a.id !== row.id)]);
      setSelected((prev) => {
        if (prev.includes(row.storageUrl)) return prev;
        if (prev.length >= maxSelected) return prev;
        return [...prev, row.storageUrl];
      });
      setPasteUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add URL");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[16px] border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Attach pictures</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 border-b border-border px-4 py-3">
          <input
            ref={fileRef}
            type="file"
            accept={MASS_TEXT_MMS_ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > MASS_TEXT_MMS_MAX_BYTES) {
                setError("Images must be 1.5 MB or smaller for MMS.");
                return;
              }
              void uploadFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || selected.length >= maxSelected}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload a picture"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG, GIF, or WebP · 1.5 MB max · up to {maxSelected} pictures · 3 credits each
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="Or paste a public HTTPS image URL"
              className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void addPastedUrl()}>
              Add URL
            </Button>
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
        <div className="max-h-[360px] overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading media…</p>
          ) : assets.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No pictures yet. Upload a file or paste a public image URL.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {assets.map((asset) => {
                const active = selected.includes(asset.storageUrl);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => toggle(asset.storageUrl)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition",
                        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card",
                        )}
                      >
                        {active ? <Check className="h-3 w-3" /> : null}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.thumbnailUrl || asset.storageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{asset.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {asset.assetType}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm(selected.slice(0, maxSelected));
              onClose();
            }}
          >
            Attach {selected.length ? `(${selected.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
