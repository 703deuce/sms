"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MASS_TEXT_MMS_ALLOWED_TYPES, MASS_TEXT_MMS_MAX_BYTES } from "@/lib/mass-texting/mms";
import { ImagePlus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type MediaRow = {
  id: string;
  name: string;
  assetType: string;
  storageUrl: string;
};

export default function MediaLibraryPage() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [name, setName] = useState("Promo image");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch("/api/media")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => setRows([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function addUrl() {
    setError(null);
    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, storageUrl: url, assetType: "image" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not add image URL");
      return;
    }
    setUrl("");
    load();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name || file.name);
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Media library"
        description="Upload pictures for MMS campaigns and inbox replies. Carriers fetch these public HTTPS URLs."
      />
      <Card className="mb-6 space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Public URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => void addUrl()}>
              <Plus className="h-4 w-4" /> Add URL
            </Button>
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
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, GIF, or WebP · 1.5 MB max. File upload needs storage configured; a public HTTPS
          URL always works.
        </p>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Preview</TH>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>URL</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.storageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                </TD>
                <TD>{r.name}</TD>
                <TD>{r.assetType}</TD>
                <TD className="max-w-xs truncate text-xs font-mono">{r.storageUrl}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
