/**
 * Read-only: compare DB providerNumberId vs Telnyx for ws_1 test DIDs.
 * Run: npx tsx scripts/telnyx-voice-provision-diagnose.ts
 */
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
  hydrateProdTestEnvFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";
import { isTelnyxResourceNotFound, telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  lookupTelnyxPhoneNumberId,
  resolveTelnyxPhoneNumberId,
} from "@/lib/messaging/telnyx/phone-numbers";

const LAST4 = (process.env.DIAG_PHONE_LAST4 || "8077,6264").split(",").map((s) => s.trim());

async function probeId(label: string, id: string) {
  try {
    const res = await telnyxRequest<{ data?: { id?: string; phone_number?: string } }>(
      `/phone_numbers/${encodeURIComponent(id)}`,
    );
    return {
      label,
      ok: true,
      id: res.data?.id,
      phone_number: res.data?.phone_number,
    };
  } catch (err) {
    return {
      label,
      ok: false,
      notFound: isTelnyxResourceNotFound(err),
      error: err instanceof Error ? err.message.slice(0, 200) : String(err),
    };
  }
}

async function main() {
  hydrateProdDatabaseUrlFromCoolify();
  hydrateProdSupabaseFromCoolify();
  const { hydrateTelnyxApiKeyFromCoolify } = await import("./cloud-agent/hydrate-prod-test-env");
  hydrateTelnyxApiKeyFromCoolify();
  if (!process.env.TELNYX_API_KEY?.trim()) {
    console.error("TELNYX_API_KEY missing — hydrate from prod web container");
    process.exit(1);
  }

  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: "ws_1" },
    select: { id: true, e164: true, provider: true, providerNumberId: true },
  });

  const report: unknown[] = [];
  for (const last4 of LAST4) {
    const phone = phones.find((p) => p.e164?.includes(last4));
    if (!phone?.e164) {
      report.push({ last4, error: "not_in_db" });
      continue;
    }
    const dbId = phone.providerNumberId || "";
    const dbGet = dbId ? await probeId("GET_db_providerNumberId", dbId) : null;
    const lookup = await lookupTelnyxPhoneNumberId(phone.e164);
    const lookupGet = lookup ? await probeId("GET_lookup_by_e164", lookup) : null;
    const resolved = await resolveTelnyxPhoneNumberId({
      phoneNumber: phone.e164,
      existingId: dbId,
    });
    report.push({
      last4,
      phoneNumberId: phone.id,
      e164: phone.e164,
      provider: phone.provider,
      dbProviderNumberId: dbId,
      dbGet,
      lookupByE164: lookup,
      lookupGet,
      resolvedId: resolved,
      staleDbId: Boolean(dbId && lookup && dbId !== lookup),
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
