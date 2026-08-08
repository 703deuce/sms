#!/usr/bin/env node
/** Patch LiveKit inbound trunk to +E.164 (fixes Telnyx SIP 404). */
import { smokeLogin, api } from "./lib/smoke-production.mjs";

const PHONE_ID = (process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l").trim();

const { jar, base: BASE } = await smokeLogin();
const res = await api(jar, BASE, "POST", "/api/voice/livekit/readiness", {
  phoneNumberId: PHONE_ID,
  patchTrunk: true,
  inspect: true,
});
console.log("status:", res.status);
console.log(JSON.stringify(res.json?.data?.patchTrunk, null, 2));
console.log("trunk:", res.json?.data?.inspect?.trunkContainingDid);
console.log("verify:", res.json?.data?.verify?.issues);
