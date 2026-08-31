/**
 * One-shot: scope all Kimi reference CSS under route wrapper classes.
 *   npx tsx scripts/ui-agent/scope-all-kimi-css.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scopeKimiCss } from "./scope-kimi-css";

const STYLES = join(process.cwd(), "src/styles/kimi");

const SLUG_TO_SCOPE: Record<string, string> = {
  "auto-replies": "kimi-auto-replies",
  campaigns: "kimi-campaigns",
  contacts: "kimi-contacts",
  "contacts-fields": "kimi-contacts-fields",
  "contacts-lists": "kimi-contacts-lists",
  conversations: "kimi-conversations",
  "grow-keywords": "kimi-grow-keywords",
  "grow-qr-codes": "kimi-grow-qr-codes",
  "grow-tap-to-join": "kimi-grow-tap-to-join",
  "messaging-media": "kimi-messaging-media",
  automations: "kimi-automations",
};

for (const [slug, scope] of Object.entries(SLUG_TO_SCOPE)) {
  const path = join(STYLES, `${slug}.css`);
  const raw = readFileSync(path, "utf8");
  const scoped = scopeKimiCss(raw, scope);
  writeFileSync(path, scoped, "utf8");
  console.log(`scoped ${slug}.css → .${scope}`);
}
