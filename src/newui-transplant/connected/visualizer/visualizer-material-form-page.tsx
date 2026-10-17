"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

export function VisualizerMaterialFormPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("WALL_PANEL");
  const [sku, setSku] = useState("");
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [mime, setMime] = useState("image/jpeg");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("assetType", "MATERIAL_REFERENCE");
    const r = await fetch("/api/visualizer/upload", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Upload failed");
      return;
    }
    setImageStoragePath(d.asset.storagePath);
    setPreview(d.asset.url);
    setMime(file.type || "image/jpeg");
  }

  async function onSave() {
    if (!name.trim() || !imageStoragePath) {
      setError("Name and product photo are required.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/visualizer/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        sku,
        imageStoragePath,
        imageMimeType: mime,
        publicVisible: true,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(d.error || "Save failed");
      return;
    }
    router.push(VISUALIZER_ROUTES.materials);
  }

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Add material</h1>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <section className={OPUS_CARD + " space-y-4 p-6"}>
        <label className="block text-sm font-medium" htmlFor="mat-name">Product name</label>
        <input id="mat-name" className="w-full rounded-lg border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block text-sm font-medium" htmlFor="mat-cat">Category</label>
        <select id="mat-cat" className="w-full rounded-lg border px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="WALL_PANEL">Wall panel</option>
          <option value="SHOWER_BASE">Shower base</option>
          <option value="FIXTURE">Fixture</option>
          <option value="DOOR">Door & enclosure</option>
        </select>
        <label className="block text-sm font-medium" htmlFor="mat-sku">SKU</label>
        <input id="mat-sku" className="w-full rounded-lg border px-3 py-2 text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
        <label className="block text-sm font-medium">Reference photo</label>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-48 rounded-lg object-contain" />
        ) : null}
        <Button onClick={onSave} disabled={busy}>Save material</Button>
      </section>
    </div>
  );
}
