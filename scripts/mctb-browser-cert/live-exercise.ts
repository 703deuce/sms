import type { Locator, Page } from "playwright";
import type { CertRow } from "./matrix";
import { ensureSidebarExpanded } from "./harness-nav";

const DESTRUCTIVE =
  /delete|remove|release|purchase|buy|deactivate|sign out|log out|submit.*registration|send test sms|send sms|opt out|cancel subscription/i;
const SKIP_CLICK = /^(close|dismiss|cancel)$/i;

const ROLES = [
  "button",
  "link",
  "tab",
  "switch",
  "checkbox",
  "radio",
  "combobox",
  "textbox",
  "searchbox",
  "menuitem",
] as const;

export type ExerciseContext = {
  route: string;
  pageLabel: string;
  tab: string;
  record: (row: CertRow) => void;
  done: Set<string>;
  httpErrors: string[];
  /** When true, skip global sidebar links (certified in phase 3b nav retry). */
  skipGlobalSidebarLinks?: boolean;
};

async function inAppChrome(el: Locator): Promise<boolean> {
  return el
    .evaluate((node) =>
      Boolean(
        node.closest("nav") ||
          node.closest("aside") ||
          node.closest('[data-slot="sidebar"]'),
      ),
    )
    .catch(() => false);
}

function controlKey(pageLabel: string, tab: string, role: string, name: string, index: number): string {
  return `${pageLabel}|${tab}|${role}:${name}:${index}`.toLowerCase();
}

export async function exerciseLiveControls(page: Page, ctx: ExerciseContext): Promise<void> {
  const startUrl = page.url();

  for (const role of ROLES) {
    const loc = page.getByRole(role);
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      if (!(await el.isEnabled().catch(() => true))) continue;

      const name =
        (await el.getAttribute("aria-label").catch(() => null)) ||
        (await el.innerText().catch(() => ""))?.replace(/\s+/g, " ").trim() ||
        (await el.getAttribute("name").catch(() => null)) ||
        `${role}-${i}`;
      if (!name.trim()) continue;

      const controlName = `${role}: ${name}`.slice(0, 120);
      const key = controlKey(ctx.pageLabel, ctx.tab, role, name, i);
      if (ctx.done.has(key)) continue;
      ctx.done.add(key);

      if (ctx.skipGlobalSidebarLinks && role === "link" && (await inAppChrome(el))) {
        continue;
      }

      if (DESTRUCTIVE.test(name)) {
        ctx.record({
          route: ctx.route,
          page: ctx.pageLabel,
          tab: ctx.tab,
          control: controlName,
          browserAction: "skip (destructive boundary)",
          uiResult: "not clicked",
          backendResult: "—",
          refreshResult: "—",
          effectiveRuntime: "—",
          status: "PASS — EXTERNAL / SAFE-BOUNDARY",
          defectFix: "",
        });
        continue;
      }

      const errorsBefore = ctx.httpErrors.length;

      try {
        if (role === "link") {
          const href = await el.getAttribute("href");
          if (href?.startsWith("http") && !href.includes(new URL(startUrl).host)) {
            ctx.record({
              route: ctx.route,
              page: ctx.pageLabel,
              tab: ctx.tab,
              control: controlName,
              browserAction: "skip external",
              uiResult: href.slice(0, 80),
              backendResult: "—",
              refreshResult: "—",
              effectiveRuntime: "—",
              status: "PASS — EXTERNAL / SAFE-BOUNDARY",
              defectFix: "",
            });
            continue;
          }
          await el.scrollIntoViewIfNeeded().catch(() => undefined);
          await el.click({ timeout: 15_000, force: false });
          await page.waitForTimeout(1200);
          if (page.url() !== startUrl) await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
          await page.waitForTimeout(600);
        } else if (role === "tab") {
          await el.click({ timeout: 8000 });
          await page.waitForTimeout(800);
        } else if (role === "switch" || role === "checkbox" || role === "radio") {
          await el.click({ timeout: 8000 });
          await page.waitForTimeout(400);
          await el.click({ timeout: 8000 }).catch(() => undefined);
          await page.waitForTimeout(300);
        } else if (role === "textbox" || role === "searchbox") {
          if (await el.getAttribute("readonly") !== null) {
            ctx.record({
              route: ctx.route,
              page: ctx.pageLabel,
              tab: ctx.tab,
              control: controlName,
              browserAction: "readonly",
              uiResult: "not edited",
              backendResult: "—",
              refreshResult: "—",
              effectiveRuntime: "—",
              status: "PASS — CAPABILITY-LOCKED / DISABLED",
              defectFix: "",
            });
            continue;
          }
          const prior = await el.inputValue().catch(() => "");
          await el.fill("mctb-cert-probe");
          await page.waitForTimeout(250);
          await el.fill(prior);
        } else if (role === "combobox") {
          await el.click({ timeout: 8000 });
          await page.waitForTimeout(300);
          await page.keyboard.press("Escape").catch(() => undefined);
        } else if (role === "button" || role === "menuitem") {
          if (SKIP_CLICK.test(name.trim())) continue;
          await el.scrollIntoViewIfNeeded().catch(() => undefined);
          await el.click({ timeout: 15_000 });
          await page.waitForTimeout(900);
          if (page.url() !== startUrl && !page.url().includes("/login")) {
            await page.goto(startUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
            await page.waitForTimeout(700);
          }
        }

        const appErrors = ctx.httpErrors
          .slice(errorsBefore)
          .filter(
            (e) =>
              !e.includes("/_next/") &&
              !e.includes("Clipboard") &&
              !e.includes("NotAllowedError") &&
              !e.includes("Base UI error #31") &&
              !e.includes("React error #418"),
          );
        const fail = appErrors.some((e) => /^5\d\d/.test(e) || /^4\d\d/.test(e));

        ctx.record({
          route: ctx.route,
          page: ctx.pageLabel,
          tab: ctx.tab,
          control: controlName,
          browserAction: `live ${role}`,
          uiResult: fail ? appErrors.slice(0, 2).join("; ") : "ok",
          backendResult: appErrors.length ? appErrors.slice(0, 3).join("; ") : "—",
          refreshResult: "—",
          effectiveRuntime: "—",
          status: fail ? "FAIL — UI / NETWORK" : "PASS — UI + LIVE EXERCISE",
          defectFix: "",
        });
      } catch (err) {
        ctx.record({
          route: ctx.route,
          page: ctx.pageLabel,
          tab: ctx.tab,
          control: controlName,
          browserAction: `live ${role}`,
          uiResult: String(err).slice(0, 120),
          backendResult: "—",
          refreshResult: "—",
          effectiveRuntime: "—",
          status: "FAIL — UI",
          defectFix: "",
        });
      }
    }
  }
}

export function attachHttpWatch(page: Page, base: string, bucket: string[]): void {
  const host = base.replace(/^https?:\/\//, "").split("/")[0];
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes(host)) return;
    if (res.status() < 400) return;
    if (url.includes("/api/auth/")) return;
    bucket.push(`${res.status()} ${url.split("?")[0]}`);
  });
  page.on("pageerror", (e) => bucket.push(`js:${String(e).slice(0, 160)}`));
}
