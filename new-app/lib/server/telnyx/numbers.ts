import { telnyxRequest } from "@/lib/server/telnyx/client";

type TelnyxListResponse<T> = { data: T[] };
type TelnyxDataResponse<T> = { data: T };

export type TelnyxAvailableNumber = {
  phoneNumber: string;
  locality?: string;
  region?: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

export async function searchAvailableNumbers(input: {
  areaCode?: string;
  locality?: string;
  contains?: string;
  tollFree?: boolean;
}): Promise<TelnyxAvailableNumber[]> {
  const res = await telnyxRequest<
    TelnyxListResponse<{
      phone_number: string;
      locality?: string;
      region_information?: Array<{ region_name?: string; region_type?: string }>;
      features?: Array<{ name?: string }>;
    }>
  >("/available_phone_numbers", {
    query: {
      "filter[country_code]": "US",
      "filter[features]": "sms,voice",
      "filter[limit]": 25,
      ...(input.tollFree
        ? { "filter[phone_number_type]": "toll_free" }
        : input.areaCode
          ? { "filter[national_destination_code]": input.areaCode.replace(/\D/g, "").slice(0, 3) }
          : {}),
      ...(input.locality ? { "filter[locality]": input.locality } : {}),
      ...(input.contains ? { "filter[phone_number][contains]": input.contains.replace(/\D/g, "") } : {}),
    },
  });

  return (res.data || []).map((n) => {
    const region =
      n.region_information?.find((r) => r.region_type === "state")?.region_name ||
      n.region_information?.[0]?.region_name;
    const features = (n.features || []).map((f) => (f.name || "").toLowerCase());
    return {
      phoneNumber: n.phone_number,
      locality: n.locality,
      region,
      capabilities: {
        sms: features.includes("sms"),
        mms: features.includes("mms"),
        voice: features.includes("voice"),
      },
    };
  });
}

export async function listAccountPhoneNumbers(): Promise<
  Array<{
    id: string;
    phone_number: string;
    status?: string;
    connection_name?: string;
  }>
> {
  const res = await telnyxRequest<
    TelnyxListResponse<{
      id: string;
      phone_number: string;
      status?: string;
      connection_name?: string;
    }>
  >("/phone_numbers", { query: { "page[size]": 250 } });
  return res.data || [];
}

export async function orderPhoneNumber(phoneNumber: string, workspaceId: string) {
  const res = await telnyxRequest<
    TelnyxDataResponse<{
      id: string;
      phone_numbers?: Array<{ id?: string; phone_number?: string; status?: string }>;
    }>
  >("/number_orders", {
    method: "POST",
    body: {
      phone_numbers: [{ phone_number: phoneNumber }],
      customer_reference: `ws:${workspaceId}`,
    },
    idempotencyKey: `number-order:${phoneNumber}`,
  });
  const order = res.data;
  const entry = order.phone_numbers?.[0];
  return {
    orderId: order.id,
    e164: entry?.phone_number || phoneNumber,
    providerNumberId: entry?.id || null,
  };
}
