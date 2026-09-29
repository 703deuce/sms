import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";

const nav = buildMctbV1Nav();
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Getting Started"));
assert.equal(nav.find((i) => i.label === "Help")?.href, "/help");

const sidebar = readFileSync(
  join(process.cwd(), "src/newui-transplant/components/app/app-sidebar.tsx"),
  "utf8",
);
assert.doesNotMatch(sidebar, /Forwarding number not set/);

const topbar = readFileSync(join(process.cwd(), "src/newui-transplant/components/app/topbar.tsx"), "utf8");
assert.match(topbar, /MctbHeaderIdentity/);
assert.match(topbar, /href="\/help"/);

console.log("test-mctb-getting-started-shell: PASS");
