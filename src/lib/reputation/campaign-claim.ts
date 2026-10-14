/**
 * Atomic claim for campaign message sends.
 * Extracted so concurrency can be unit-tested without Twilio/Brevo.
 */

/** Minimal shape returned after a successful claim. */
export type ClaimedCampaignMessage = {
  id: string;
  recipient_id: string;
  channel: string;
  message_body?: string | null;
  subject?: string | null;
  [key: string]: unknown;
};

type LooseClaimClient = {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          select: (cols: string) => {
            maybeSingle: () => Promise<{ data: ClaimedCampaignMessage | null }>;
          };
        };
      };
    };
  };
};

/**
 * Claim a queued message by flipping status queued → sending only when still queued.
 * Returns the claimed row, or null if another worker won the race.
 */
export async function claimQueuedCampaignMessage(
  client: LooseClaimClient,
  messageId: string,
  claimTs: string
): Promise<ClaimedCampaignMessage | null> {
  const { data } = await client
    .from("review_request_messages")
    .update({ status: "sending", updated_at: claimTs })
    .eq("id", messageId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  return data;
}

/** In-memory claim store used by concurrency tests. */
export function createMemoryClaimStore(initialIds: string[]) {
  const status = new Map(initialIds.map((id) => [id, "queued" as string]));
  const rows = new Map(
    initialIds.map((id) => [
      id,
      {
        id,
        status: "queued",
        recipient_id: "r1",
        channel: "sms",
        message_body: "hi",
      } as ClaimedCampaignMessage,
    ])
  );

  let claimOps = 0;

  const client: LooseClaimClient = {
    from() {
      return {
        update(patch: Record<string, unknown>) {
          let idFilter: string | null = null;
          let statusFilter: string | null = null;
          const secondEq = {
            select() {
              return {
                async maybeSingle() {
                  claimOps++;
                  if (!idFilter) return { data: null };
                  const cur = status.get(idFilter);
                  if (statusFilter && cur !== statusFilter) return { data: null };
                  // Atomic compare-and-set simulation.
                  if (cur !== "queued") return { data: null };
                  status.set(idFilter, String(patch.status ?? "sending"));
                  const next = {
                    ...rows.get(idFilter)!,
                    ...patch,
                    status: String(patch.status ?? "sending"),
                  } as ClaimedCampaignMessage;
                  rows.set(idFilter, next);
                  return { data: next };
                },
              };
            },
          };
          const firstEq = {
            eq(col: string, val: unknown) {
              if (col === "status") statusFilter = String(val);
              return secondEq;
            },
          };
          return {
            eq(col: string, val: unknown) {
              if (col === "id") idFilter = String(val);
              return firstEq;
            },
          };
        },
      };
    },
  };

  return {
    client,
    getStatus: (id: string) => status.get(id) ?? null,
    sendingCount: () => [...status.values()].filter((s) => s === "sending").length,
    claimOps: () => claimOps,
  };
}
