import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // BullMQ pulls Node builtins (net, child_process) — keep external when webpack is used.
  serverExternalPackages: ["bullmq", "ioredis"],
  // Coolify build VMs: limit parallel compile workers to reduce Turbopack peak RAM.
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
