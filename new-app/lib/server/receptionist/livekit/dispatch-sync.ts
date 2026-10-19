import "server-only";

/**
 * @deprecated Per-DID LiveKit dispatch removed — use `canonical-dispatch.ts`.
 * Kept as a thin alias so older imports fail loudly at typecheck if misused.
 */
export {
  ensureCanonicalV3SharedDispatchRule,
  pruneObsoleteDispatchRules,
  buildCanonicalV3DispatchAgentMetadata,
  isObsoletePerDidDispatchRuleName,
  OBSOLETE_PER_DID_DISPATCH_PREFIX,
} from "./canonical-dispatch";
