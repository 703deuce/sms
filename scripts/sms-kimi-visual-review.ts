/**
 * Kimi visual review for SMS Dashboard + Analytics (all tabs).
 *
 *   npx tsx scripts/sms-kimi-visual-review.ts
 *   SMS_REVIEW_BASE_URL=http://localhost:3456 npx tsx scripts/sms-kimi-visual-review.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.SMS_REVIEW_BASE_URL || "http://localhost:3456";
const EMAIL = process.env.SMS_REVIEW_EMAIL || "alex@harborhome.co";
const PASSWORD = process.env.SMS_REVIEW_PASSWORD || "demo1234";
const OUT_DIR = join(process.cwd(), ".sms-visual-review");
const KIMI_BASE = "https://api.moonshot.ai/v1";
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k2.6";

type CaptureTarget = {
  name: string;
  path: string;
  waitFor?: string;
  urlIncludes?: string;
};

const TARGETS: CaptureTarget[] = [
  {
    name: "dashboard",
    path: "/sms/dashboard",
    waitFor: "text=Messaging Activity",
    urlIncludes: "/sms/dashboard",
  },
  {
    name: "analytics-overview",
    path: "/sms/analytics?tab=overview",
    waitFor: "text=Overview",
    urlIncludes: "/sms/analytics",
  },
  {
    name: "analytics-campaigns",
    path: "/sms/analytics?tab=campaigns",
    waitFor: "text=Campaign performance",
    urlIncludes: "/sms/analytics",
  },
  {
    name: "analytics-audience",
    path: "/sms/analytics?tab=audience",
    waitFor: "text=Subscriber growth",
    urlIncludes: "/sms/analytics",
  },
  {
    name: "analytics-messaging",
    path: "/sms/analytics?tab=messaging",
    waitFor: "text=Failure reasons",
    urlIncludes: "/sms/analytics",
  },
];

const REVIEW_SYSTEM = `You are a senior SaaS product designer reviewing SMS product UI screenshots.

Judge against:
- intentional hierarchy (not every metric in identical cards)
- professional spacing, alignment, density
- dashboard vs analytics purpose (dashboard = calm/at-a-glance; analytics = deep/structured)
- premium product feel (not generic admin template)
- readability of tables, charts, tabs
- empty states and loading behavior if visible

Return markdown with:
## Verdict (pass / needs work)
## Strengths
## Issues (specific, actionable — hierarchy/layout first, not just border-radius)
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
              text: `Review this SMS product screen: ${label}. This is AFTER implementation — identify remaining visual/IA problems.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Kimi API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
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
      const finalUrl = page.url();
      if (target.urlIncludes && !finalUrl.includes(target.urlIncludes)) {
        throw new Error(
          `${target.name}: expected URL to include ${target.urlIncludes}, got ${finalUrl}`,
        );
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
    console.log(`  → ${target.name}-review.md`);
  }

  const combined = reviews
    .map((r) => `# ${r.name}\n\n${r.review}`)
    .join("\n\n---\n\n");
  writeFileSync(join(OUT_DIR, "combined-review.md"), combined, "utf8");
  console.log(`\nCombined review: ${join(OUT_DIR, "combined-review.md")}`);
}

async function main() {
  const mode = process.argv[2] || "all";
  if (mode === "capture") {
    await captureAll();
    return;
  }
  if (mode === "review") {
    await reviewAll();
    return;
  }
  await captureAll();
  await reviewAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
