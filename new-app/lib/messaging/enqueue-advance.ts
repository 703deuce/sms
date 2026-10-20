/** No-op job enqueue until BullMQ workers are wired in new-app. */
export async function enqueueJob(_name: string, _payload: unknown): Promise<void> {
  return;
}
