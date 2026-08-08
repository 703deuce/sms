#!/usr/bin/env npx tsx
/**
 * Patch LiveKit inbound trunk numbers to +E.164 using LIVEKIT_* env vars.
 * Usage: LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... npx tsx scripts/livekit-direct-patch-trunk.ts +18663464256
 */
import { patchInboundTrunkE164Formats } from "../src/lib/telephony/provisioning/livekit/patch-trunk-e164";

const e164 = process.argv[2] || "+18663464256";
const result = await patchInboundTrunkE164Formats(e164);
console.log(JSON.stringify(result, null, 2));
