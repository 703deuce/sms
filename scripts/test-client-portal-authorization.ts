#!/usr/bin/env tsx
/**
 * Client portal IDOR smoke — requires DB + seeded contacts/appointments.
 * Run: npx tsx scripts/test-client-portal-authorization.ts
 */
import assert from "node:assert/strict";
import {
  assertAppointmentOwnedBySession,
  resolveClientPortalSessionFromToken,
} from "../src/lib/appointments/client-portal/auth";

async function main() {
  const missing = await resolveClientPortalSessionFromToken("not-a-real-token");
  assert.equal(missing, null);

  let threw = false;
  try {
    await assertAppointmentOwnedBySession(
      { sessionId: "x", workspaceId: "ws-a", contactId: "ct-a", expiresAt: new Date(Date.now() + 3600000) },
      "appt-belongs-to-other",
    );
  } catch (e) {
    threw = e instanceof Error && e.message === "Forbidden";
  }
  assert.ok(threw, "assertAppointmentOwnedBySession must throw Forbidden for unknown appointment");

  console.log("client-portal-authorization: static checks PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
