/**
 * Delete all Telnyx FQDN (LiveKit SIP) connections — read-only on SMS/messaging.
 *
 *   npm run cleanup:livekit-fqdn-connections -- --dry-run
 *   npm run cleanup:livekit-fqdn-connections
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const DRY_RUN = process.argv.includes("--dry-run");

type TelnyxPage<T> = { data?: T[]; meta?: { total_pages?: number } };

async function paginate<T>(path: string, query: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<TelnyxPage<T>>(path, {
      query: { ...query, "page[number]": page, "page[size]": 100 },
    });
    const batch = res.data || [];
    out.push(...batch);
    const totalPages = res.meta?.total_pages ?? 1;
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }
  return out;
}

async function main() {
  const phones = await paginate<Record<string, unknown>>("/phone_numbers");
  const fqdnConnections = await paginate<Record<string, unknown>>("/fqdn_connections");
  const allFqdns = await paginate<Record<string, unknown>>("/fqdns");

  const phoneConnectionIds = new Set(
    phones.map((p) => String(p.connection_id || "")).filter(Boolean),
  );

  const blocked = fqdnConnections.filter((c) =>
    phoneConnectionIds.has(String(c.id || "")),
  );

  if (blocked.length) {
    throw new Error(
      `Refusing to delete FQDN connections still assigned to numbers: ${blocked
        .map((c) => `${c.connection_name} (${c.id})`)
        .join(", ")}`,
    );
  }

  const plan = fqdnConnections.map((conn) => {
    const id = String(conn.id || "");
    const fqdns = allFqdns.filter((f) => String(f.connection_id || "") === id);
    return {
      connectionId: id,
      name: String(conn.connection_name || ""),
      active: conn.active,
      fqdnRecords: fqdns.map((f) => ({
        id: String(f.id || ""),
        fqdn: String(f.fqdn || ""),
      })),
    };
  });

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        fqdnConnectionCount: plan.length,
        plan,
      },
      null,
      2,
    ),
  );

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would delete ${plan.length} FQDN connections`);
    return;
  }

  const results: Array<{
    connectionId: string;
    name: string;
    fqdnsDeleted: number;
    ok: boolean;
    error?: string;
  }> = [];

  for (const item of plan) {
    try {
      for (const fqdn of item.fqdnRecords) {
        if (!fqdn.id) continue;
        await telnyxRequest(`/fqdns/${encodeURIComponent(fqdn.id)}`, { method: "DELETE" });
      }
      await telnyxRequest(`/fqdn_connections/${encodeURIComponent(item.connectionId)}`, {
        method: "DELETE",
      });
      results.push({
        connectionId: item.connectionId,
        name: item.name,
        fqdnsDeleted: item.fqdnRecords.length,
        ok: true,
      });
      process.stdout.write(".");
    } catch (e) {
      results.push({
        connectionId: item.connectionId,
        name: item.name,
        fqdnsDeleted: 0,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const remaining = await paginate<Record<string, unknown>>("/fqdn_connections");
  console.log(
    JSON.stringify(
      {
        deletedOk: results.filter((r) => r.ok).length,
        deletedFailed: results.filter((r) => !r.ok),
        remainingFqdnConnections: remaining.map((c) => ({
          id: c.id,
          name: c.connection_name,
        })),
      },
      null,
      2,
    ),
  );

  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
