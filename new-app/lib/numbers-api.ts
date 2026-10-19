import type { ExternalConnection, OwnedNumber, PortRequest } from "@/lib/numbers";

export type NumbersInventoryPayload = {
  owned: OwnedNumber[];
  connections: ExternalConnection[];
  ports: PortRequest[];
  platform: { id: string; number: string; label: string } | null;
};

export async function fetchNumbersInventory(sync = true): Promise<NumbersInventoryPayload> {
  const res = await fetch(`/api/numbers/inventory?sync=${sync ? "1" : "0"}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Inventory failed (${res.status})`);
  }
  const json = (await res.json()) as { data: NumbersInventoryPayload };
  return json.data;
}

export type SearchResult = {
  e164: string;
  region: string;
  monthly: number;
  setupFee: number;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

export async function searchNumbers(body: {
  areaCode?: string;
  city?: string;
  contains?: string;
  numberType?: "local" | "toll_free";
}): Promise<SearchResult[]> {
  const res = await fetch("/api/numbers/search", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Search failed");
  }
  const json = (await res.json()) as { data: SearchResult[] };
  return json.data;
}

export async function purchaseNumber(phoneNumber: string, nickname?: string): Promise<OwnedNumber> {
  const res = await fetch("/api/numbers/purchase", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, nickname }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Purchase failed");
  }
  const json = (await res.json()) as { data: OwnedNumber };
  return json.data;
}

export async function patchNumber(id: string, patch: { nickname?: string }): Promise<OwnedNumber> {
  const res = await fetch(`/api/numbers/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Update failed");
  }
  const json = (await res.json()) as { data: OwnedNumber };
  return json.data;
}
