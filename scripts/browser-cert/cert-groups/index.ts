/**
 * Build go-live certification group flows from manifest + runners.
 */
import type { Page } from "playwright";
import type { BrowserFlow } from "../flows";
import type { CertStatus } from "../lib";
import { CertContext, configPageSaveReload } from "../cert-context";
import { CERT_GROUP_MANIFEST, type CertGroupManifest } from "./manifest";
import { APT_RUNNERS } from "./runners/appointments";
import { CROSS_RUNNERS } from "./runners/cross";
import { GLOBAL_RUNNERS } from "./runners/global";
import { MCTB_RUNNERS } from "./runners/mctb";

const ALL_RUNNERS: Record<string, (ctx: CertContext) => Promise<void>> = {
  ...APT_RUNNERS,
  ...MCTB_RUNNERS,
  ...CROSS_RUNNERS,
  ...GLOBAL_RUNNERS,
};

function batchIdFor(product: CertGroupManifest["product"]): string {
  switch (product) {
    case "appointments":
      return "CERT-APT";
    case "mctb":
      return "CERT-MCTB";
    case "cross":
      return "CERT-CROSS";
    default:
      return "CERT-GLOBAL";
  }
}

async function fallbackRunner(ctx: CertContext, group: CertGroupManifest) {
  if (!group.primaryRoute) {
    throw new Error(`${group.id}: no runner and no primaryRoute — implement cert group`);
  }
  const heading = /./;
  await configPageSaveReload(ctx, group.primaryRoute, heading, /save/i);
}

function buildRun(group: CertGroupManifest): (page: Page) => Promise<void> {
  return async (page) => {
    const ctx = new CertContext(page);
    const runner = ALL_RUNNERS[group.id];
    if (runner) await runner(ctx);
    else await fallbackRunner(ctx, group);
  };
}

export function certGroupToFlow(group: CertGroupManifest): BrowserFlow {
  const batchId = batchIdFor(group.product);
  if (group.blocked) {
    return {
      id: group.id,
      batchId,
      title: group.title,
      tier: "user-action",
      certGroup: true,
      static: { status: group.blocked as CertStatus, detail: group.title },
    };
  }
  return {
    id: group.id,
    batchId,
    title: group.title,
    tier: "user-action",
    certGroup: true,
    run: buildRun(group),
  };
}

export const CERT_GROUP_FLOWS: BrowserFlow[] = CERT_GROUP_MANIFEST.map(certGroupToFlow);

export const CERT_GROUP_BATCHES = [
  { id: "CERT-APT", title: "Go-live: Appointments (APT-01–69)" },
  { id: "CERT-MCTB", title: "Go-live: MCTB (MCTB-01–58)" },
  { id: "CERT-CROSS", title: "Go-live: Cross-product (CROSS-01–08)" },
  { id: "CERT-GLOBAL", title: "Go-live: Global passes (GLOBAL-01–04)" },
] as const;

export function resolveCertGroup(id: string): CertGroupManifest | undefined {
  return CERT_GROUP_MANIFEST.find((g) => g.id === id);
}

export { CERT_GROUP_MANIFEST, CERT_GROUP_IDS } from "./manifest";
export type { CertGroupManifest, CertProduct } from "./manifest";

export function certGroupsMissingRunners(): string[] {
  return CERT_GROUP_MANIFEST.filter((g) => !g.blocked && !ALL_RUNNERS[g.id] && !g.primaryRoute).map(
    (g) => g.id,
  );
}
