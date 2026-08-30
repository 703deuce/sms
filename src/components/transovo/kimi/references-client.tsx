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
  kimiFormatBytes,
  kimiFormatMime,
  kimiMaxBytesForMime,
} from "@/lib/ui-agent/reference-limits";
import {
  ReferenceUploadAbortedError,
  ReferenceUploadStalledError,
  uploadReferenceWithProgress,
  type ReferenceUploadProgress,
} from "@/lib/ui-agent/reference-upload-client";

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

type UploadPhase =
  | "idle"
  | "preparing"
  | "uploading"
  | "processing"
  | "complete"
  | "stalled"
  | "error";

type PreparedUpload = {
  uploadId: string;
  bucket: string;
  path: string;
  token: string;
  supabaseUrl: string;
  kind: "video" | "image";
  mimeType: string;
  size: number;
  filename: string | null;
};

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
  return `~${Math.ceil(seconds / 60)}m remaining`;
}

export function KimiReferencesClient() {
  const [refs, setRefs] = useState<ReferenceRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ReferenceUploadProgress>({ loaded: 0, total: 0, percent: 0 });
  const [eta, setEta] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completedName, setCompletedName] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const preparedRef = useRef<PreparedUpload | null>(null);
  const uploadedRef = useRef(false);
  const uploadMetaRef = useRef<{ name: string; description: string; file: File } | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);

  const loading = phase === "preparing" || phase === "uploading" || phase === "processing";

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
      abortRef.current?.abort();
      if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    };
  }, []);

  function startElapsedTimer() {
    setElapsedSec(0);
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = window.setInterval(() => {
      setElapsedSec((value) => value + 1);
    }, 1000);
  }

  function stopElapsedTimer() {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  function resetUploadUi() {
    abortRef.current?.abort();
    abortRef.current = null;
    preparedRef.current = null;
    uploadedRef.current = false;
    uploadMetaRef.current = null;
    setPhase("idle");
    setError("");
    setProgress({ loaded: 0, total: 0, percent: 0 });
    setEta("");
    setElapsedSec(0);
    setCompletedName("");
    stopElapsedTimer();
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
    resetUploadUi();
    setFile(next);
    if (!next) return;
    const validationError = validateFile(next);
    if (validationError) {
      setError(validationError);
      setPhase("error");
      setFile(null);
    }
  }

  function updateEta(next: ReferenceUploadProgress, startedAt: number) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < 1000 || next.loaded <= 0 || next.total <= 0) {
      setEta("");
      return;
    }
    const bytesPerMs = next.loaded / elapsedMs;
    if (bytesPerMs <= 0) return;
    const remainingSec = (next.total - next.loaded) / bytesPerMs / 1000;
    setEta(formatEta(remainingSec));
  }

  async function prepareUpload(meta: { name: string; description: string; file: File }): Promise<PreparedUpload> {
    const mime = meta.file.type || "application/octet-stream";
    const prepareRes = await fetch(KIMI_API_REFERENCES_PREPARE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: meta.name,
        mimeType: mime,
        size: meta.file.size,
        filename: meta.file.name,
      }),
      signal: abortRef.current?.signal,
    });

    const prepareBody = (await prepareRes.json()) as PreparedUpload & { error?: string };
    if (!prepareRes.ok) {
      throw new Error(prepareBody.error || "Could not prepare upload.");
    }
    if (!prepareBody.bucket || !prepareBody.path || !prepareBody.token || !prepareBody.supabaseUrl || !prepareBody.uploadId) {
      throw new Error("Upload preparation returned incomplete data.");
    }
    return prepareBody;
  }

  async function completeUpload(prepared: PreparedUpload, meta: { name: string; description: string; file: File }) {
    const completeRes = await fetch(KIMI_API_REFERENCES_COMPLETE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: prepared.uploadId,
        name: meta.name,
        description: meta.description,
        bucket: prepared.bucket,
        path: prepared.path,
        kind: prepared.kind,
        mimeType: prepared.mimeType || meta.file.type,
        size: meta.file.size,
        filename: meta.file.name,
      }),
      signal: abortRef.current?.signal,
    });

    const completeBody = (await completeRes.json()) as { error?: string; code?: string };
    if (!completeRes.ok) {
      throw new Error(completeBody.error || "Upload finished but saving the reference failed.");
    }
  }

  async function runUpload(meta: { name: string; description: string; file: File }, options?: { skipPrepare?: boolean }) {
    setError("");
    setProgress({ loaded: 0, total: meta.file.size, percent: 0 });
    setEta("");
    uploadMetaRef.current = meta;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    startElapsedTimer();

    try {
      let prepared = preparedRef.current;
      if (!options?.skipPrepare || !prepared || !uploadedRef.current) {
        uploadedRef.current = false;
        setPhase("preparing");
        prepared = await prepareUpload(meta);
        preparedRef.current = prepared;
      }

      if (!uploadedRef.current) {
        setPhase("uploading");
        const startedAt = Date.now();

        await uploadReferenceWithProgress({
          supabaseUrl: prepared.supabaseUrl,
          bucket: prepared.bucket,
          path: prepared.path,
          token: prepared.token,
          file: meta.file,
          signal: abortRef.current.signal,
          onProgress: (next) => {
            setProgress(next);
            updateEta(next, startedAt);
          },
          onStall: () => setPhase("stalled"),
        });

        uploadedRef.current = true;
      }

      setPhase("processing");
      setEta("");
      await completeUpload(prepared, meta);

      setPhase("complete");
      setCompletedName(meta.name);
      setProgress({ loaded: meta.file.size, total: meta.file.size, percent: 100 });
      setName("");
      setDescription("");
      setFile(null);
      preparedRef.current = null;
      uploadedRef.current = false;
      uploadMetaRef.current = null;
      await refresh();
    } catch (uploadError) {
      if (uploadError instanceof ReferenceUploadAbortedError) {
        setPhase("idle");
        setError("Upload cancelled.");
        return;
      }
      if (uploadError instanceof ReferenceUploadStalledError) {
        setPhase("stalled");
        setError(uploadError.message);
        return;
      }
      setPhase("error");
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      stopElapsedTimer();
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || loading) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setPhase("error");
      return;
    }

    await runUpload({ name: name.trim(), description: description.trim(), file });
  }

  async function onRetry() {
    const meta = uploadMetaRef.current;
    if (!meta) {
      if (file && name.trim()) {
        await runUpload({ name: name.trim(), description: description.trim(), file });
      }
      return;
    }

    if (uploadedRef.current && preparedRef.current) {
      setPhase("processing");
      setError("");
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      try {
        await completeUpload(preparedRef.current, meta);
        setPhase("complete");
        setCompletedName(meta.name);
        setName("");
        setDescription("");
        setFile(null);
        preparedRef.current = null;
        uploadedRef.current = false;
        uploadMetaRef.current = null;
        await refresh();
      } catch (retryError) {
        setPhase("error");
        setError(retryError instanceof Error ? retryError.message : "Could not save reference.");
      }
      return;
    }

    preparedRef.current = null;
    uploadedRef.current = false;
    await runUpload(meta);
  }

  function onCancel() {
    resetUploadUi();
  }

  async function onDelete(refName: string) {
    if (!confirm(`Delete reference "${refName}"?`)) return;
    await fetch(`${KIMI_API_REFERENCES}?name=${encodeURIComponent(refName)}`, { method: "DELETE" });
    await refresh();
  }

  const phaseLabel =
    phase === "preparing"
      ? "Preparing upload…"
      : phase === "uploading"
        ? "Uploading…"
        : phase === "processing"
          ? "Processing…"
          : phase === "complete"
            ? "Complete"
            : phase === "stalled"
              ? "Upload stalled"
              : "";

  const activeFile = uploadMetaRef.current?.file || file;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Kimi Reference Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload videos/images once, name them, then tell Cursor: &quot;Use Kimi with <strong>name</strong> to redo
          /conversations.&quot;
        </p>
        <p className="text-xs text-muted-foreground">
          Videos up to {kimiFormatBytes(KIMI_MAX_VIDEO_BYTES)} upload directly to storage — not through the app server.
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
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40 sm:p-8">
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={loading}
            onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
          />
          {file ? (
            <div className="space-y-1 text-center">
              <div className="font-medium text-foreground">{file.name}</div>
              <div>{kimiFormatBytes(file.size)}</div>
              <div className="text-xs">{kimiFormatMime(file.type || "unknown")}</div>
            </div>
          ) : (
            <span>Drop video or image here, or tap to choose (.mp4 .mov .webm)</span>
          )}
        </label>

        {!loading && phase !== "stalled" && phase !== "error" ? (
          <button
            type="submit"
            disabled={!configured || !file || Boolean(error)}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            Upload
          </button>
        ) : null}

        {loading || phase === "stalled" || phase === "complete" ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
            {activeFile ? (
              <div className="font-medium">
                {phase === "uploading" || phase === "stalled" ? "Uploading" : phaseLabel} {activeFile.name}
              </div>
            ) : (
              <div className="font-medium">{phaseLabel}</div>
            )}

            {phase === "uploading" || phase === "stalled" || phase === "processing" || phase === "complete" ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{
                      width: `${Math.max(progress.percent, phase === "processing" ? 98 : 0)}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {progress.percent}% — {kimiFormatBytes(progress.loaded)} of {kimiFormatBytes(progress.total || activeFile?.size || 0)}
                  </span>
                  {eta ? <span>{eta}</span> : null}
                  <span>{elapsedSec}s elapsed</span>
                </div>
              </>
            ) : null}

            {phase === "preparing" ? (
              <p className="text-xs text-muted-foreground">Getting a secure upload slot…</p>
            ) : null}
            {phase === "processing" ? (
              <p className="text-xs text-muted-foreground">Verifying storage and saving reference…</p>
            ) : null}
            {phase === "complete" ? (
              <p className="text-sm text-green-700 dark:text-green-400">
                Complete — tell Cursor: Use Kimi with {completedName}
              </p>
            ) : null}
            {phase === "stalled" ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Upload appears stalled. Check your connection or retry.
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "stalled" || phase === "error" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRetry()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {loading ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel upload
          </button>
        ) : null}

        {error && phase !== "stalled" ? <p className="text-sm text-red-600 dark:text-red-400">Upload failed — {error}</p> : null}
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
