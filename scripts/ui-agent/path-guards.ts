import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import {
  ALLOWED_PATH_PREFIXES,
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PROTECTED_PATH_GLOBS,
  resolveUiAgentPath,
  VIDEO_EXTENSIONS,
} from "./config";
import type { MediaKind } from "./types";

function globMatch(path: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "§§")
        .replace(/\*/g, "[^/]*")
        .replace(/§§/g, ".*") +
      "$",
  );
  return regex.test(path);
}

export function normalizeRepoRelativePath(filePath: string): string {
  const abs = resolveUiAgentPath(filePath);
  const root = resolveUiAgentPath(".");
  const rel = abs.startsWith(root + "/") ? abs.slice(root.length + 1) : abs;
  return rel.replace(/\\/g, "/");
}

export function isProtectedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  for (const pattern of PROTECTED_PATH_GLOBS) {
    if (globMatch(normalized, pattern)) return true;
  }
  return false;
}

export function isAllowedUiPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (isProtectedPath(normalized)) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertAllowedChangePath(relativePath: string): void {
  const normalized = normalizeRepoRelativePath(relativePath);
  if (normalized.includes("..")) {
    throw new Error(`Path traversal rejected: ${relativePath}`);
  }
  if (!isAllowedUiPath(normalized)) {
    throw new Error(`Protected or disallowed path: ${normalized}`);
  }
}

export function detectMediaKind(filePath: string): MediaKind {
  const ext = extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  throw new Error(`Unsupported media type: ${filePath}`);
}

export function validateMediaFile(filePath: string): { kind: MediaKind; mimeType: string; size: number } {
  const abs = resolveUiAgentPath(filePath);
  if (!existsSync(abs)) throw new Error(`Media file not found: ${filePath}`);
  const stat = statSync(abs);
  const kind = detectMediaKind(abs);
  const ext = extname(abs).toLowerCase();
  const mimeType =
    kind === "image"
      ? ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg"
      : ext === ".webm"
        ? "video/webm"
        : ext === ".mov"
          ? "video/quicktime"
          : "video/mp4";

  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (stat.size > max) {
    throw new Error(`${filePath} exceeds max size (${stat.size} > ${max})`);
  }

  return { kind, mimeType, size: stat.size };
}
