/**
 * Kimi K3 visual review for V1 Automate surfaces:
 * AI Agents, Auto-Replies, Playbooks (+ wizard steps).
 *
 *   npm run v1:visual-review
 *   V1_REVIEW_BASE_URL=http://localhost:3456 npx tsx scripts/v1-automate-kimi-visual-review.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.V1_REVIEW_BASE_URL || process.env.SMS_REVIEW_BASE_URL || "http://localhost:3456";
const EMAIL = process.env.V1_REVIEW_EMAIL || process.env.SMS_REVIEW_EMAIL || "alex@harborhome.co";
const PASSWORD = process.env.V1_REVIEW_PASSWORD || process.env.SMS_REVIEW_PASSWORD || "demo1234";
const OUT_DIR = join(process.cwd(), ".v1-visual-review");
const KIMI_BASE = "https://api.moonshot.ai/v1";
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k3";

type CaptureTarget = {
  name: string;
  path: string;
  waitFor?: string;
  urlIncludes?: string;
  actions?: Array<{ type: "click"; selector: string } | { type: "wait"; ms: number }>;
};

const TARGETS: CaptureTarget[] = [
  { name: "ai-agents-list", path: "/ai-replies", waitFor: "text=AI Agents" },
  { name: "ai-agent-wizard-setup", path: "/ai-replies/new", waitFor: "text=Create AI agent" },
  {
    name: "ai-agent-wizard-trigger",
    path: "/ai-replies/new",
    waitFor: "text=Trigger condition",
    actions: [{ type: "click", selector: 'button:has-text("Next")' }, { type: "wait", ms: 600 }],
  },
  {
    name: "ai-agent-wizard-knowledge",
    path: "/ai-replies/new",
    waitFor: "text=Knowledge",
    actions: [
      { type: "click", selector: 'button:has-text("Next")' },
      { type: "wait", ms: 400 },
      { type: "click", selector: 'button:has-text("Next")' },
      { type: "wait", ms: 600 },
    ],
  },
  { name: "auto-replies-overview", path: "/auto-replies", waitFor: "text=Auto-Replies" },
  {
    name: "auto-replies-keywords",
    path: "/auto-replies",
    waitFor: "text=Keyword",
    actions: [{ type: "click", selector: 'button:has-text("Keywords")' }, { type: "wait", ms: 700 }],
  },
  { name: "playbooks-hub", path: "/playbooks", waitFor: "text=Playbooks" },
  { name: "playbook-broadcast", path: "/campaigns/new?playbook=broadcast", waitFor: "text=Campaign" },
];

const REVIEW_SYSTEM = `You are a senior SaaS product designer reviewing Transovo — an SMS marketing platform for small businesses.

Product context:
- Transovo helps businesses send campaigns, automate follow-ups, capture leads, and use AI to reply to texts
- V1 focuses on: Campaigns, Conversations, Playbooks (intent cards), Drip Campaigns, Auto-Replies, AI Agents
- Tone: friendly, professional, approachable — light emoji accents are welcome when they aid scanability

Judge against:
- intentional hierarchy and visual delight (not generic admin template)
- wizard step clarity (setup → trigger → knowledge → handoff → test/publish)
- playbook cards should feel inviting and action-oriented
- spacing, alignment, emoji usage (tasteful, not childish)
- empty states and CTAs

Return markdown with:
## Verdict (pass / needs work)
## Strengths
## Issues (specific, actionable)
## Priority fixes (top 3)`;

async function kimiReview(imagePath: string, label: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) throw new Error("KIMI_API_KEY is required");

  const b64 = readFileSync(imagePath).toString("base64");
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      temperature: 1,
      messages: [
        { role: "system", content: REVIEW_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Review this Transovo V1 automate screen: ${label}. Suggest polish for Mode 3 quality (dashboard/analytics tier).`,
            },
            { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kimi API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content || "(no response)";
}

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
  }
}

async function captureAll() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);

    for (const target of TARGETS) {
      console.log(`capturing ${target.name}…`);
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "networkidle" });
      if (target.urlIncludes && !page.url().includes(target.urlIncludes)) {
        throw new Error(`${target.name}: unexpected URL ${page.url()}`);
      }
      if (target.actions) {
        for (const action of target.actions) {
          if (action.type === "click") await page.click(action.selector);
          if (action.type === "wait") await page.waitForTimeout(action.ms);
        }
      }
      if (target.waitFor) {
        await page.waitForSelector(target.waitFor, { timeout: 20_000 });
      }
      await page.waitForTimeout(800);
      const file = join(OUT_DIR, `${target.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  → ${file}`);
    }
  } finally {
    await browser.close();
  }
}

async function reviewAll() {
  const reviews: Array<{ name: string; review: string }> = [];
  for (const target of TARGETS) {
    const file = join(OUT_DIR, `${target.name}.png`);
    console.log(`kimi review ${target.name}…`);
    const review = await kimiReview(file, target.name);
    reviews.push({ name: target.name, review });
    writeFileSync(join(OUT_DIR, `${target.name}-review.md`), review, "utf8");
  }
  const combined = reviews.map((r) => `# ${r.name}\n\n${r.review}`).join("\n\n---\n\n");
  writeFileSync(join(OUT_DIR, "combined-review.md"), combined, "utf8");
  console.log(`\nCombined: ${join(OUT_DIR, "combined-review.md")}`);
}

async function main() {
  const mode = process.argv[2] || "all";
  if (mode === "capture") return captureAll();
  if (mode === "review") return reviewAll();
  await captureAll();
  await reviewAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
