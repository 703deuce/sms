/**
 * Resolve Telnyx phone-number resource IDs from number orders.
 * Number-order IDs are NOT valid for PATCH/DELETE /phone_numbers/{id}.
 */

import { isTelnyxResourceNotFound, telnyxRequest } from "./client";

type TelnyxListResponse<T> = { data: T[] };
type TelnyxDataResponse<T> = { data: T };

type OrderPhoneNumber = {
  id?: string;
  phone_number?: string;
  status?: string;
};

type NumberOrder = {
  id: string;
  status?: string;
  phone_numbers?: OrderPhoneNumber[];
};

export const TELNYX_ORDER_ID_PREFIX = "ORDER:";

export function isTelnyxOrderId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(TELNYX_ORDER_ID_PREFIX));
}

export function toTelnyxOrderRef(orderId: string) {
  return `${TELNYX_ORDER_ID_PREFIX}${orderId}`;
}

export function fromTelnyxOrderRef(id: string) {
  return id.startsWith(TELNYX_ORDER_ID_PREFIX) ? id.slice(TELNYX_ORDER_ID_PREFIX.length) : id;
}

export async function lookupTelnyxPhoneNumberId(phoneNumber: string): Promise<string | null> {
  const exact = await telnyxRequest<TelnyxListResponse<{ id: string; phone_number?: string }>>(
    "/phone_numbers",
    { query: { "filter[phone_number]": phoneNumber, "page[size]": 5 } },
  );
  const exactMatch =
    (exact.data || []).find((n) => n.phone_number === phoneNumber) || (exact.data || [])[0];
  if (exactMatch?.id) return exactMatch.id;

  const digits = phoneNumber.replace(/\D/g, "");
  const suffix = digits.length >= 4 ? digits.slice(-10) : digits;
  if (!suffix) return null;
  const fuzzy = await telnyxRequest<TelnyxListResponse<{ id: string; phone_number?: string }>>(
    "/phone_numbers",
    { query: { "filter[phone_number][contains]": suffix, "page[size]": 10 } },
  );
  const fuzzyMatch = (fuzzy.data || []).find((n) => {
    const d = String(n.phone_number || "").replace(/\D/g, "");
    return d.endsWith(suffix) || d === digits;
  });
  return fuzzyMatch?.id || null;
}

export async function fetchTelnyxNumberOrder(orderId: string): Promise<NumberOrder> {
  const res = await telnyxRequest<TelnyxDataResponse<NumberOrder>>(`/number_orders/${orderId}`);
  return res.data;
}

/**
 * Resolve a real /phone_numbers/{id} from an order id and/or E.164.
 * Returns null when the order is still pending provisioning.
 */
export async function resolveTelnyxPhoneNumberId(input: {
  orderId?: string | null;
  phoneNumber: string;
  existingId?: string | null;
}): Promise<string | null> {
  const existing = input.existingId || "";
  if (existing && !isTelnyxOrderId(existing) && !existing.startsWith("PENDING:")) {
    try {
      await telnyxRequest<{ data?: { id?: string } }>(
        `/phone_numbers/${encodeURIComponent(existing)}`,
      );
      return existing;
    } catch (err) {
      if (!isTelnyxResourceNotFound(err)) throw err;
    }
  }

  const orderId =
    input.orderId || (isTelnyxOrderId(existing) ? fromTelnyxOrderRef(existing) : null);

  if (orderId) {
    try {
      const order = await fetchTelnyxNumberOrder(orderId);
      const entry =
        (order.phone_numbers || []).find((p) => p.phone_number === input.phoneNumber) ||
        (order.phone_numbers || [])[0];
      if (entry?.id && (entry.status === "success" || order.status === "success")) {
        return entry.id;
      }
      // Some responses include the phone number resource id before status flips.
      if (entry?.id && entry.status !== "failure") {
        const lookedUp = await lookupTelnyxPhoneNumberId(input.phoneNumber);
        if (lookedUp) return lookedUp;
      }
    } catch {
      // fall through to E.164 lookup
    }
  }

  return lookupTelnyxPhoneNumberId(input.phoneNumber);
}

export async function pollTelnyxPhoneNumberId(input: {
  orderId: string;
  phoneNumber: string;
  attempts?: number;
  delayMs?: number;
}): Promise<string | null> {
  const attempts = input.attempts ?? 6;
  const delayMs = input.delayMs ?? 1500;
  for (let i = 0; i < attempts; i += 1) {
    const id = await resolveTelnyxPhoneNumberId({
      orderId: input.orderId,
      phoneNumber: input.phoneNumber,
    });
    if (id) return id;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
