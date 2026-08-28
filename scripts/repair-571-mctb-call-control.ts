import {
  prepareFqdnForDirectMctb,
  verifyFqdnDirectMctbRoute,
} from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";
import {
  assignPhoneNumberToEventOnlyConnection,
  verify571EventOnlyRoute,
} from "@/lib/mctb/consent-prompt/telnyx-event-only-route";

async function main() {
  const prepared = await prepareFqdnForDirectMctb();
  const assigned = await assignPhoneNumberToEventOnlyConnection("+15714073615");
  const verify = await verify571EventOnlyRoute();
  const verify866 = await verifyFqdnDirectMctbRoute();
  console.log(JSON.stringify({ prepared, assigned, verify, verify866 }, null, 2));
  if (!verify.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
