/**
 * Static full-shell preview: MCTB sidebar + Overview (no auth).
 * Run: npx tsx scripts/capture-mctb-overview-shell-preview.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const ARTIFACTS = "/opt/cursor/artifacts";

function readCss(path: string) {
  return readFileSync(path, "utf8").replace(/@import[^;]+;/g, "");
}

const brandTokens = readFileSync("src/components/mctb/shell/mctb-brand-tokens.css", "utf8");
const sidebarCss = readCss("src/components/mctb/shell/mctb-sidebar.css");
const neutralShell = readCss("src/components/mctb/shell/mctb-neutral-shell.css");
const homeCss = readFileSync("src/components/mctb/home/mctb-home.css", "utf8").replace(
  /@import[^;]+;/g,
  "",
);

const navItem = (label: string, active = false) =>
  `<a class="transovo-nav-item mctb-sidebar-nav-item" href="#" data-active="${active ? "true" : "false"}">
    <span class="mctb-sidebar-nav-icon" style="display:flex;align-items:center;justify-content:center;font-size:12px">◦</span>
    <span>${label}</span>
  </a>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MCTB Overview + Sidebar</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    ${brandTokens}
    ${neutralShell}
    ${sidebarCss}
    ${homeCss}
    .shell { display: flex; min-height: 100vh; }
    .workspace { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #f6f7f8; }
    .topbar {
      height: 54px; border-bottom: 1px solid #dde1e5; background: #f6f7f8;
      display: flex; align-items: center; padding: 0 20px; font-size: 15px; font-weight: 600; color: #0a0d12;
    }
    .preview-grid { display: grid; gap: 0.75rem; }
    @media (min-width: 1024px) {
      .preview-main { display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem; }
      .preview-bottom { display: grid; grid-template-columns: 7fr 5fr; gap: 0.75rem; margin-top: 0.75rem; }
    }
    .mctb-home-header-btn {
      display: inline-flex; height: 36px; align-items: center; padding: 0 16px;
      border-radius: 8px; border: 1px solid #dee2e6; background: #fff;
      font-size: 13px; font-weight: 500; color: var(--mctb-text-primary); text-decoration: none;
    }
    aside.transovo-sidebar { width: 204px; flex-shrink: 0; }
    .sidebar-logo {
      display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 16px;
      border-bottom: 1px solid #dde1e5;
    }
    .sidebar-logo-mark {
      width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--mctb-brand-ring); background: var(--mctb-brand-soft);
      color: var(--mctb-brand-strong); font-size: 11px; font-weight: 700;
    }
    .sidebar-logo-text { font-size: 15px; font-weight: 600; color: #0a0d12; }
    .sidebar-nav { padding: 4px 8px; flex: 1; }
  </style>
</head>
<body>
  <div class="product-theme shell" data-mctb-neutral-shell="true">
    <aside class="transovo-sidebar transovo-sidebar-soft-slate mctb-sidebar-shell" style="display:flex;flex-direction:column;height:100vh">
      <div class="sidebar-logo">
        <span class="sidebar-logo-mark">T</span>
        <span class="sidebar-logo-text">Transovo</span>
      </div>
      <nav class="sidebar-nav transovo-scroll">
        <p class="mctb-sidebar-section-label">Missed Call Text Back</p>
        ${navItem("Overview", true)}
        ${navItem("Missed Calls")}
        ${navItem("Conversations")}
        ${navItem("Voicemail")}
        ${navItem("Analytics")}
        ${navItem("Setup")}
        <p class="mctb-sidebar-section-label">Booking</p>
        ${navItem("Calendar")}
        ${navItem("Appointments")}
        ${navItem("Booking Setup")}
        ${navItem("Reminders")}
        ${navItem("Payments")}
        ${navItem("Integrations")}
      </nav>
      <div class="shrink-0 border-t" style="padding:8px">
        <div class="mctb-sidebar-footer-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:500;color:#0a0d12">Credits</span>
            <a class="mctb-sidebar-upgrade-link" href="#">Upgrade</a>
          </div>
          <div class="transovo-credits-bar" style="margin-top:6px;height:4px;border-radius:2px"><div class="transovo-credits-fill" style="width:62%;height:100%;border-radius:2px"></div></div>
        </div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">Missed Call Text Back</header>
      <div class="mctb-home" style="flex:1;min-height:0">
        <div class="mctb-home-inner preview-grid">
          <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h1 class="mctb-home-page-title" style="margin:0;font-size:24px;font-weight:600">Overview</h1>
                <span class="mctb-home-status-chip mctb-home-status-chip--active" role="status">
                  <span class="mctb-home-status-dot" aria-hidden></span> Active
                </span>
              </div>
              <p class="mctb-home-page-subtitle" style="margin:4px 0 0;font-size:14px">Missed-call recovery activity, replies, and setup health.</p>
            </div>
            <a class="mctb-home-header-btn" href="#">Manage setup</a>
          </header>
          <div class="mctb-home-kpi-strip">
            <a class="mctb-home-kpi" href="#"><span class="mctb-home-kpi-icon mctb-home-kpi-icon--neutral">📞</span><span><span class="mctb-home-kpi-label">Missed calls</span><span class="mctb-home-kpi-value" style="display:block">4</span><span class="mctb-home-kpi-sub">Today</span></span></a>
            <a class="mctb-home-kpi" href="#"><span class="mctb-home-kpi-icon mctb-home-kpi-icon--neutral">➤</span><span><span class="mctb-home-kpi-label">Recovery texts sent</span><span class="mctb-home-kpi-value" style="display:block">3</span><span class="mctb-home-kpi-sub">Today</span></span></a>
            <a class="mctb-home-kpi" href="#"><span class="mctb-home-kpi-icon mctb-home-kpi-icon--brand">💬</span><span><span class="mctb-home-kpi-label">Replies</span><span class="mctb-home-kpi-value" style="display:block">2</span><span class="mctb-home-kpi-sub">Today</span></span></a>
            <a class="mctb-home-kpi mctb-home-kpi--attention" href="#"><span class="mctb-home-kpi-icon mctb-home-kpi-icon--amber">!</span><span><span class="mctb-home-kpi-label">Need a reply</span><span class="mctb-home-kpi-value" style="display:block">1</span><span class="mctb-home-kpi-sub">Conversations</span></span></a>
          </div>
          <div class="preview-main">
            <section class="mctb-home-surface">
              <div class="mctb-home-section-head"><h2 class="mctb-home-section-title">Recent missed calls</h2><a class="mctb-home-link" href="#">View all →</a></div>
              <table class="mctb-home-table">
                <thead><tr><th>Caller</th><th>Missed</th><th>Recovery</th><th>Reply</th></tr></thead>
                <tbody>
                  <tr class="mctb-home-missed-row"><td><span class="mctb-home-caller-primary">Anthony Rivera</span></td><td class="mctb-home-cell--tertiary">2:14 PM</td><td class="mctb-home-cell--success">Sent</td><td class="mctb-home-cell--pending">Needs reply</td></tr>
                  <tr class="mctb-home-missed-row"><td><span class="mctb-home-caller-primary">(571) 555-0198</span></td><td class="mctb-home-cell--tertiary">11:02 AM</td><td class="mctb-home-cell--info">Delivered</td><td class="mctb-home-cell--secondary">No reply yet</td></tr>
                </tbody>
              </table>
            </section>
            <section class="mctb-home-surface">
              <div class="mctb-home-section-head"><h2 class="mctb-home-section-title">Needs attention</h2></div>
              <a class="mctb-home-attention-row" href="#"><div><p style="margin:0;font-size:13px;font-weight:600;color:var(--mctb-text-primary)">1 conversation needs a reply</p></div></a>
            </section>
          </div>
          <div class="preview-bottom">
            <section class="mctb-home-surface mctb-home-module">
              <div class="mctb-home-section-head"><h2 class="mctb-home-section-title">Recent conversations</h2><a class="mctb-home-link" href="#">Open inbox →</a></div>
              <div style="padding:12px 16px"><p style="margin:0;font-size:13px;font-weight:600">Anthony Rivera</p><p style="margin:2px 0 0;font-size:12px;color:var(--mctb-text-tertiary)">Yes — can I book for Thursday?</p></div>
            </section>
            <section class="mctb-home-surface mctb-home-module mctb-home-setup-module">
              <div class="mctb-home-section-head"><h2 class="mctb-home-section-title">Setup status</h2></div>
              <div class="mctb-home-setup-row"><span class="mctb-home-setup-label">Forwarding</span><span class="mctb-home-setup-value mctb-home-setup-value--ok">Verified</span></div>
              <div class="mctb-home-setup-row"><span class="mctb-home-setup-label">Recovery</span><span class="mctb-home-setup-value mctb-home-setup-value--brand">Active</span></div>
              <div class="mctb-home-footer-line"><span>Last 7 days: <span class="mctb-home-footer-metric">12</span> missed</span><a class="mctb-home-link" href="#">View analytics →</a></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const htmlPath = join(ARTIFACTS, "mctb-overview-shell-preview.html");
  writeFileSync(htmlPath, html);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const out = join(ARTIFACTS, "mctb-overview-with-sidebar-desktop.png");
  await page.screenshot({ path: out, fullPage: false });
  await browser.close();
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
