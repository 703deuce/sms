function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadReferenceWithProgress(input: {
  supabaseUrl: string;
  bucket: string;
  path: string;
  token: string;
  file: File;
  onProgress: (percent: number) => void;
}): Promise<void> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("Supabase anon key is not configured for browser uploads.");
  }

  const base = input.supabaseUrl.replace(/\/$/, "");
  const url = `${base}/storage/v1/object/upload/sign/${encodeURIComponent(input.bucket)}/${encodeStoragePath(input.path)}?token=${encodeURIComponent(input.token)}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", input.file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      input.onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading to storage."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or check your connection."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress(100);
        resolve();
        return;
      }
      let detail = xhr.responseText?.slice(0, 200);
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        detail = parsed.message || parsed.error || detail;
      } catch {
        // keep raw snippet
      }
      reject(new Error(detail ? `Storage upload failed: ${detail}` : `Storage upload failed (${xhr.status}).`));
    };

    xhr.timeout = 15 * 60 * 1000;
    xhr.send(input.file);
  });
}
