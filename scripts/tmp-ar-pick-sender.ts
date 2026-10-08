import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
hydrateProdTestEnvFromCoolify();
import { selectArOutboundPlatformSender } from "@/lib/appointment-reminders/messaging/reply-session";
import { listArEligiblePlatformSenders } from "@/lib/appointment-reminders/messaging/ar-platform-sender-pool";

async function main() {
  const senders = await listArEligiblePlatformSenders();
  console.log("eligible", senders);
  const picked = await selectArOutboundPlatformSender({
    workspaceId: "ws_1",
    appointmentId: "cmuyz6okg1b1j385t6f5u0x05",
    consumerE164: "+15714073615",
  });
  console.log("picked", picked);
}
main();
