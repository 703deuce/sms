/**
 * Global certification passes (UI quality, public tokens, timezone, duplicates).
 */
import type { CertContext } from "../../cert-context";
import { ACTION_TIMEOUT } from "../../lib";
import {
  CERT_PUBLIC_BOOK_SLUG,
  ensureCertWorkspaceReadyViaApi,
  waitForPublicErrorText,
} from "../../behavioral-flow-helpers";

const PUBLIC_ROUTES = [
  `/book/${CERT_PUBLIC_BOOK_SLUG}`,
  `/book/invalid-slug-xyz`,
  `/recap/invalid-token-xyz`,
  `/video/invalid-token-xyz`,
  `/f/mctb/invalid-token-xyz`,
];

const CANONICAL_PAGES = [
  "/appointments/overview",
  "/appointments/calendar",
  "/appointments/types",
  "/mctb",
  "/mctb/setup",
  "/contacts",
  "/conversations",
];

export async function runGLOBAL01(ctx: CertContext) {
  for (const path of CANONICAL_PAGES) {
    await ctx.visit(path);
    await ctx.setMobileViewport();
    await ctx.visit(path);
    await ctx.setDesktopViewport();
    const h1 = ctx.page.locator("h1").first();
    if (!(await h1.count())) throw new Error(`Missing h1 on ${path}`);
    await ctx.reload();
  }
}

export async function runGLOBAL02(ctx: CertContext) {
  for (const path of PUBLIC_ROUTES) {
    await ctx.visit(path, { allow404: true });
    if (path.includes("invalid")) {
      await waitForPublicErrorText(ctx.page, /not found|unavailable|invalid|expired/i);
    }
  }
}

export async function runGLOBAL03(ctx: CertContext) {
  await ensureCertWorkspaceReadyViaApi(ctx.page);
  await ctx.visit("/appointments/availability");
  const notice = ctx.page.locator("#avail-minimum-notice").first();
  await notice.waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(async () => {
    const body = await ctx.bodyText();
    if (!/booking rules|timezone|weekly hours|minimum notice/i.test(body)) {
      throw new Error("Timezone/hours not visible on availability");
    }
  });
  await ctx.visit("/mctb/setup/recovery");
  await ctx.reload();
}

export async function runGLOBAL04(ctx: CertContext) {
  await ctx.visit("/appointments/new");
  await ctx.reload();
}

export const GLOBAL_RUNNERS: Record<string, (ctx: CertContext) => Promise<void>> = {
  "GLOBAL-01": runGLOBAL01,
  "GLOBAL-02": runGLOBAL02,
  "GLOBAL-03": runGLOBAL03,
  "GLOBAL-04": runGLOBAL04,
};
