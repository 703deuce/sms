#!/usr/bin/env node
/** One-off: patch deployed Next chunk so bridge listen tolerates EADDRINUSE (sibling listener). */
import fs from "node:fs";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: node patch-prod-bridge-chunk-eaddrinuse.mjs <chunk53047.js> [...]");
  process.exit(1);
}

const oldStr =
  'await new Promise((b,c)=>{_.listen(a,"0.0.0.0",()=>b()),_.on("error",c)})';
const newStr =
  'await new Promise((b,c)=>{_.listen(a,"0.0.0.0",()=>b()),_.on("error",d=>{d&&"EADDRINUSE"===d.code?b():c(d)})})';

for (const p of paths) {
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes(oldStr)) {
    console.log(p, "pattern missing (maybe already patched)");
    continue;
  }
  fs.writeFileSync(p, s.split(oldStr).join(newStr));
  console.log(p, "patched");
}
