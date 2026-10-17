"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { vizClientError, vizFetchJson, vizUploadForm } from "@/lib/visualizer/client-api";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

type MaterialPayload = {
  id: string;
  name: string;
  category: string;
  manufacturer: string | null;
  sku: string | null;
  finish: string | null;
  imageUrl: string;
  imageStoragePath: string;
  imageMimeType: string;
  publicVisible: boolean;
};

export function VisualizerMaterialFormPage({ materialId }: { materialId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(materialId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("WALL_PANEL");
  const [manufacturer, setManufacturer] = useState("");
  const [sku, setSku] = useState("");
  const [finish, setFinish] = useState("");
  const [publicVisible, setPublicVisible] = useState(true);
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [mime, setMime] = useState("image/jpeg");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!materialId) return;
    setLoading(true);
    vizFetchJson<{ material: MaterialPayload }>("material-get", `/api/visualizer/materials/${materialId}`)
      .then((d) => {
        const m = d.material as MaterialPayload;
        setName(m.name);
        setCategory(m.category);
        setManufacturer(m.manufacturer || "");
        setSku(m.sku || "");
        setFinish(m.finish || "");
        setPublicVisible(m.publicVisible);
        setImageStoragePath(m.imageStoragePath);
        setMime(m.imageMimeType || "image/jpeg");
        setPreview(m.imageUrl);
      })
      .catch((e) => {
        vizClientError("material-get:failed", e);
        setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => setLoading(false));
  }, [materialId]);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("assetType", "MATERIAL_REFERENCE");
      const d = await vizUploadForm<{ asset: { storagePath: string; url: string } }>(
        "material-image-upload",
        "/api/visualizer/upload",
        fd,
      );
      setImageStoragePath(d.asset.storagePath);
      setPreview(d.asset.url);
      setMime(file.type || "image/jpeg");
    } catch (e) {
      vizClientError("material-image-upload:failed", e);
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!name.trim() || !imageStoragePath) {
      setError("Name and product photo are required.");
      return;
    }
    setBusy(true);
    const payload = {
      name,
      category,
      manufacturer,
      sku,
      finish,
      imageStoragePath,
      imageMimeType: mime,
      publicVisible,
    };
    try {
      await vizFetchJson(
        isEdit ? "material-patch" : "material-create",
        isEdit ? `/api/visualizer/materials/${materialId}` : "/api/visualizer/materials",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      router.push(VISUALIZER_ROUTES.materials);
    } catch (e) {
      vizClientError("material-save:failed", e);
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading material…</p>;
  }

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{isEdit ? "Edit material" : "Add material"}</h1>
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
        <label className="block text-sm font-medium" htmlFor="mat-mfr">Manufacturer</label>
        <input id="mat-mfr" className="w-full rounded-lg border px-3 py-2 text-sm" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        <label className="block text-sm font-medium" htmlFor="mat-sku">SKU</label>
        <input id="mat-sku" className="w-full rounded-lg border px-3 py-2 text-sm" value={sku} onChange={(e) => setSku(e.target.value)} />
        <label className="block text-sm font-medium" htmlFor="mat-finish">Finish</label>
        <input id="mat-finish" className="w-full rounded-lg border px-3 py-2 text-sm" value={finish} onChange={(e) => setFinish(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publicVisible} onChange={(e) => setPublicVisible(e.target.checked)} />
          Show on public visualizer widget
        </label>
        <label className="block text-sm font-medium">Reference photo</label>
        <p className="text-xs text-muted-foreground">
          Upload the full product sample photo (for example a Long Baths wall-panel sample). Printed labels on the card are
          ignored during generation — only color, veining, and texture are used on shower walls or tub surfaces.
        </p>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-48 rounded-lg object-contain" />
        ) : null}
        <Button onClick={onSave} disabled={busy}>{isEdit ? "Save changes" : "Save material"}</Button>
      </section>
    </div>
  );
}
