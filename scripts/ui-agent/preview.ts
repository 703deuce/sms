import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { generatedDirForSession } from "./generated-sandbox";
import { log } from "./logger";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

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
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.3.1",
      "react-dom": "https://esm.sh/react-dom@18.3.1",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime"
    }
  }
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="./reference.css" />
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <script type="module">
    import React from "react";
    import { createRoot } from "react-dom/client";
    import ReferencePage from "./preview.bundle.js";
    const root = document.getElementById("root");
    const Page = ReferencePage.default || ReferencePage;
    if (root) createRoot(root).render(React.createElement(Page));
  </script>
</body>
</html>`;

  writeFileSync(join(dir, "index.html"), shell, "utf8");
  return join(dir, "index.html");
}

export async function startPreviewServer(
  sessionId: string,
  port = 0,
): Promise<{ url: string; close: () => Promise<void> }> {
  bundleReferencePreview(sessionId);
  const dir = generatedDirForSession(sessionId);

  const server = createServer((req, res) => {
    const urlPath = req.url?.split("?")[0] || "/";
    const filePath = urlPath === "/" ? "/index.html" : urlPath;
    const abs = join(dir, filePath.replace(/^\//, ""));
    if (!abs.startsWith(dir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!existsSync(abs)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = extname(abs);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(readFileSync(abs));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  const url = `http://127.0.0.1:${boundPort}`;
  log("preview server", url);
  return {
    url,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export async function runPreview(sessionId: string): Promise<void> {
  const { url, close } = await startPreviewServer(sessionId);
  log("preview ready", `Open ${url} — Ctrl+C to stop`);
  await new Promise(() => {});
  await close();
}
