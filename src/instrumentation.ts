/**
 * Next.js instrumentation hook — intentionally empty of application imports.
 *
 * Node boot (Twilio, web-push, voice, MCTB reconcile) runs from
 * scripts/node-web-boot.ts via scripts/start-production.mjs, NOT here.
 * Importing backend modules from instrumentation pulls them into the
 * edge-instrumentation webpack graph and breaks `next build --webpack`.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
}
