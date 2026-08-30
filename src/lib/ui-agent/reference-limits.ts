/** Shared Kimi reference upload limits (client + server). */

export const KIMI_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const KIMI_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const KIMI_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const KIMI_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function kimiMaxBytesForMime(mime: string): number {
  return mime.startsWith("video/") ? KIMI_MAX_VIDEO_BYTES : KIMI_MAX_IMAGE_BYTES;
}

export function kimiFormatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function kimiFormatMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === "video/quicktime") return "video/quicktime (.mov)";
  if (normalized === "video/mp4") return "video/mp4 (.mp4)";
  if (normalized === "video/webm") return "video/webm (.webm)";
  if (normalized) return normalized;
  return "unknown type";
}

export function kimiEstimateUploadSeconds(bytes: number): number {
  // Rough guide for typical home/office uplink (~5 Mbps effective).
  const seconds = Math.ceil((bytes * 8) / (5 * 1024 * 1024));
  return Math.max(5, Math.min(seconds, 600));
}
