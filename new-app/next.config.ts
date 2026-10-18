import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Standalone app root — do not widen tracing or Turbopack root to the SMS repo.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
