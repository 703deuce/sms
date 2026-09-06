/**
 * Generate a Mode 4 Page Contract from existing code + approved inventory.
 *
 *   npm run ui:kimi-mode4-contract -- --target /appointments/calendar
 *   npm run ui:kimi-mode4-contract -- --id appointments-calendar
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";
import { getManifestEntryById, getManifestEntryByRoute, loadMode4Manifest } from "./mode4-manifest";
import { formatStandardsForKimi, loadStandardsPack } from "./mode4-standards-pack";
import { buildProjectManifest, manifestToPromptContext } from "./project-context";

const CONTRACTS_DIR = join(REPO_ROOT, ".ui-agent/mode4/contracts");

const HOOK_RE =
  /\b(use[A-Z][A-Za-z0-9_]*|useQuery|useMutation|useSWR)\b/g;
const ACTION_RE =
  /(?:onClick|onSubmit|handle[A-Z][A-Za-z0-9_]*)\s*[=:]/g;

function slugFromRoute(route: string): string {
  return route
    .replace(/^\//, "")
    .replace(/\[|\]/g, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "root";
}

function extractHooksAndActions(files: string[]): { hooks: string[]; actions: string[] } {
  const hooks = new Set<string>();
  const actions = new Set<string>();
  for (const file of files) {
    const abs = join(REPO_ROOT, file);
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, "utf8");
    let m: RegExpExecArray | null;
    while ((m = HOOK_RE.exec(source))) hooks.add(m[1]);
    while ((m = ACTION_RE.exec(source))) {
      const snippet = source.slice(m.index, m.index + 80).split("\n")[0];
      actions.add(snippet.trim());
    }
  }
  return {
    hooks: [...hooks].sort(),
    actions: [...actions].slice(0, 40).sort(),
  };
}

function defaultRequiredStates(archetype: string): string[] {
  const base = [
    "normal",
    "loading",
    "first-use empty",
    "no-results",
    "error",
    "partial/degraded",
  ];
  if (archetype === "Detail" || archetype === "Configuration") {
    base.push("success/updated", "permission/read-only", "disabled/restricted");
  }
  if (archetype === "List" || archetype === "Calendar") {
    base.push("permission/read-only");
  }
  return base;
}

function relevantStandards(archetype: string): string[] {
  const all = [
    "Governance",
    "IA & Navigation",
    "Page Architecture",
    "Visual Design System",
    "Accessibility",
    "Interaction/Keyboard/Focus",
    "Responsive/Reflow",
  ];
  if (archetype === "List" || archetype === "Calendar" || archetype === "Dashboard") {
    all.push("Table/Grid Semantics");
  }
  if (archetype === "Configuration" || archetype === "Builder" || archetype === "Public") {
    all.push("Forms/Input/Validation");
  }
  all.push("Date/Timezone", "Privacy/Consent", "Security/Authentication");
  return all;
}

export function buildPageContract(options: {
  route?: string;
  id?: string;
  includeStandards?: boolean;
}): string {
  const entry = options.id
    ? getManifestEntryById(options.id)
    : options.route
      ? getManifestEntryByRoute(options.route)
      : undefined;

  if (!entry) {
    throw new Error(
      `No approved Mode 4 manifest entry for ${options.id || options.route}. See docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md`,
    );
  }

  let manifestContext = "";
  let hooks: string[] = [];
  let actions: string[] = [];
  let apiContracts: string[] = [];

  if (entry.route !== "__foundation__") {
    const manifest = buildProjectManifest(entry.route);
    manifestContext = manifestToPromptContext(manifest);
    apiContracts = manifest.apiContracts;
    const extracted = extractHooksAndActions(manifest.targetFiles);
    hooks = extracted.hooks;
    actions = extracted.actions;
  }

  const chunks: string[] = [
    "PAGE CONTRACT — MODE 4",
    "",
    `Canonical page: ${entry.canonicalPath}`,
    `Route: ${entry.route}`,
    `Archetype: ${entry.archetype}`,
    `Manifest ID: ${entry.id}`,
    entry.v1Section ? `V1 spec: ${entry.v1Section}` : "",
    entry.notes ? `Notes: ${entry.notes}` : "",
    "",
    "Primary job:",
    `Rebuild this approved Transovo production surface with premium visual quality while preserving approved functionality, backend contracts, permissions, and states.`,
    "",
    "Required features:",
    "- Derive from approved feature inventory + existing implementation (below)",
    "- Every approved capability for this surface must remain represented",
    "- Reposition features per governance/IA when old placement was wrong",
    "- Do NOT reintroduce out-of-scope legacy product features",
    "",
    "Required states:",
    ...defaultRequiredStates(entry.archetype).map((s) => `- ${s}`),
    "",
    "Required backend/data contracts:",
    ...(apiContracts.length ? apiContracts.map((a) => `- ${a}`) : ["- (inspect target files — none auto-detected)"]),
    "",
    "Detected hooks (preserve wiring):",
    ...(hooks.length ? hooks.map((h) => `- ${h}`) : ["- (none detected — inspect components)"]),
    "",
    "Detected actions/handlers (preserve behavior):",
    ...(actions.length ? actions.map((a) => `- ${a}`) : ["- (none detected — inspect components)"]),
    "",
    "File ownership:",
    "Primary files Kimi may modify:",
    ...(entry.primaryFiles.length
      ? entry.primaryFiles.map((f) => `- ${f}`)
      : ["- (resolve at integration time)"]),
    "Shared files to consume (do not fork):",
    ...entry.sharedConsume.map((f) => `- ${f}`),
    "Shared files forbidden in this job:",
    ...(entry.sharedForbidden.length
      ? entry.sharedForbidden.map((f) => `- ${f}`)
      : ["- (none)"]),
    "",
    "Canonical terminology:",
    "- Appointment, Contact, Booking Type, Booking Page, Reminder Sequence, Workflow, Meeting, Payment",
    "- Use Transovo IA labels — never competitor product names",
    "",
    "Relevant standards:",
    ...relevantStandards(entry.archetype).map((s) => `- ${s}`),
    "",
    "EXISTING IMPLEMENTATION CONTEXT (functionality reference — visuals not authoritative):",
    manifestContext || "(foundation job — no route manifest)",
    "",
  ];

  if (options.includeStandards) {
    chunks.push(
      "FULL GOVERNING STANDARDS PACK:",
      formatStandardsForKimi(loadStandardsPack()),
    );
  }

  return chunks.filter(Boolean).join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const route = args.find((a) => a.startsWith("--target="))?.split("=").slice(1).join("=")
    ?? (args.includes("--target") ? args[args.indexOf("--target") + 1] : undefined);
  const id = args.find((a) => a.startsWith("--id="))?.split("=").slice(1).join("=")
    ?? (args.includes("--id") ? args[args.indexOf("--id") + 1] : undefined);
  const includeStandards = args.includes("--with-standards");
  const write = !args.includes("--stdout");

  const contract = buildPageContract({ route, id, includeStandards });
  const entry = id ? getManifestEntryById(id) : getManifestEntryByRoute(route!);
  const slug = entry ? entry.id : slugFromRoute(route || "unknown");

  if (write) {
    mkdirSync(CONTRACTS_DIR, { recursive: true });
    const outPath = join(CONTRACTS_DIR, `${slug}.md`);
    writeFileSync(outPath, contract, "utf8");
    console.log(`Page contract written → ${outPath}`);
    console.log(`(${contract.length} chars)`);
    return;
  }

  console.log(contract);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
