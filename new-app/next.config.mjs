import path from "node:path";
import { fileURLToPath } from "node:url";

/** Standalone app root — do not widen build/tracing to the legacy SMS repo root. */
const appDir = path.dirname(fileURLToPath(import.meta.url));

const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: isCoolifyBuild || true,
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
