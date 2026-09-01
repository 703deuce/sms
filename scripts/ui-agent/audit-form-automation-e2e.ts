/**
 * Deep E2E checks for Form Builder + Automation wiring.
 * Run: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3456 npx tsx scripts/ui-agent/audit-form-automation-e2e.ts
 */
import { chromium } from "playwright";
import { authenticateKimiAudit } from "./kimi-audit-auth";
import { definitionToKimi, kimiToDefinition } from "../../src/components/kimi/automations/definition-bridge";
import type { AutomationDefinition } from "../../src/lib/automations/types";
import { parseFormLayout } from "../../src/lib/forms/layout";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3456";

type Check = { name: string; run: () => Promise<string | null> };

const UNIT_CHECKS: Check[] = [
  {
    name: "bridge-opt-in-5way-roundtrip",
    run: async () => {
      const def: AutomationDefinition = {
        version: 1,
        nodes: [
          {
            id: "t1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { blockType: "customer_added", label: "Contact Created", config: {} },
          },
          {
            id: "c1",
            type: "logic",
            position: { x: 200, y: 0 },
            data: { blockType: "condition_sms_opt_in_status", label: "Opt-In", config: {} },
          },
        ],
        edges: [
          { id: "e1", source: "t1", target: "c1", sourceHandle: "default" },
          { id: "e2", source: "c1", target: "t1", sourceHandle: "subscribed" },
          { id: "e3", source: "c1", target: "t1", sourceHandle: "blocked" },
        ],
      };
      const kimi = definitionToKimi(def);
      const optIn = kimi.nodes.find((n) => n.itemId === "c-optin");
      if (!optIn) return "opt-in node missing from kimi conversion";
      if (optIn.outputs.length < 5) return `opt-in expected 5+ outputs, got ${optIn.outputs.length}`;
      const back = kimiToDefinition(kimi.nodes, kimi.edges, def);
      const handles = back.edges.filter((e) => e.source === "c1").map((e) => e.sourceHandle);
      if (!handles.includes("subscribed") || !handles.includes("blocked")) {
        return `handles lost after roundtrip: ${handles.join(",")}`;
      }
      return null;
    },
  },
  {
    name: "bridge-split-traffic-dynamic",
    run: async () => {
      const def: AutomationDefinition = {
        version: 1,
        nodes: [
          {
            id: "a1",
            type: "action",
            position: { x: 0, y: 0 },
            data: {
              blockType: "split_traffic",
              label: "Split",
              config: { pathCount: 3, percentages: [34, 33, 33] },
            },
          },
        ],
        edges: [
          { id: "e1", source: "a1", target: "a1", sourceHandle: "path_b" },
        ],
      };
      const kimi = definitionToKimi(def);
      const split = kimi.nodes[0];
      if (split.outputs.length < 3) return `split traffic expected 3 paths, got ${split.outputs.length}`;
      const back = kimiToDefinition(kimi.nodes, kimi.edges, def);
      if (back.edges[0]?.sourceHandle !== "path_b") return "split path_b handle lost";
      return null;
    },
  },
  {
    name: "form-layout-style-parse",
    run: async () => {
      const raw = {
        version: 1,
        formType: "embed",
        blocks: [
          {
            id: "h1",
            type: "header",
            props: { content: "Hi", style: { color: "#ff0000", fontSize: 24, textAlign: "center" } },
          },
        ],
      };
      const parsed = parseFormLayout(raw);
      if (!parsed) return "parseFormLayout returned null";
      if (parsed.blocks[0]?.props?.style?.color !== "#ff0000") return "style color not parsed";
      if (parsed.blocks[0]?.props?.style?.fontSize !== 24) return "style fontSize not parsed";
      return null;
    },
  },
  {
    name: "bridge-wait-reply-dynamic",
    run: async () => {
      const def: AutomationDefinition = {
        version: 1,
        nodes: [
          {
            id: "w1",
            type: "logic",
            position: { x: 0, y: 0 },
            data: {
              blockType: "wait_for_reply",
              label: "Wait",
              config: { extractData: true, dataType: "email" },
            },
          },
        ],
        edges: [],
      };
      const kimi = definitionToKimi(def);
      const outputs = kimi.nodes[0]?.outputs || [];
      const ids = outputs.map((o) => o.outcomeId);
      if (!ids.includes("email_found") && !ids.includes("reply_no_email")) {
        return `expected email extraction outcomes, got ${ids.join(",")}`;
      }
      return null;
    },
  },
];

async function runUiChecks(page: import("playwright").Page): Promise<Array<{ name: string; error: string }>> {
  const failures: Array<{ name: string; error: string }> = [];

  async function check(name: string, fn: () => Promise<string | null>) {
    try {
      const err = await fn();
      if (err) failures.push({ name, error: err });
      else console.log(`  ✓ ${name}`);
    } catch (e) {
      failures.push({ name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  await check("ui-form-builder-style-canvas", async () => {
    await page.goto(`${BASE}/grow/forms`, { waitUntil: "networkidle", timeout: 90000 });
    const createRes = page.waitForResponse(
      (r) => r.url().includes("/api/growth/forms") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Create Web Form/i }).click();
    const res = await createRes;
    const json = await res.json();
    const formId = json.data?.id as string | undefined;
    if (!formId) return "could not create form";

    await page.waitForSelector("text=Create Form", { timeout: 30000 });
    await page.locator(".tv-landing-form h2").first().click();
    await page.waitForTimeout(400);
    const colorInput = page.locator('input[type="color"]').first();
    await colorInput.waitFor({ state: "visible", timeout: 15000 });
    await colorInput.fill("#00ff00");

    const saveBtn = page.getByRole("button", { name: /^Save$/i });
    await saveBtn.click();
    await page.waitForTimeout(1500);

    const style = await page.evaluate(async (id) => {
      const r = await fetch(`/api/growth/forms/${id}`);
      const j = await r.json();
      const blocks = j.data?.config?.layout?.blocks || [];
      const h = blocks.find((b: { type: string }) => b.type === "header");
      return h?.props?.style?.color as string | undefined;
    }, formId);

    if (style !== "#00ff00") return `header color not saved (got ${style ?? "null"})`;
    return null;
  });

  await check("ui-form-palette-add-header", async () => {
    await page.goto(`${BASE}/grow/forms`, { waitUntil: "networkidle", timeout: 90000 });
    const createRes = page.waitForResponse(
      (r) => r.url().includes("/api/growth/forms") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Create Web Form/i }).click();
    await createRes;
    await page.waitForSelector("text=Create Form", { timeout: 30000 });

    await page.getByRole("button", { name: /Design/i }).click();
    await page.waitForTimeout(300);
    await page.locator(".tv-element-tile").filter({ hasText: "Header" }).click();
    await page.waitForTimeout(300);

    const count = await page.locator(".tv-landing-form h2").count();
    if (count < 2) return `expected 2+ headers after palette add, got ${count}`;
    return null;
  });

  await check("ui-automation-builder-loads", async () => {
    const flowId = await page.evaluate(async () => {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `E2E Flow ${Date.now()}` }),
      });
      const json = await res.json();
      return json.data?.id as string | undefined;
    });
    if (!flowId) return "could not create automation";

    await page.goto(`${BASE}/automations/${flowId}/edit`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForSelector("text=Create Workflow", { timeout: 30000 });

    const paletteItem = page.locator(".palette-tile").filter({ hasText: /Send Message/i }).first();
    if ((await paletteItem.count()) === 0) {
      await page.getByRole("button", { name: /^Actions$/i }).click();
      await page.waitForTimeout(300);
    }
    await page.locator(".palette-tile").filter({ hasText: /Send Message/i }).first().click();
    await page.waitForTimeout(500);

    const nodes = await page.locator(".node-card").count();
    if (nodes < 1) return "no nodes on canvas after add";

    await page.locator(".node-card").first().hover();
    await page.locator(".node-card").first().locator("button").nth(1).click();
    await page.waitForSelector("text=Configure this step", { timeout: 10000 });

    const bodyField = page.locator("#sms-body");
    await bodyField.waitFor({ state: "visible", timeout: 10000 });
    await bodyField.fill("E2E test message body");
    await page.locator(".drawer-enter").getByRole("button", { name: /^Save$/i }).click();
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /^Save$/i }).first().click();
    await page.waitForTimeout(1500);

    const body = await page.evaluate(async (id) => {
      const r = await fetch(`/api/automations/${id}`);
      const j = await r.json();
      const nodes = j.data?.definition?.nodes || [];
      const sms = nodes.find((n: { data?: { blockType?: string } }) => n.data?.blockType === "send_sms");
      return sms?.data?.config?.body as string | undefined;
    }, flowId);

    if (body !== "E2E test message body") {
      return `SMS body not persisted (got ${body ?? "null"})`;
    }
    return null;
  });

  await check("ui-automation-reload-preserves-nodes", async () => {
    const flowId = await page.evaluate(async () => {
      const definition = {
        version: 1,
        nodes: [
          {
            id: "t1",
            type: "trigger",
            position: { x: 60, y: 220 },
            data: { blockType: "customer_added", label: "Contact Created", config: { sources: ["Keyword"] } },
          },
          {
            id: "c1",
            type: "logic",
            position: { x: 300, y: 220 },
            data: { blockType: "condition_sms_opt_in_status", label: "Opt-In", config: {} },
          },
        ],
        edges: [
          { id: "e1", source: "t1", target: "c1", sourceHandle: "default" },
          { id: "e2", source: "c1", target: "t1", sourceHandle: "pending" },
        ],
      };
      const create = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Reload Flow ${Date.now()}`, definition }),
      });
      const json = await create.json();
      const id = json.data?.id as string;
      if (!id) return undefined;
      await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition }),
      });
      return id;
    });
    if (!flowId) return "setup failed";

    await page.goto(`${BASE}/automations/${flowId}/edit`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForSelector(".node-card", { timeout: 30000 });
    const count = await page.locator(".node-card").count();
    if (count < 2) return `expected 2 nodes after reload, got ${count}`;

    const handles = await page.evaluate(async (id) => {
      const r = await fetch(`/api/automations/${id}`);
      const j = await r.json();
      return (j.data?.definition?.edges || [])
        .filter((e: { source: string }) => e.source === "c1")
        .map((e: { sourceHandle?: string }) => e.sourceHandle);
    }, flowId);
    if (!handles.includes("pending")) return `pending handle missing: ${handles.join(",")}`;
    return null;
  });

  await check("ui-form-reload-persist-styles", async () => {
    const formId = await page.evaluate(async () => {
      const res = await fetch("/api/growth/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Reload Style ${Date.now()}` }),
      });
      const json = await res.json();
      return json.data?.id as string | undefined;
    });
    if (!formId) return "create form failed";

    const layout = {
      version: 1,
      formType: "embed",
      blocks: [
        {
          id: "h1",
          type: "header",
          props: { content: "Reload Test", style: { color: "#0000ff", fontSize: 30 } },
        },
        { id: "p1", type: "field", props: { fieldKey: "phone", placeholder: "Mobile" } },
        { id: "b1", type: "button", props: { content: "Go", style: { backgroundColor: "#ff00ff" } } },
      ],
    };
    await page.evaluate(
      async ({ id, layout }) => {
        await fetch(`/api/growth/forms/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout, fields: ["phone"] }),
        });
      },
      { id: formId, layout },
    );

    await page.goto(`${BASE}/grow/forms`, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(async (id) => {
      const rows = await fetch("/api/growth/forms").then((r) => r.json());
      const form = rows.data?.find((f: { id: string }) => f.id === id);
      if (!form) throw new Error("form not in list");
    }, formId);

    const style = await page.evaluate(async (id) => {
      const r = await fetch(`/api/growth/forms/${id}`);
      const j = await r.json();
      return j.data?.config?.layout?.blocks?.[0]?.props?.style?.color as string | undefined;
    }, formId);
    if (style !== "#0000ff") return `reload style failed (got ${style ?? "null"})`;
    return null;
  });

  await check("ui-automation-condition-config", async () => {
    const flowId = await page.evaluate(async () => {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Condition Flow ${Date.now()}` }),
      });
      const json = await res.json();
      return json.data?.id as string | undefined;
    });
    if (!flowId) return "create automation failed";

    await page.goto(`${BASE}/automations/${flowId}/edit`, { waitUntil: "networkidle", timeout: 90000 });
    await page.getByRole("button", { name: /^Conditions$/i }).click();
    await page.locator(".palette-tile").filter({ hasText: /Contact Field Matches/i }).first().click();
    await page.waitForTimeout(400);

    const conditionCard = page.locator(".node-card").last();
    await conditionCard.waitFor({ state: "visible", timeout: 10000 });
    await conditionCard.hover();
    await conditionCard.locator("button").nth(1).click();
    await page.waitForSelector("text=Configure this step", { timeout: 10000 });

    const operator = page.locator("select").filter({ has: page.locator('option[value="has_no_value"]') }).first();
    await operator.selectOption("has_no_value");
    await page.locator(".drawer-enter").getByRole("button", { name: /^Save$/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /^Save$/i }).first().click();
    await page.waitForTimeout(1500);

    const operatorSaved = await page.evaluate(async (id) => {
      const r = await fetch(`/api/automations/${id}`);
      const j = await r.json();
      const node = (j.data?.definition?.nodes || []).find(
        (n: { data?: { blockType?: string } }) => n.data?.blockType === "condition_customer_field",
      );
      return node?.data?.config?.operator as string | undefined;
    }, flowId);
    if (operatorSaved !== "has_no_value") return `condition operator not saved (got ${operatorSaved ?? "null"})`;
    return null;
  });

  return failures;
}

async function main() {
  console.log("\n=== Form + Automation E2E Audit ===\n");
  const unitFailures: Array<{ name: string; error: string }> = [];

  for (const c of UNIT_CHECKS) {
    try {
      const err = await c.run();
      if (err) unitFailures.push({ name: c.name, error: err });
      else console.log(`  ✓ ${c.name}`);
    } catch (e) {
      unitFailures.push({ name: c.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await authenticateKimiAudit(page, BASE);

  console.log("\nUI checks:");
  const uiFailures = await runUiChecks(page);
  await browser.close();

  const all = [...unitFailures, ...uiFailures];
  console.log(`\nUnit: ${UNIT_CHECKS.length - unitFailures.length}/${UNIT_CHECKS.length}`);
  console.log(`UI: ${7 - uiFailures.length}/7`);
  console.log(`Total failures: ${all.length}`);
  if (all.length) {
    console.log("\nFailures:");
    for (const f of all) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log("\nAll E2E checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
