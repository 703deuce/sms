import { route571ToMctbConsentTexml, verify571MctbConsentTexmlRoute } from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import { fetchTelnyxPhoneNumberByE164 } from "@/lib/mctb/consent-prompt/telnyx-call-control-route";

async function main() {
  const e164 = "+15714073615";
  const pn = await fetchTelnyxPhoneNumberByE164(e164);
  if (!pn?.id) throw new Error(`${e164} not found`);
  const routed = await route571ToMctbConsentTexml(String(pn.id));
  const verify = await verify571MctbConsentTexmlRoute(String(pn.id));
  console.log(JSON.stringify({ routed, verify }, null, 2));
  if (!verify.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
