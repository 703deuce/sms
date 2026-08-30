"use client";

import { useCallback, useEffect, useState } from "react";

type ReferenceRow = {
  name: string;
  entry: {
    type: "video" | "image";
    storage: string;
    path: string;
    description?: string;
    createdAt: string;
  };
  previewUrl: string | null;
};

export function UiReferencesClient() {
  const [refs, setRefs] = useState<ReferenceRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dev/ui-references");
    if (!res.ok) return;
    const data = (await res.json()) as { references: ReferenceRow[]; configured: boolean };
    setRefs(data.references);
    setConfigured(data.configured);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setLoading(true);
    setStatus("Uploading…");
    const form = new FormData();
    form.set("name", name.trim());
    form.set("description", description.trim());
    form.set("file", file);
    const res = await fetch("/api/dev/ui-references", { method: "POST", body: form });
    setLoading(false);
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      setStatus(err.error || "Upload failed");
      return;
    }
    setStatus(`Uploaded "${name}" — use npm run ui:kimi -- --video ${name.trim()}`);
    setName("");
    setDescription("");
    setFile(null);
    await refresh();
  }

  async function onDelete(refName: string) {
    if (!confirm(`Delete reference "${refName}"?`)) return;
    await fetch(`/api/dev/ui-references?name=${encodeURIComponent(refName)}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">UI Reference Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload videos/images once, name them, then tell Cursor: &quot;Use Kimi with <strong>name</strong> to redo
          /conversations.&quot;
        </p>
        {!configured ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Supabase is not configured — uploads disabled. Use local files:{" "}
            <code>npm run ui:kimi -- --video-file ./ref.mov</code>
          </p>
        ) : null}
      </header>

      <form onSubmit={onUpload} className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Upload reference</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Name (used in CLI)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="slicktext-inbox"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Description (optional)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground hover:bg-muted/40">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <span>
              {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </span>
          ) : (
            <span>Drop video or image here, or click to choose (.mp4 .mov .webm .png .jpg .webp)</span>
          )}
        </label>
        <button
          type="submit"
          disabled={loading || !configured || !file}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Upload
        </button>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </form>

      <section className="space-y-3">
        <h2 className="font-medium">Saved references</h2>
        {refs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No references yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {refs.map((row) => (
              <li key={row.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.entry.type} · {row.entry.storage} · {row.entry.path}
                  </div>
                  {row.entry.description ? <div className="text-sm">{row.entry.description}</div> : null}
                  <code className="text-xs">npm run ui:kimi -- --{row.entry.type === "video" ? "video" : "image"} {row.name}</code>
                </div>
                <div className="flex items-center gap-2">
                  {row.previewUrl && row.entry.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.previewUrl} alt={row.name} className="h-16 w-24 rounded border object-cover" />
                  ) : null}
                  {row.previewUrl && row.entry.type === "video" ? (
                    <video src={row.previewUrl} className="h-16 w-28 rounded border" controls muted />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onDelete(row.name)}
                    className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
