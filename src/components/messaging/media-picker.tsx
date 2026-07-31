"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";

type MediaAsset = {
  id: string;
  name: string;
  assetType: string;
  storageUrl: string;
  thumbnailUrl?: string | null;
};

export function MediaPicker({
  open,
  onClose,
  onConfirm,
  initialSelected = [],
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (urls: string[]) => void;
  initialSelected?: string[];
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
    setLoading(true);
    fetch("/api/media")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setAssets(json?.data || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open, initialSelected]);

  if (!open) return null;

  function toggle(url: string) {
    setSelected((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[16px] border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Attach media</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading media…</p>
          ) : assets.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No media in your library. Add assets under Messaging → Media.
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
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm(selected);
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
