import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const DRY_RUN = process.argv.includes("--dry-run");

type TelnyxPage<T> = { data?: T[]; meta?: { total_pages?: number } };

async function paginate<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<TelnyxPage<T>>(path, {
      query: { "page[number]": page, "page[size]": 100 },
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
  const prisma = getPrisma();
  const amy = await prisma.voiceAgent.findUnique({ where: { id: AMY_AGENT_ID } });
  let amyAssistantTexml: string | null = null;
  if (amy?.telnyxAssistantId) {
    const remote = await ai.getAssistant(amy.telnyxAssistantId).catch(() => null);
    amyAssistantTexml =
      (remote as { telephony_settings?: { default_texml_app_id?: string } })?.telephony_settings
        ?.default_texml_app_id?.trim() || null;
  }

  const keepIds = new Set<string>([
    MCTB_TEXML_DEFAULT_APP_ID,
    amyAssistantTexml || "",
    amy?.telnyxConnectionId?.trim() || "",
  ].filter(Boolean));

  const phones = await paginate<Record<string, unknown>>("/phone_numbers");
  const inUseConnectionIds = new Set(
    phones.map((p) => String(p.connection_id || "")).filter(Boolean),
  );

  for (const id of inUseConnectionIds) keepIds.add(id);

  const agents = await prisma.voiceAgent.findMany({
    where: { telnyxConnectionId: { not: null } },
    select: { id: true, name: true, telnyxConnectionId: true },
  });
  for (const a of agents) {
    const id = a.telnyxConnectionId?.trim();
    if (id) keepIds.add(id);
  }

  const texmlApps = await paginate<Record<string, unknown>>("/texml_applications");
  const toDelete = texmlApps.filter((app) => {
    const id = String(app.id || "");
    return id && !keepIds.has(id);
  });

  const report = {
    dryRun: DRY_RUN,
    keepIds: [...keepIds].sort(),
    keepDetails: texmlApps
      .filter((a) => keepIds.has(String(a.id || "")))
      .map((a) => ({
        id: a.id,
        name: a.friendly_name || a.application_name,
        voiceUrl: a.voice_url,
        hasNumber: inUseConnectionIds.has(String(a.id || "")),
      })),
    deleteCount: toDelete.length,
    deletePreview: toDelete.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.friendly_name || a.application_name,
    })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would delete ${toDelete.length} orphan TeXML apps`);
    return;
  }

  const deleted: Array<{ id: string; name: string; ok: boolean; error?: string }> = [];
  for (const app of toDelete) {
    const id = String(app.id || "");
    const name = String(app.friendly_name || app.application_name || id);
    try {
      await telnyxRequest(`/texml_applications/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      deleted.push({ id, name, ok: true });
      process.stdout.write(".");
    } catch (e) {
      deleted.push({
        id,
        name,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const remaining = await paginate<Record<string, unknown>>("/texml_applications");
  console.log(
    JSON.stringify(
      {
        deletedOk: deleted.filter((d) => d.ok).length,
        deletedFailed: deleted.filter((d) => !d.ok),
        remainingCount: remaining.length,
        remaining: remaining.map((a) => ({
          id: a.id,
          name: a.friendly_name || a.application_name,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
