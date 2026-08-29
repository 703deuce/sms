/**
 * Next.js server boot hook — runtime-neutral entry only.
 * Node-specific boot lives in instrumentation.node.ts (see Next.js instrumentation guide).
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerNodeInstrumentation } = await import("./instrumentation.node");
  await registerNodeInstrumentation();
}
