import { getPrisma } from "@/lib/db";

async function main() {
  const ws = await getPrisma().workspace.findUnique({
    where: { id: "ws_1" },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerUserId: true,
      customFieldsConfig: true,
    },
  });
  if (!ws) {
    console.log(JSON.stringify({ ok: false, reason: "ws_1 not found" }));
    return;
  }
  const settings = (ws.customFieldsConfig || {}) as Record<string, unknown>;
  const mctb = (settings.mctb || {}) as Record<string, unknown>;
  const billing = (settings.billing || {}) as Record<string, unknown>;

  const transovoControlledSignals = {
    adminTestAccount: mctb.adminTestAccount === true,
    unlimitedMctbTesting: mctb.unlimitedMctbTesting === true,
    adminUnlimitedBilling: billing.adminUnlimited === true,
    unlimitedCredits: billing.unlimitedCredits === true,
  };

  console.log(
    JSON.stringify(
      {
        workspaceId: ws.id,
        name: ws.name,
        slug: ws.slug,
        hasOwnerUser: Boolean(ws.ownerUserId),
        transovoControlledSignals,
        recommendation:
          transovoControlledSignals.adminTestAccount ||
          transovoControlledSignals.unlimitedMctbTesting
            ? "ws_1 appears Transovo-controlled (internal/test). OK for MCTB_PLATFORM_OWNER_WORKSPACE_ID."
            : "Review manually before using as platform owner.",
      },
      null,
      2,
    ),
  );
}

main();
