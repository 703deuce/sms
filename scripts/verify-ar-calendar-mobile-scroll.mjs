/**
 * Verifies the Opus main column scrolls on mobile for /appointment-reminders.
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/verify-ar-calendar-mobile-scroll.mjs
 */
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib.ts";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";

async function main() {
  const auth = await authenticate(BASE);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    storageState: auth.storageState,
  });
  await page.goto(`${BASE}/appointment-reminders?view=week`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await page.getByRole("heading", { level: 1, name: "Calendar" }).waitFor({ timeout: 90_000 });

  const before = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll("main div")].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
    });
    const best = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!best) return { ok: false, reason: "no_scrollable_region" };
    return {
      ok: true,
      scrollHeight: best.scrollHeight,
      clientHeight: best.clientHeight,
      className: best.className.slice(0, 120),
    };
  });

  if (!before.ok) {
    console.error("FAIL: could not find scrollable main region", before);
    process.exit(1);
  }

  const scrollResult = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll("main div")].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
    });
    const el = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!el) return { moved: false };
    const start = el.scrollTop;
    el.scrollTop = start + 400;
    return { moved: el.scrollTop > start + 50, scrollTop: el.scrollTop, start };
  });

  if (!scrollResult.moved) {
    console.error("FAIL: scrollTop did not advance", { before, scrollResult });
    process.exit(1);
  }

  const opsVisible = await page.getByText("Reminder operations").isVisible();
  const stripVisible = await page.getByRole("region", { name: "Activity and attention" }).isVisible();
  if (!opsVisible || !stripVisible) {
    console.error("FAIL: mobile context panel or activity strip not in page flow", {
      opsVisible,
      stripVisible,
    });
    process.exit(1);
  }

  console.log("PASS: mobile calendar scroll + stacked panels", { before, scrollResult, opsVisible, stripVisible });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
