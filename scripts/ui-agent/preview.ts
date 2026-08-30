import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { bundleReferencePreview } from "../../src/lib/ui-agent/preview-bundle";
import { generatedDirForSession } from "./generated-sandbox";
import { log } from "./logger";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

export { bundleReferencePreview } from "../../src/lib/ui-agent/preview-bundle";

export async function startPreviewServer(sessionId: string, port = 5174): Promise<{ url: string; close: () => Promise<void> }> {
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

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${port}`;
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
