/**
 * Which ws_1 numbers can Telnyx voice provision actually use?
 */
import {
  hydrateProdDatabaseUrlFromCoolify,
  hydrateProdSupabaseFromCoolify,
  hydrateTelnyxApiKeyFromCoolify,
} from "./cloud-agent/hydrate-prod-test-env";
import { getPrisma } from "@/lib/db";
import { isTelnyxResourceNotFound, telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  lookupTelnyxPhoneNumberId,
  resolveTelnyxPhoneNumberId,
} from "@/lib/messaging/telnyx/phone-numbers";

async function probeGet(id: string) {
  try {
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(id)}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      notFound: isTelnyxResourceNotFound(err),
    };
  }
}

async function main() {
  hydrateProdDatabaseUrlFromCoolify();
  hydrateProdSupabaseFromCoolify();
  const { hydrateProdTestEnvFromCoolify } = await import("./cloud-agent/hydrate-prod-test-env");
  hydrateProdTestEnvFromCoolify();
  hydrateTelnyxApiKeyFromCoolify();
  if (!process.env.TELNYX_API_KEY?.trim()) {
    console.error("TELNYX_API_KEY missing");
    process.exit(1);
  }

  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { workspaceId: "ws_1" },
    select: {
      id: true,
      e164: true,
      provider: true,
      providerNumberId: true,
      status: true,
      friendlyName: true,
    },
    orderBy: { e164: "asc" },
  });

  const report: unknown[] = [];
  let telnyxCount = 0;
  let twilioCount = 0;
  let voiceReady = 0;

  for (const row of rows) {
    const provider = String(row.provider || "telnyx").toLowerCase();
    if (provider === "telnyx") telnyxCount += 1;
    else twilioCount += 1;

    if (provider !== "telnyx") {
      report.push({
        last4: row.e164?.slice(-4),
        e164: row.e164,
        provider,
        voiceEligible: false,
        reason: "not_telnyx_provider",
        dbProviderNumberId: row.providerNumberId,
      });
      continue;
    }

    const dbGet = row.providerNumberId
      ? await probeGet(row.providerNumberId)
      : { ok: false as const, notFound: true };
    const lookup = row.e164 ? await lookupTelnyxPhoneNumberId(row.e164) : null;
    const resolved = row.e164
      ? await resolveTelnyxPhoneNumberId({
          phoneNumber: row.e164,
          existingId: row.providerNumberId,
        })
      : null;

    const eligible = Boolean(resolved && (dbGet.ok || lookup));
    if (eligible) voiceReady += 1;

    report.push({
      last4: row.e164?.slice(-4),
      e164: row.e164,
      id: row.id,
      provider,
      status: row.status,
      dbProviderNumberId: row.providerNumberId,
      dbGetOk: dbGet.ok,
      dbGetNotFound: !dbGet.ok && dbGet.notFound,
      lookupId: lookup,
      resolvedId: resolved,
      voiceEligible: eligible,
      staleDbId: Boolean(
        row.providerNumberId && resolved && row.providerNumberId !== resolved,
      ),
    });
  }

  const summary = {
    total: rows.length,
    telnyx: telnyxCount,
    twilio: twilioCount,
    telnyxVoiceReady: voiceReady,
    recommendedForVoiceSwitchTest: report.filter(
      (r) => (r as { voiceEligible?: boolean }).voiceEligible,
    ),
  };

  console.log(JSON.stringify({ summary, numbers: report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
