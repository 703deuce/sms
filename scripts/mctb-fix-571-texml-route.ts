#!/usr/bin/env npx tsx
/** One-shot: point platform 571 at TeXML Press-1 (not Call Control / SIP test apps). */
import { fetch571PhoneAssignment } from "@/lib/mctb/sip-diagnostic/fqdn-audit";
import {
  route571ToMctbConsentTexml,
  verify571MctbConsentTexmlRoute,
} from "@/lib/mctb/consent-prompt/telnyx-texml-route";

async function main() {
  const before = await fetch571PhoneAssignment();
  console.log("\nBefore:");
  console.log(`  connection: ${before.connectionId} (${before.connectionName}, ${before.connectionKind})`);

  const routed = await route571ToMctbConsentTexml(before.providerNumberId);
  console.log("\nRouted:");
  console.log(`  texmlAppId: ${routed.texmlAppId}`);
  console.log(`  voiceUrl:   ${routed.voiceUrl}`);

  const verify = await verify571MctbConsentTexmlRoute(before.providerNumberId);
  console.log("\nVerify:", verify.ok ? "PASS" : "FAIL");
  console.log(`  ${verify.detail}`);

  if (!verify.ok) process.exit(1);
  console.log("\n✅ 571 is on TeXML Press-1 — call +15714073615 to hear the consent prompt.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
