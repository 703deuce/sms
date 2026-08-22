/**
 * Set workspace consent mode + align platform 571 runtime (Pass 3 prep).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-set-workspace-consent-mode.ts --workspace-id <id> --mode existing_consent
 */
import { getPrisma } from "@/lib/db";
import { normalizeMctbConsentMode, MCTB_CONSENT_MODE_LABELS } from "@/lib/mctb/consent-mode";
import { saveMctbOnboardingState, loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { syncPlatformDemoConsentRuntime } from "@/lib/mctb/onboarding/platform-demo";

const args = process.argv.slice(2);
const workspaceId = args.includes("--workspace-id")
  ? args[args.indexOf("--workspace-id") + 1]
  : "cmt3m55zl0p2f5o1l16604i73";
const mode = normalizeMctbConsentMode(
  args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "existing_consent",
);

async function main() {
  const label = MCTB_CONSENT_MODE_LABELS[mode];
  console.log(`\n── Set consent mode: ${label.productCode} ──\n`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Mode:      ${mode} (${label.title})\n`);

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  if (!ws) {
    console.error("❌ Workspace not found");
    process.exit(1);
  }

  const cfg =
    ws.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        ...cfg,
        mctb: { ...mctb, consentMode: mode },
      },
    },
  });

  const state = await loadMctbOnboardingState(workspaceId);
  await saveMctbOnboardingState(workspaceId, { ...state, consentMode: mode });

  const { syncMctbConsentRouting } = await import("@/lib/mctb/consent-prompt/service");
  await syncMctbConsentRouting(workspaceId).catch(() => undefined);

  const platform = await syncPlatformDemoConsentRuntime(mode);
  console.log(`Workspace consentMode → ${mode}`);
  console.log(`Platform 571 action → ${platform.action}`);
  console.log("\n✅ Ready to test this consent mode on 571");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
