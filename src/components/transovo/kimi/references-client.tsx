"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KIMI_API_REFERENCES,
  KIMI_API_REFERENCES_COMPLETE,
  KIMI_API_REFERENCES_PREPARE,
} from "@/lib/ui-agent/kimi-routes";
import {
  KIMI_MAX_IMAGE_BYTES,
  KIMI_MAX_VIDEO_BYTES,
  kimiEstimateUploadSeconds,
  kimiFormatBytes,
  kimiMaxBytesForMime,
} from "@/lib/ui-agent/reference-limits";
import { uploadReferenceWithProgress } from "@/lib/ui-agent/reference-upload-client";

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

type UploadPhase = "idle" | "preparing" | "uploading" | "saving" | "done" | "error";

export function KimiReferencesClient() {
  const [refs, setRefs] = useState<ReferenceRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<number | null>(null);

  const loading = phase === "preparing" || phase === "uploading" || phase === "saving";

  const refresh = useCallback(async () => {
    const res = await fetch(KIMI_API_REFERENCES);
    if (!res.ok) return;
    const data = (await res.json()) as { references: ReferenceRow[]; configured: boolean };
    setRefs(data.references);
    setConfigured(data.configured);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function startElapsedTimer() {
    setElapsedSec(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setElapsedSec((value) => value + 1);
    }, 1000);
  }

  function stopElapsedTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function validateFile(selected: File): string | null {
    const mime = selected.type || "";
    const kind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : null;
    if (!kind) {
      return "Choose a video (.mp4, .mov, .webm) or image (.png, .jpg, .webp).";
    }
    const max = kimiMaxBytesForMime(mime);
    if (selected.size > max) {
      return `File is too large (${kimiFormatBytes(selected.size)}). Max ${kind === "video" ? "100 MB" : "20 MB"}.`;
    }
    return null;
  }

  function onFileSelected(next: File | null) {
    setFile(next);
    setError("");
    setStatus("");
    setPhase("idle");
    if (!next) return;
    const validationError = validateFile(next);
    if (validationError) {
      setError(validationError);
      setFile(null);
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || loading) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const mime = file.type || "application/octet-stream";
    const kind = mime.startsWith("video/") ? "video" : "image";
    const estimateSec = kimiEstimateUploadSeconds(file.size);

    setError("");
    setProgress(0);
    setPhase("preparing");
    setStatus(`Preparing upload for ${kimiFormatBytes(file.size)}…`);
    startElapsedTimer();

    try {
      const prepareRes = await fetch(KIMI_API_REFERENCES_PREPARE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mimeType: mime,
          size: file.size,
          filename: file.name,
        }),
      });

      const prepareBody = (await prepareRes.json()) as {
        error?: string;
        bucket?: string;
        path?: string;
        token?: string;
        supabaseUrl?: string;
        kind?: "video" | "image";
      };

      if (!prepareRes.ok) {
        throw new Error(prepareBody.error || "Could not prepare upload.");
      }

      if (!prepareBody.bucket || !prepareBody.path || !prepareBody.token || !prepareBody.supabaseUrl) {
        throw new Error("Upload preparation returned incomplete data.");
      }

      setPhase("uploading");
      setStatus(
        `Uploading ${kimiFormatBytes(file.size)} directly to storage… usually ${estimateSec < 60 ? `${estimateSec}s` : `${Math.ceil(estimateSec / 60)} min`} on a typical connection.`,
      );

      await uploadReferenceWithProgress({
        supabaseUrl: prepareBody.supabaseUrl,
        bucket: prepareBody.bucket,
        path: prepareBody.path,
        token: prepareBody.token,
        file,
        onProgress: setProgress,
      });

      setPhase("saving");
      setStatus("Saving reference…");
      setProgress(100);

      const completeRes = await fetch(KIMI_API_REFERENCES_COMPLETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          bucket: prepareBody.bucket,
          path: prepareBody.path,
          kind: prepareBody.kind || kind,
        }),
      });

      const completeBody = (await completeRes.json()) as { error?: string };
      if (!completeRes.ok) {
        throw new Error(completeBody.error || "Upload finished but saving the reference failed.");
      }

      setPhase("done");
      setStatus(`Uploaded "${name.trim()}" — tell Cursor: Use Kimi with ${name.trim()}`);
      setName("");
      setDescription("");
      setFile(null);
      await refresh();
    } catch (uploadError) {
      setPhase("error");
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
      setStatus("");
    } finally {
      stopElapsedTimer();
    }
  }

  async function onDelete(refName: string) {
    if (!confirm(`Delete reference "${refName}"?`)) return;
    await fetch(`${KIMI_API_REFERENCES}?name=${encodeURIComponent(refName)}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Kimi Reference Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload videos/images once, name them, then tell Cursor: &quot;Use Kimi with <strong>name</strong> to redo
          /conversations.&quot;
        </p>
        <p className="text-xs text-muted-foreground">
          Limits: videos up to {kimiFormatBytes(KIMI_MAX_VIDEO_BYTES)}, images up to {kimiFormatBytes(KIMI_MAX_IMAGE_BYTES)}.
          Large videos upload directly to storage (not through the app server).
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
            <span>Name (used when talking to Cursor)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder="slicktext-inbox"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Description (optional)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground hover:bg-muted/40">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={loading}
            onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
          />
          {file ? (
            <span>
              {file.name} ({kimiFormatBytes(file.size)})
            </span>
          ) : (
            <span>Drop video or image here, or click to choose (.mp4 .mov .webm .png .jpg .webp)</span>
          )}
        </label>
        <button
          type="submit"
          disabled={loading || !configured || !file || Boolean(error)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Uploading…" : "Upload"}
        </button>

        {loading ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{status}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{elapsedSec}s elapsed</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(progress, phase === "preparing" ? 8 : phase === "saving" ? 98 : progress)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {phase === "preparing"
                ? "Getting a secure upload slot…"
                : phase === "uploading"
                  ? progress > 0
                    ? `${progress}% uploaded`
                    : "Starting upload…"
                  : "Registering your reference…"}
            </p>
          </div>
        ) : null}

        {!loading && status ? <p className="text-sm text-green-700 dark:text-green-400">{status}</p> : null}
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
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
                  <code className="text-xs">Tell Cursor: Use Kimi with {row.name} on /your-route</code>
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
