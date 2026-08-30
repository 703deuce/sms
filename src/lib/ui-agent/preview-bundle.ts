import "server-only";

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GENERATED_ROOT = join(process.cwd(), ".ui-agent", "generated");

function generatedDirForSession(sessionId: string): string {
  return join(GENERATED_ROOT, sessionId);
}

export function bundleReferencePreview(sessionId: string): string {
  const dir = generatedDirForSession(sessionId);
  const entry = existsSync(join(dir, "page.tsx"))
    ? join(dir, "page.tsx")
    : existsSync(join(dir, "ReferencePage.tsx"))
      ? join(dir, "ReferencePage.tsx")
      : null;
  if (!entry) throw new Error("Generated reference missing page.tsx");

  const out = join(dir, "preview.bundle.js");
  execSync(
    `npx esbuild "${entry}" --bundle --outfile="${out}" --loader:.tsx=tsx --loader:.ts=ts --jsx=automatic --format=esm --external:react --external:react-dom`,
    { cwd: process.cwd(), stdio: "pipe" },
  );

  const shell = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kimi Reference Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="./reference.css" />
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <script type="module" src="./preview.bundle.js"></script>
</body>
</html>`;

  writeFileSync(join(dir, "index.html"), shell, "utf8");
  return join(dir, "index.html");
}
