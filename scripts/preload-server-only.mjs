/**
 * Preload hook for CLI scripts that import modules marked `server-only`.
 * Usage: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx <script>
 */
import "./cloud-agent/preload-self-hosted-redis.mjs";
import Module from "node:module";

const originalLoad = Module._load;
// @ts-expect-error Node internal hook
Module._load = function (request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  // @ts-expect-error Node internal hook
  return originalLoad(request, parent, isMain);
};
