import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // BullMQ pulls Node builtins (net, child_process) — keep external when webpack is used.
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
