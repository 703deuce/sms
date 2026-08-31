/**
 * Data adapter: maps /api/growth/qr ↔ Kimi grow-qr-codes mock types.
 */
import type { Keyword } from "@/components/kimi/grow-qr-codes/mock-data";
import { mapApiKeywordToKimi as mapKw, fetchKeywords } from "./kimi-keywords-adapter";

export { mapApiKeywordToKimi } from "./kimi-keywords-adapter";

export type QrCodeRow = {
  id: string;
  name: string;
  targetUrl: string;
  targetType?: string;
  trackedUrl?: string;
  qrImageUrl?: string;
  status?: string;
  createdAt?: string;
};

export async function fetchQrKeywords(): Promise<Keyword[]> {
  const keywords = await fetchKeywords();
  return keywords.map((k) => ({
    id: k.id,
    name: k.name,
    description: k.description,
    lastSaved: k.lastSaved,
    connectedLists: k.connectedLists,
    status: k.status,
  }));
}

export async function createQrCode(payload: {
  name: string;
  targetUrl: string;
  targetType?: string;
}): Promise<QrCodeRow> {
  const res = await fetch("/api/growth/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create QR code");
  return json.data;
}

export async function fetchQrCodes(): Promise<QrCodeRow[]> {
  const res = await fetch("/api/growth/qr");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load QR codes");
  return json.data || [];
}

// Re-export for QR flow keyword mapping
export { fetchKeywords, mapKw };
