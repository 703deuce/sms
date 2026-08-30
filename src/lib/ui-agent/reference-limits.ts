/** Shared Kimi reference upload limits (client + server). */

export const KIMI_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const KIMI_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const KIMI_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const KIMI_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function kimiMaxBytesForMime(mime: string): number {
  return mime.startsWith("video/") ? KIMI_MAX_VIDEO_BYTES : KIMI_MAX_IMAGE_BYTES;
}

export function kimiFormatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function kimiEstimateUploadSeconds(bytes: number): number {
  // Rough guide for typical home/office uplink (~5 Mbps effective).
  const seconds = Math.ceil((bytes * 8) / (5 * 1024 * 1024));
  return Math.max(5, Math.min(seconds, 600));
}
