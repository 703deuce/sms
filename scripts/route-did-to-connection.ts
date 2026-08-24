import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { routeTelnyxNumberToConnection } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

async function main() {
  const connectionId = process.argv[2];
  if (!connectionId) throw new Error("usage: route-did-to-connection.ts <connectionId>");
  const listed = await telnyxRequest<{ data?: Array<{ id: string }> }>("/phone_numbers", {
    query: { "filter[phone_number]": "+18663221763" },
  });
  const numId = String(listed.data?.[0]?.id || "");
  const route = await routeTelnyxNumberToConnection({
    e164: "+18663221763",
    providerNumberId: numId,
    connectionId,
  });
  console.log(JSON.stringify(route, null, 2));
}

main();
