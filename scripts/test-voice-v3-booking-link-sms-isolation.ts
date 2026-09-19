#!/usr/bin/env npx tsx
/**
 * Voice V3 booking-link SMS must not import legacy quick/appointment send paths.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src/lib/voice-v3/booking-link");
const FORBIDDEN_IMPORTS = [
  "@/lib/sms/send-quick",
  "@/lib/appointments/sms-sender",
  "publishSmsEvent",
  "@/lib/campaigns/",
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listTsFiles(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let failed = 0;
for (const file of listTsFiles(ROOT)) {
  const text = fs.readFileSync(file, "utf8");
  for (const needle of FORBIDDEN_IMPORTS) {
    if (text.includes(needle)) {
      console.error(`FAIL ${path.relative(process.cwd(), file)} contains forbidden: ${needle}`);
      failed += 1;
    }
  }
}

const transport = path.join(ROOT, "send-voice-v3-booking-link-sms.ts");
if (!fs.existsSync(transport)) {
  console.error("FAIL missing dedicated transport send-voice-v3-booking-link-sms.ts");
  failed += 1;
}

if (failed > 0) {
  console.error(`VOICE_V3_BOOKING_LINK_SMS_ISOLATION failed (${failed})`);
  process.exit(1);
}
console.log("VOICE_V3_BOOKING_LINK_SMS_ISOLATION PASS");
