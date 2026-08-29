#!/usr/bin/env tsx
/**
 * Static scaffold checks for mctb-sip-adapter (no Asterisk runtime required).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("mctb-sip-adapter");
const required = [
  "Dockerfile",
  "docker-entrypoint.sh",
  "asterisk/pjsip.conf.template",
  "asterisk/extensions.conf.template",
  "asterisk/rtp.conf.template",
  "agi/mctb_inbound.py",
  "agi/transovo_client.py",
];

let failed = 0;
for (const rel of required) {
  const path = resolve(root, rel);
  if (!existsSync(path)) {
    console.error(`MISSING ${rel}`);
    failed += 1;
  }
}

const extensions = readFileSync(resolve(root, "asterisk/extensions.conf.template"), "utf8");
if (!extensions.includes("Progress()")) {
  console.error("extensions.conf must call Progress() for 183 early dialog");
  failed += 1;
}
if (!extensions.includes("AGI(mctb_inbound.py)")) {
  console.error("extensions.conf must invoke mctb_inbound.py AGI");
  failed += 1;
}

const pjsip = readFileSync(resolve(root, "asterisk/pjsip.conf.template"), "utf8");
if (!pjsip.includes("100rel=yes")) {
  console.error("pjsip.conf must enable 100rel");
  failed += 1;
}

const agi = readFileSync(resolve(root, "agi/mctb_inbound.py"), "utf8");
for (const needle of [
  "resolve_mctb_sip_session",
  "record_mctb_sip_press_1_consent",
  "asterisk_sip_mctb",
]) {
  if (!agi.includes(needle)) {
    console.error(`mctb_inbound.py missing ${needle}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} scaffold check(s) failed`);
  process.exit(1);
}

console.log("OK mctb-sip-adapter scaffold");
