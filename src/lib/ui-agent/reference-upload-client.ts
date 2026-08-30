export type ReferenceUploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type ReferenceUploadOptions = {
  supabaseUrl: string;
  bucket: string;
  path: string;
  token: string;
  file: File;
  onProgress: (progress: ReferenceUploadProgress) => void;
  signal?: AbortSignal;
  stallAfterMs?: number;
  onStall?: () => void;
};

export class ReferenceUploadStalledError extends Error {
  constructor() {
    super("Upload appears stalled. Check your connection or retry.");
    this.name = "ReferenceUploadStalledError";
  }
}

export class ReferenceUploadAbortedError extends Error {
  constructor() {
    super("Upload cancelled.");
    this.name = "ReferenceUploadAbortedError";
  }
}

function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Direct browser → Supabase signed upload with real XHR byte progress. */
export function uploadReferenceWithProgress(options: ReferenceUploadOptions): Promise<void> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    return Promise.reject(new Error("Supabase anon key is not configured for browser uploads."));
  }

  const base = options.supabaseUrl.replace(/\/$/, "");
  const objectPath = `${options.bucket}/${encodeStoragePath(options.path)}`;
  const url = `${base}/storage/v1/object/upload/sign/${objectPath}?token=${encodeURIComponent(options.token)}`;

  const stallAfterMs = options.stallAfterMs ?? 30_000;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let lastLoaded = 0;
    let lastProgressAt = Date.now();
    let stallTimer: number | null = null;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (stallTimer !== null) window.clearInterval(stallTimer);
      if (error) reject(error);
      else resolve();
    };

    const resetStallWatch = () => {
      if (stallTimer !== null) window.clearInterval(stallTimer);
      stallTimer = window.setInterval(() => {
        if (settled) return;
        if (Date.now() - lastProgressAt >= stallAfterMs) {
          xhr.abort();
          options.onStall?.();
          finish(new ReferenceUploadStalledError());
        }
      }, 1000);
    };

    const onAbort = () => {
      xhr.abort();
      finish(new ReferenceUploadAbortedError());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        finish(new ReferenceUploadAbortedError());
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      if (event.loaded > lastLoaded) {
        lastLoaded = event.loaded;
        lastProgressAt = Date.now();
      }
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      options.onProgress({ loaded: event.loaded, total: event.total, percent });
    };

    xhr.onerror = () => finish(new Error("Network error while uploading to storage."));
    xhr.ontimeout = () =>
      finish(new Error("Upload timed out. Try again or check your connection."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress({ loaded: options.file.size, total: options.file.size, percent: 100 });
        finish();
        return;
      }
      let detail = xhr.responseText?.slice(0, 200);
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        detail = parsed.message || parsed.error || detail;
      } catch {
        // keep raw snippet
      }
      finish(
        new Error(detail ? `Storage upload failed: ${detail}` : `Storage upload failed (${xhr.status}).`),
      );
    };

    xhr.timeout = 20 * 60 * 1000;
    resetStallWatch();

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", options.file);
    xhr.send(body);
  });
}
