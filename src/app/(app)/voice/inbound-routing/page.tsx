import { redirect } from "next/navigation";

/**
 * Legacy inbound routing rules are not consumed by the certified Voice V3 PSTN path.
 * Compatibility redirect — models/APIs preserved for Smart Routing ownership.
 */
export default function LegacyInboundRoutingPage() {
  redirect("/voice/call-handling");
}
