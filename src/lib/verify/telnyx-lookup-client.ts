import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

type TelnyxLookupData = {
  phone_number?: string;
  country_code?: string;
  carrier?: {
    name?: string;
    type?: string;
    mobile_country_code?: string;
    mobile_network_code?: string;
  };
  portability?: {
    ported_status?: string;
    ported_date?: string;
  };
};

export async function telnyxNumberLookup(e164: string) {
  if (!getTelnyxApiKey()) {
    throw new Error("TELNYX_API_KEY not configured");
  }
  const encoded = encodeURIComponent(e164);
  const res = await telnyxRequest<{ data: TelnyxLookupData }>(`/number_lookup/${encoded}`, {
    query: { type: "carrier" },
  });
  return res.data;
}
