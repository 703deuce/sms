/**
 * Deep functional audit — verifies API round-trips and feature wiring,
 * not just that pages load.
 */
import { chromium, type Page } from "playwright";
import { authenticateKimiAudit } from "./kimi-audit-auth";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3456";

type Check = { name: string; run: (page: Page) => Promise<string | null> };

const CHECKS: Check[] = [
  {
    name: "opt-in-messages-persist",
    run: async (page) => {
      const marker = `audit-optin-${Date.now()}`;
      const patch = await page.evaluate(async (body) => {
        const res = await fetch("/api/settings/messaging-runtime", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            optInMessagesJson: {
              optin: body,
              double: "double test",
              exists: "exists test",
              reoptin: "reoptin test",
            },
          }),
        });
        const json = await res.json();
        return { ok: res.ok, error: json.error };
      }, marker);
      if (!patch.ok) return `PATCH opt-in messages failed: ${patch.error}`;
      const got = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        return json.data?.optInMessagesJson?.optin as string | undefined;
      });
      if (got !== marker) return `opt-in message round-trip failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "inbox-tags-persist",
    run: async (page) => {
      const tagName = `AuditTag-${Date.now()}`;
      const patch = await page.evaluate(async (name) => {
        const res = await fetch("/api/settings/messaging-runtime", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboxTagsJson: [
              {
                id: `tag-${Date.now()}`,
                name,
                description: "audit",
                color: "#23ddcd",
                untagOnClose: false,
                created: new Date().toISOString(),
              },
            ],
          }),
        });
        const json = await res.json();
        return { ok: res.ok, error: json.error };
      }, tagName);
      if (!patch.ok) return `PATCH inbox tags failed: ${patch.error}`;
      const got = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        const rows = json.data?.inboxTagsJson as Array<{ name: string }> | undefined;
        return rows?.some((t) => t.name?.startsWith("AuditTag-")) ?? false;
      });
      if (!got) return "inbox tag round-trip failed";
      return null;
    },
  },
  {
    name: "office-hours-persist",
    run: async (page) => {
      const patch = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awayEnabled: true,
            awayMessage: "Outside hours audit",
            awayInsideMessage: "Inside hours audit",
            awayAlways: false,
            timezone: "America/Chicago",
            businessHoursJson: {
              mon: { start: "09:00", end: "17:00", enabled: true },
              tue: { start: "09:00", end: "17:00", enabled: true },
              wed: { start: "09:00", end: "17:00", enabled: false },
              thu: { start: "09:00", end: "17:00", enabled: true },
              fri: { start: "09:00", end: "17:00", enabled: true },
              sat: { start: "09:00", end: "17:00", enabled: false },
              sun: { start: "09:00", end: "17:00", enabled: false },
            },
          }),
        });
        const json = await res.json();
        return { ok: res.ok, error: json.error, data: json.data };
      });
      if (!patch.ok) return `PATCH office hours failed: ${patch.error}`;
      if (patch.data?.awayInsideMessage !== "Inside hours audit") {
        return `awayInsideMessage not persisted (got ${patch.data?.awayInsideMessage})`;
      }
      if (!patch.data?.businessHoursJson?.wed) return "businessHoursJson not persisted";
      return null;
    },
  },
  {
    name: "form-config-persist",
    run: async (page) => {
      const created = await page.evaluate(async () => {
        const res = await fetch("/api/growth/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Audit Form ${Date.now()}` }),
        });
        const json = await res.json();
        return { ok: res.ok, id: json.data?.id as string, error: json.error };
      });
      if (!created.ok || !created.id) return `create form failed: ${created.error}`;
      const headline = `Audit Headline ${Date.now()}`;
      const patched = await page.evaluate(
        async ({ id, headline }) => {
          const res = await fetch(`/api/growth/forms/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              headline,
              subheadline: "audit sub",
              buttonLabel: "Join",
              fields: ["phone", "firstName"],
              doubleOptIn: true,
              optInMessage: "Thanks for joining",
              doubleOptInMessage: "Reply YES",
            }),
          });
          const json = await res.json();
          return { ok: res.ok, error: json.error, config: json.data?.config };
        },
        { id: created.id, headline },
      );
      if (!patched.ok) return `patch form failed: ${patched.error}`;
      if (patched.config?.headline !== headline) return "form headline not persisted";
      if (patched.config?.optInMessage !== "Thanks for joining") return "form optInMessage not persisted";
      return null;
    },
  },
  {
    name: "qr-code-create-list",
    run: async (page) => {
      const name = `Audit QR ${Date.now()}`;
      const created = await page.evaluate(async (qrName) => {
        const res = await fetch("/api/growth/qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: qrName,
            targetUrl: "sms:?body=AUDIT",
            targetType: "keyword",
          }),
        });
        const json = await res.json();
        return { ok: res.ok, error: json.error };
      }, name);
      if (!created.ok) return `create QR failed: ${created.error}`;
      const listed = await page.evaluate(async (qrName) => {
        const res = await fetch("/api/growth/qr");
        const json = await res.json();
        const rows = (json.data || []) as Array<{ name: string }>;
        return rows.some((r) => r.name === qrName);
      }, name);
      if (!listed) return "created QR not found in list";
      return null;
    },
  },
  {
    name: "keyword-create-update",
    run: async (page) => {
      const kw = `AUDIT${Date.now()}`;
      const created = await page.evaluate(async (keyword) => {
        const res = await fetch("/api/growth/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword,
            confirmation: "welcome",
            autoReply: "thanks",
          }),
        });
        const json = await res.json();
        return { ok: res.ok, id: json.data?.id as string, error: json.error };
      }, kw);
      if (!created.ok || !created.id) return `create keyword failed: ${created.error}`;
      const updated = await page.evaluate(
        async ({ id, keyword }) => {
          const res = await fetch(`/api/growth/keywords/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ autoReply: "updated-reply", keyword }),
          });
          const json = await res.json();
          return { ok: res.ok, autoReply: json.data?.autoReply as string, error: json.error };
        },
        { id: created.id, keyword: kw },
      );
      if (!updated.ok) return `update keyword failed: ${updated.error}`;
      if (updated.autoReply !== "updated-reply") return "keyword autoReply not updated";
      return null;
    },
  },
  {
    name: "segment-list-membership-preview",
    run: async (page) => {
      const res = await page.evaluate(async () => {
        const r = await fetch("/api/contacts/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditions: { match: "all", rules: [{ field: "list", op: "exists" }] },
          }),
        });
        const json = await r.json();
        return { ok: r.ok, status: r.status, error: json.error, count: json.data?.count };
      });
      if (!res.ok) return `list membership preview failed (${res.status}): ${res.error}`;
      if (typeof res.count !== "number") return "preview count missing";
      return null;
    },
  },
  {
    name: "campaign-segmentId-ui",
    run: async (page) => {
      const seg = await page.evaluate(async () => {
        const res = await fetch("/api/contacts/segments");
        const json = await res.json();
        return (json.data || [])[0] as { id: string; name: string } | undefined;
      });
      if (!seg?.id) return null;
      await page.goto(`${BASE}/campaigns/new?segmentId=${encodeURIComponent(seg.id)}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      const draft = await page.evaluate(() => {
        const raw = localStorage.getItem("transovo-campaign-compose-draft");
        if (!raw) return null;
        try {
          return JSON.parse(raw) as { audience?: Array<{ type: string; id: string }> };
        } catch {
          return null;
        }
      });
      if (!draft?.audience?.some((a) => a.type === "segment" && a.id === seg.id)) {
        return "segmentId did not seed campaign audience in compose draft";
      }
      return null;
    },
  },
  {
    name: "qr-page-create-button",
    run: async (page) => {
      await page.goto(`${BASE}/grow/qr-codes`, { waitUntil: "networkidle", timeout: 90000 });
      const text = await page.locator("body").innerText();
      if (!/Create QR Code/i.test(text)) return "QR page missing Create QR Code button";
      if (/Create Keyword/i.test(text) && !/Create QR Code/i.test(text)) {
        return "QR page shows Create Keyword instead of Create QR Code";
      }
      return null;
    },
  },
  {
    name: "auto-replies-optin-page-loads",
    run: async (page) => {
      await page.goto(`${BASE}/auto-replies`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByRole("button", { name: /Opt-In Messages/i }).click();
      await page.waitForTimeout(500);
      const body = await page.locator("body").innerText();
      if (!/Opt-In Auto-Responses/i.test(body)) return "opt-in tab did not open";
      return null;
    },
  },
];

const UI_CHECKS: Check[] = [
  {
    name: "ui-opt-in-save",
    run: async (page) => {
      await page.goto(`${BASE}/auto-replies`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByRole("button", { name: /Opt-In Messages/i }).click();
      const marker = `ui-optin-${Date.now()}`;
      await page.locator(".msg-textarea").first().fill(marker);
      await page.getByRole("button", { name: "Save" }).first().click();
      await page.waitForTimeout(1500);
      const got = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        return json.data?.optInMessagesJson?.optin as string | undefined;
      });
      if (got !== marker) return `UI opt-in save failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "ui-office-hours-save",
    run: async (page) => {
      await page.goto(`${BASE}/auto-replies`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByRole("button", { name: /Inbox Auto-Response/i }).first().click();
      const marker = `ui-inside-${Date.now()}`;
      await page
        .locator(".msg-editor")
        .filter({ hasText: "Inside of Office Hours" })
        .locator("textarea")
        .fill(marker);
      await page.getByRole("button", { name: "Save" }).first().click();
      await page.waitForTimeout(1500);
      const got = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        return json.data?.awayInsideMessage as string | undefined;
      });
      if (got !== marker) return `UI office hours save failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "ui-compliance-keywords-save",
    run: async (page) => {
      await page.goto(`${BASE}/auto-replies`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByRole("button", { name: /^Compliance$/i }).click();
      const marker = `YES${Date.now()}`;
      await page
        .locator("label")
        .filter({ hasText: "Opt-in keywords" })
        .locator("xpath=../input")
        .first()
        .fill(marker);
      await page.getByRole("button", { name: "Save" }).first().click();
      await page.waitForTimeout(1500);
      const got = await page.evaluate(async () => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        return json.data?.optInKeywords as string | undefined;
      });
      if (!got?.includes(marker)) return `UI compliance keywords save failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "ui-inbox-tag-create",
    run: async (page) => {
      await page.goto(`${BASE}/conversations`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByText("Manage inbox tags").click();
      await page.getByRole("button", { name: "Create Tag" }).click();
      const tagName = `UITag-${Date.now()}`;
      await page.locator('input[placeholder="Refund"]').fill(tagName);
      await page.getByRole("button", { name: "Save" }).click();
      await page.waitForTimeout(1500);
      const got = await page.evaluate(async (name) => {
        const res = await fetch("/api/settings/messaging-runtime");
        const json = await res.json();
        const rows = json.data?.inboxTagsJson as Array<{ name: string }> | undefined;
        return rows?.some((t) => t.name === name) ?? false;
      }, tagName);
      if (!got) return "UI inbox tag create did not persist";
      return null;
    },
  },
  {
    name: "ui-form-messaging-save",
    run: async (page) => {
      await page.goto(`${BASE}/grow/forms`, { waitUntil: "networkidle", timeout: 90000 });
      const createPromise = page.waitForResponse(
        (r) => r.url().includes("/api/growth/forms") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: /Create Web Form/i }).click();
      const createRes = await createPromise;
      const createJson = await createRes.json();
      const formId = createJson.data?.id as string | undefined;
      if (!formId) return "could not create form for UI save test";
      await page.getByRole("button", { name: /Messaging/i }).click();
      const marker = `ui-form-optin-${Date.now()}`;
      await page
        .locator("label")
        .filter({ hasText: /^Opt-In Message$/ })
        .locator("xpath=ancestor::div[contains(@class,'space-y')][1]//textarea")
        .fill(marker);
      await page.getByRole("button", { name: "Save" }).click();
      await page.waitForTimeout(2000);
      const got = await page.evaluate(async ({ id, marker }) => {
        const res = await fetch(`/api/growth/forms/${id}`);
        const json = await res.json();
        return json.data?.config?.optInMessage as string | undefined;
      }, { id: formId, marker });
      if (got !== marker) return `UI form messaging save failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "ui-form-headline-save",
    run: async (page) => {
      await page.goto(`${BASE}/grow/forms`, { waitUntil: "networkidle", timeout: 90000 });
      const createPromise = page.waitForResponse(
        (r) => r.url().includes("/api/growth/forms") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: /Create Web Form/i }).click();
      const createRes = await createPromise;
      const formId = (await createRes.json()).data?.id as string | undefined;
      if (!formId) return "could not create form for headline test";
      const headline = `UI Headline ${Date.now()}`;
      await page
        .locator("label")
        .filter({ hasText: "Page Title" })
        .locator("xpath=../input")
        .fill(headline);
      await page.getByRole("button", { name: "Save" }).click();
      await page.waitForTimeout(2000);
      const got = await page.evaluate(async ({ id, headline }) => {
        const res = await fetch(`/api/growth/forms/${id}`);
        const json = await res.json();
        return json.data?.config?.headline as string | undefined;
      }, { id: formId, headline });
      if (got !== headline) return `UI form headline save failed (got ${got ?? "null"})`;
      return null;
    },
  },
  {
    name: "contact-phone-persist",
    run: async (page) => {
      const phone = `+1555${String(Date.now()).slice(-7)}`;
      const created = await page.evaluate(async (p) => {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName: "Audit", lastName: "Contact", phone: p, status: "SUBSCRIBED" }),
        });
        const json = await res.json();
        return { ok: res.ok, id: json.data?.id as string, error: json.error };
      }, phone);
      if (!created.ok || !created.id) return `create contact failed: ${created.error}`;
      const newPhone = `+1555${String(Date.now() + 1).slice(-7)}`;
      const patched = await page.evaluate(
        async ({ id, newPhone }) => {
          const res = await fetch(`/api/contacts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: newPhone }),
          });
          const json = await res.json();
          return { ok: res.ok, phone: json.data?.phone as string, error: json.error };
        },
        { id: created.id, newPhone },
      );
      if (!patched.ok) return `contact phone patch failed: ${patched.error}`;
      if (patched.phone !== newPhone) return `contact phone not updated (got ${patched.phone})`;
      return null;
    },
  },
  {
    name: "ui-grow-keyword-create",
    run: async (page) => {
      await page.goto(`${BASE}/grow/keywords`, { waitUntil: "networkidle", timeout: 90000 });
      await page.getByRole("button", { name: /Create Keyword/i }).click();
      const kw = `KW${Date.now()}`;
      await page.getByPlaceholder("e.g. JOIN").fill(kw);
      await page.locator("textarea.kw-input").first().fill("Thanks for joining!");
      const savePromise = page.waitForResponse(
        (r) => r.url().includes("/api/growth/keywords") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Save" }).click();
      const saveRes = await savePromise;
      if (!saveRes.ok()) return `grow keyword create API failed (${saveRes.status()})`;
      const listed = await page.evaluate(async (keyword) => {
        const res = await fetch("/api/growth/keywords");
        const json = await res.json();
        const rows = (json.data || []) as Array<{ keyword: string }>;
        return rows.some((r) => r.keyword === keyword);
      }, kw.toUpperCase());
      if (!listed) return "created keyword not found in list";
      return null;
    },
  },
  {
    name: "form-clone-optin-persist",
    run: async (page) => {
      const created = await page.evaluate(async () => {
        const res = await fetch("/api/growth/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Clone Source ${Date.now()}` }),
        });
        const json = await res.json();
        return { ok: res.ok, id: json.data?.id as string, error: json.error };
      });
      if (!created.ok || !created.id) return `create form failed: ${created.error}`;
      const optIn = `clone-optin-${Date.now()}`;
      const patched = await page.evaluate(
        async ({ id, optIn }) => {
          const res = await fetch(`/api/growth/forms/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ optInMessage: optIn, doubleOptInMessage: "Reply YES" }),
          });
          const json = await res.json();
          return { ok: res.ok, error: json.error };
        },
        { id: created.id, optIn },
      );
      if (!patched.ok) return `patch form failed: ${patched.error}`;
      const cloned = await page.evaluate(async (sourceId) => {
        const detail = await fetch(`/api/growth/forms/${sourceId}`);
        const detailJson = await detail.json();
        const create = await fetch("/api/growth/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Clone Copy ${Date.now()}` }),
        });
        const createJson = await create.json();
        const cloneId = createJson.data?.id as string;
        const patch = await fetch(`/api/growth/forms/${cloneId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            optInMessage: detailJson.data?.config?.optInMessage,
            doubleOptInMessage: detailJson.data?.config?.doubleOptInMessage,
          }),
        });
        const patchJson = await patch.json();
        return {
          ok: patch.ok,
          optInMessage: patchJson.data?.config?.optInMessage as string | undefined,
        };
      }, created.id);
      if (!cloned.ok) return "clone patch failed";
      if (cloned.optInMessage !== optIn) return "clone did not copy optInMessage";
      return null;
    },
  },
  {
    name: "tap-to-join-create",
    run: async (page) => {
      const kw = `TAP${Date.now()}`;
      const keyword = await page.evaluate(async (keyword) => {
        const res = await fetch("/api/growth/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, confirmation: "welcome", autoReply: "thanks" }),
        });
        const json = await res.json();
        return { ok: res.ok, id: json.data?.id as string, error: json.error };
      }, kw);
      if (!keyword.ok || !keyword.id) return `keyword create failed: ${keyword.error}`;
      const linkName = `Audit Tap ${Date.now()}`;
      const created = await page.evaluate(
        async ({ name, keywordId }) => {
          const res = await fetch("/api/growth/tap-to-join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, keywordId }),
          });
          const json = await res.json();
          return { ok: res.ok, id: json.data?.id as string, error: json.error };
        },
        { name: linkName, keywordId: keyword.id },
      );
      if (!created.ok || !created.id) return `tap-to-join create failed: ${created.error}`;
      const listed = await page.evaluate(async (name) => {
        const res = await fetch("/api/growth/tap-to-join");
        const json = await res.json();
        const rows = (json.data || []) as Array<{ name: string }>;
        return rows.some((r) => r.name === name);
      }, linkName);
      if (!listed) return "created tap-to-join link not in list";
      return null;
    },
  },
];

const ALL_CHECKS = [...CHECKS, ...UI_CHECKS];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures: string[] = [];

  await authenticateKimiAudit(page, BASE);

  for (const check of ALL_CHECKS) {
    try {
      const err = await check.run(page);
      if (err) failures.push(`${check.name}: ${err}`);
      else console.log(`  ✓ ${check.name}`);
    } catch (e) {
      failures.push(`${check.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await browser.close();

  console.log("\n=== Kimi Functional Audit ===\n");
  console.log(`Checks: ${ALL_CHECKS.length}`);
  console.log(`Failures: ${failures.length}`);

  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
