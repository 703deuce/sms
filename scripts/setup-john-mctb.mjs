#!/usr/bin/env node
/**
 * Switch a workspace DID from Amy to John (MCTB) for live testing.
 *
 *   BASE_URL=https://your-app \
 *   OWNER_EMAIL=you@example.com \
 *   AMY_AGENT_ID=cmshz2lc25c622c4i58303501 \
 *   PHONE_NUMBER_ID=cmsgtjms84g6l2h0o255w1e3v \  # +15714073615 (571 — call AND text from this)
 *   SMS_PHONE_NUMBER_ID=cmsgtjms84g6l2h0o255w1e3v \
 *   node scripts/setup-john-mctb.mjs
 *
 * Test flow: call +15714073615 from +15714776175, let ring, hang up.
 * John texts back TO your caller ID (+15714776175) FROM the 571 DID.
 */
import { PrismaClient } from "@prisma/client";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
const BOOTSTRAP = process.env.SMOKE_BOOTSTRAP || "transovo-smoke-bootstrap-b56f-aug2026";
const AMY_AGENT_ID = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const PHONE_NUMBER_ID = (process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();
const SMS_PHONE_NUMBER_ID = (process.env.SMS_PHONE_NUMBER_ID || PHONE_NUMBER_ID).trim();
const DELAY_SECONDS = Number(process.env.DELAY_SECONDS || 0);

async function smokeLogin() {
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!login.ok) throw new Error(`smoke-login ${login.status}: ${await login.text()}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => String(c).split(";")[0])
    .join("; ");
  return { cookie, h: { cookie, accept: "application/json", "content-type": "application/json" } };
}

async function main() {
  if (!BASE) throw new Error("Set BASE_URL");
  if (!EMAIL) throw new Error("Set OWNER_EMAIL");

  const prisma = new PrismaClient();
  const { detachVoiceAgentFromNumber, activateJohnOnPhoneNumber } = await import(
    "../src/lib/agents/missed-call-text-back/phone-switch.ts"
  );

  const pn = await prisma.phoneNumber.findUnique({ where: { id: PHONE_NUMBER_ID } });
  if (!pn) throw new Error(`Phone ${PHONE_NUMBER_ID} not found`);

  console.log("\n=== Detach Amy from", pn.e164, "===");
  const detached = await detachVoiceAgentFromNumber({
    workspaceId: pn.workspaceId,
    agentId: AMY_AGENT_ID,
    phoneNumberId: PHONE_NUMBER_ID,
  });
  console.log(detached);

  console.log("\n=== Activate John MCTB (delay", DELAY_SECONDS, "s) ===");
  const activated = await activateJohnOnPhoneNumber({
    workspaceId: pn.workspaceId,
    phoneNumberId: PHONE_NUMBER_ID,
    smsPhoneNumberId: SMS_PHONE_NUMBER_ID,
    delaySeconds: DELAY_SECONDS,
  });
  console.log(activated);

  await prisma.$disconnect();

  try {
    const { h } = await smokeLogin();
    const diag = await fetch(`${BASE}/api/numbers/${PHONE_NUMBER_ID}/provision`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ action: "diagnose" }),
    });
    console.log("\n=== Number diagnose ===", diag.status, await diag.text());
  } catch (e) {
    console.warn("Smoke login diagnose skipped:", e.message);
  }

  const smsPn = await prisma.phoneNumber.findUnique({ where: { id: SMS_PHONE_NUMBER_ID } });

  console.log("\n=== READY ===");
  console.log(
    JSON.stringify(
      {
        callThisNumber: pn.e164,
        smsFrom: smsPn?.e164 || SMS_PHONE_NUMBER_ID,
        expectSmsTo: "your caller ID (e.g. +15714776175 — the phone you call FROM)",
        delaySeconds: DELAY_SECONDS,
        amyDetached: true,
        instructions:
          "Call the 571 number from 571-477-6175, let it ring without answering, hang up. You should receive the MCTB text on the phone you called from.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
