#!/usr/bin/env npx tsx
/**
 * @deprecated TeXML breaks AT&T no-answer forwards (SIP 480). Use Call Control instead:
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/mctb-fix-571-forward-pickup.ts --apply
 */
console.error(
  "\n❌ mctb-fix-571-texml-route is deprecated — TeXML cannot answer AT&T Diversion forwards in time.\n",
);
console.error(
  "Use Call Control event-only (same path as working 866):\n",
);
console.error(
  "  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-fix-571-forward-pickup.ts --apply\n",
);
process.exit(1);
