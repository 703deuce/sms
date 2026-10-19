import type { ExternalConnection, NumberProduct, OwnedNumber, PortRequest } from "@/lib/numbers";

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

export type NumberBinding = { product: NumberProduct; detail: string };

export async function fetchNumberBindings(phoneNumberId: string): Promise<NumberBinding[]> {
  const res = await fetch(`/api/numbers/${phoneNumberId}/bindings`, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Bindings failed (${res.status})`);
  }
  const json = (await res.json()) as { data: { bindings: NumberBinding[] } };
  return json.data.bindings;
}

export async function switchNumberProduct(input: {
  phoneNumberId: string;
  targetProduct: NumberProduct;
  confirmSwitch?: boolean;
  agentId?: string | null;
}): Promise<{ ok: boolean; needsConfirmation?: boolean; actions: string[]; error?: string }> {
  const res = await fetch(`/api/numbers/${input.phoneNumberId}/switch-product`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetProduct: input.targetProduct,
      confirmSwitch: input.confirmSwitch ?? false,
      agentId: input.agentId,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: { ok: boolean; needsConfirmation?: boolean; actions: string[]; previousBindings?: NumberBinding[] };
  };
  if (res.status === 409 && body.error === "confirm_switch_required") {
    return {
      ok: false,
      needsConfirmation: true,
      actions: body.data?.actions || [],
      error: body.error,
    };
  }
  if (!res.ok) {
    throw new Error(body.error || `Switch failed (${res.status})`);
  }
  return {
    ok: Boolean(body.data?.ok),
    actions: body.data?.actions || [],
  };
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
