import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const newAppRoot = path.join(here, "..");
const repoRoot = path.join(newAppRoot, "..");

function resolveMonolithPath(subPath) {
  const base = path.join(repoRoot, "src", subPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return base;
}

export default {
  name: "monolith-alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const sub = args.path.slice(2);
      if (sub === "lib/db" || sub.startsWith("lib/db/")) {
        return { path: path.join(newAppRoot, "lib/monolith-shim/db.ts") };
      }
      return { path: resolveMonolithPath(sub) };
    });
  },
};
