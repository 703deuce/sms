import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BullMQ pulls Node builtins (net, child_process) — must stay external for webpack builds.
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
