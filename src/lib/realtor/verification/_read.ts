import fs from "node:fs";
import path from "node:path";

export function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

export function projectFileExists(rel: string): boolean {
  return fs.existsSync(path.join(process.cwd(), rel));
}
