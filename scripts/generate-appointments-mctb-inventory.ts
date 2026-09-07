/**
 * Source-driven route/API inventory for Appointments + MCTB certification.
 * Run: npx tsx scripts/generate-appointments-mctb-inventory.ts
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT_JSON = join(ROOT, "docs/.generated/appointments-mctb-route-inventory.json");

type RouteEntry = {
  product: "appointments" | "mctb" | "shared" | "public";
  kind: "page" | "api";
  path: string;
  file: string;
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, acc);
    } else if (name === "page.tsx" || name === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

function classifyAppRoute(file: string): RouteEntry | null {
  const rel = relative(join(ROOT, "src/app"), file);
  const parts = rel.split("/");
  const isApi = parts[0] === "api";
  const routeParts = parts.slice(0, -1);
  if (isApi) routeParts.shift();

  let path = "/" + routeParts.join("/");
  path = path
    .replace(/\((app|public)\)\//g, "")
    .replace(/\[([^\]]+)\]/g, ":$1");

  let product: RouteEntry["product"] = "shared";
  if (path.startsWith("/appointments") || path.startsWith("/book") || path.startsWith("/meetings") || path.startsWith("/video") || path.startsWith("/team") || path.startsWith("/routing") || path.startsWith("/waitlist") || path.startsWith("/recap")) {
    product = "appointments";
  } else if (path.startsWith("/mctb") || path.startsWith("/voice") || path.startsWith("/onboarding/mctb") || path.startsWith("/f/mctb") || path.includes("/mctb")) {
    product = "mctb";
  } else if (path.startsWith("/api/public/book") || path.startsWith("/api/public/appointments") || path.startsWith("/api/appointments")) {
    product = "appointments";
  } else if (path.startsWith("/api/mctb") || path.startsWith("/api/telnyx/voice/mctb") || path.startsWith("/api/public/mctb")) {
    product = "mctb";
  } else if (path.startsWith("/api/public") || path.startsWith("/book") || path.startsWith("/embed")) {
    product = "public";
  }

  return {
    product,
    kind: isApi ? "api" : "page",
    path,
    file: relative(ROOT, file),
  };
}

function loadTestScripts(): string[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  return Object.entries(pkg.scripts)
    .filter(([name, cmd]) => {
      const n = name.toLowerCase();
      const c = cmd.toLowerCase();
      return (
        n.includes("appointment") ||
        n.includes("mctb") ||
        n.includes("john") ||
        n.includes("notetaker") ||
        n.includes("transovo-video") ||
        n.includes("ai-transcription") ||
        n.includes("booking") ||
        n.includes("meeting")
      ) || (
        c.includes("test-appointment") ||
        c.includes("test-mctb") ||
        c.includes("test-appointments") ||
        c.includes("john-preprod") ||
        c.includes("notetaker") ||
        c.includes("transovo-video") ||
        c.includes("ai-transcription")
      );
    })
    .map(([name]) => name)
    .sort();
}

function main() {
  const appRoot = join(ROOT, "src/app");
  const files = walk(appRoot);
  const routes = files
    .map(classifyAppRoute)
    .filter((r): r is RouteEntry => r !== null)
    .filter((r) => r.product === "appointments" || r.product === "mctb" || r.product === "public")
    .sort((a, b) => a.path.localeCompare(b.path));

  const byProduct = {
    appointments: routes.filter((r) => r.product === "appointments"),
    mctb: routes.filter((r) => r.product === "mctb"),
    public: routes.filter((r) => r.product === "public"),
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      appointmentsPages: byProduct.appointments.filter((r) => r.kind === "page").length,
      appointmentsApis: byProduct.appointments.filter((r) => r.kind === "api").length,
      mctbPages: byProduct.mctb.filter((r) => r.kind === "page").length,
      mctbApis: byProduct.mctb.filter((r) => r.kind === "api").length,
      publicRoutes: byProduct.public.length,
    },
    routes: byProduct,
    testScripts: loadTestScripts(),
  };

  const outDir = join(ROOT, "docs/.generated");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT_JSON}`);
  console.log(JSON.stringify(payload.counts, null, 2));
  console.log(`Test scripts: ${payload.testScripts.length}`);
}

main();
