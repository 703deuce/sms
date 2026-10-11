/**
 * Structural Layout B reference (no Next server) — for environments where dev compile OOMs.
 * Output: /opt/cursor/artifacts/ar-layout-b-*-reference.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: system-ui, sans-serif; }
</style>
</head>
<body class="bg-zinc-50 text-zinc-900">
  <div class="flex min-h-screen flex-col p-5">
    <header class="mb-3 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">Calendar</h1>
      <div class="flex flex-1 max-w-xl items-center justify-end gap-2">
        <input class="h-9 flex-1 rounded-md border px-3 text-sm" placeholder="Search customer, title, phone…" />
        <span class="rounded-full border px-2 py-1 text-[11px] text-zinc-600">Sync Oct 11</span>
        <button class="h-9 rounded-md border px-3 text-sm">Sync</button>
      </div>
    </header>
    <div class="grid min-h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div>
            <p class="text-sm font-semibold">Oct 5 – 11, 2026</p>
            <p class="text-[11px] text-zinc-500">Week · America/New_York</p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <button class="rounded-md border px-2 py-1">Today</button>
            <button class="rounded-md border px-2 py-1">‹ ›</button>
            <span class="rounded-md bg-zinc-100 px-2 py-1 text-xs">Day · Week · Month</span>
            <span class="rounded-md border px-2 py-1 text-xs">All calendars ▾</span>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-3">
          <div class="grid min-w-[640px] grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] rounded-lg border">
            <div class="border-b bg-zinc-100"></div>
            ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>`<div class="border-b border-l px-2 py-3 text-center text-xs ${i===3?'bg-teal-50':''}"><div class="font-semibold text-zinc-500">${d}</div><div class="text-lg font-semibold">${5+i}</div></div>`).join("")}
            <div class="border-r bg-zinc-50 text-right text-[11px] text-zinc-500">
              ${["6 AM","9 AM","12 PM","3 PM","6 PM"].map(t=>`<div class="h-[52px] border-b pr-2 pt-1">${t}</div>`).join("")}
            </div>
            ${Array.from({length:7}).map((_,col)=>`<div class="relative border-l">
              ${col===3?`<div class="absolute inset-x-1 top-[104px] z-10 rounded-md border border-teal-300 bg-teal-50 px-2 py-1 text-xs"><div class="font-semibold">12:00 PM</div><div class="font-medium">Service Visit</div><div class="text-zinc-600">AR Live Cert</div></div>`:""}
            </div>`).join("")}
          </div>
        </div>
      </section>
      <aside class="hidden min-h-0 flex-col overflow-hidden rounded-xl border bg-white lg:flex" aria-label="Appointment context">
        <div class="border-b p-4">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Upcoming reminders</h2>
          <div class="mt-2 rounded-lg px-2 py-2 hover:bg-zinc-50">
            <p class="text-[13px] font-medium">AR Live Cert</p>
            <p class="text-[11px] text-zinc-500">24h before · SMS</p>
          </div>
          <h2 class="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent replies</h2>
          <p class="mt-2 text-xs text-zinc-500">No recent customer replies.</p>
        </div>
      </aside>
    </div>
  </div>
</body>
</html>`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = join(OUT_DIR, "ar-layout-b-reference.html");
  writeFileSync(htmlPath, HTML);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  const weekActivity = join(OUT_DIR, "ar-layout-b-desktop-week-activity-reference.png");
  await page.screenshot({ path: weekActivity, fullPage: false });

  await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (aside) {
      aside.innerHTML = `
        <div class="flex h-full flex-col">
          <div class="border-b px-4 py-3">
            <button class="text-xs text-teal-700">← Activity</button>
            <h2 class="mt-2 text-base font-semibold">Service Visit</h2>
            <p class="text-sm text-zinc-500">AR Live Cert</p>
            <div class="mt-2 flex gap-2 text-xs"><span class="rounded-full bg-teal-100 px-2 py-0.5">Scheduled</span></div>
          </div>
          <div class="border-b px-4 py-2 flex gap-2 text-xs">
            <span class="rounded bg-zinc-100 px-2 py-1">Details</span>
            <span class="rounded bg-zinc-200 px-2 py-1 font-medium">Reminders</span>
            <span class="rounded px-2 py-1">Activity</span>
          </div>
          <div class="flex-1 overflow-auto p-4 text-sm">
            <p class="font-medium">Reminders are on</p>
            <button class="mt-2 rounded-md border px-3 py-1.5 text-xs">Stop reminders</button>
            <p class="mt-4 text-xs text-zinc-500">24-hour reminder · Scheduled</p>
          </div>
        </div>`;
    }
  });
  const selected = join(OUT_DIR, "ar-layout-b-desktop-week-selected-reference.png");
  await page.screenshot({ path: selected, fullPage: false });
  await browser.close();
  console.log(`Wrote ${weekActivity}`);
  console.log(`Wrote ${selected}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
