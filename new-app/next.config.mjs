import path from "node:path";
import { fileURLToPath } from "node:url";

/** Standalone app root — do not widen build/tracing to the legacy SMS repo root. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
