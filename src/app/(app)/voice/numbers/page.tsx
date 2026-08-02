import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";
import Link from "next/link";

export default async function VoiceNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const prisma = getPrisma();

  const [agents, numbers, assignments] = await Promise.all([
    prisma.voiceAgent.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        phoneNumberId: true,
        telnyxAssistantId: true,
      },
    }),
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      orderBy: { e164: "asc" },
      select: { id: true, e164: true, status: true, friendlyName: true },
    }),
    prisma.voiceAgentPhoneNumber.findMany({
      where: { workspaceId },
      select: {
        agentId: true,
        phoneNumberId: true,
        inboundEnabled: true,
        outboundEnabled: true,
        isDefault: true,
      },
    }),
  ]);

  type NumberRow = {
    id: string;
    e164: string;
    status: string;
    friendlyName: string | null;
  };
  type AssignRow = {
    agentId: string;
    phoneNumberId: string;
    inboundEnabled: boolean;
    outboundEnabled: boolean;
    isDefault: boolean;
  };
  type AgentRow = {
    id: string;
    name: string;
    status: string;
    phoneNumberId: string | null;
    telnyxAssistantId: string | null;
  };
  const numberById = new Map<string, NumberRow>(
    (numbers as NumberRow[]).map((n) => [n.id, n]),
  );
  const assignByAgent = new Map<string, AssignRow>(
    (assignments as AssignRow[]).map((a) => [a.agentId, a]),
  );
  const agentRows = agents as AgentRow[];

  return (
    <div>
      <PageHeader
        title="Voice phone numbers"
        description="Inbound AI routing uses the DID assigned to each published agent. Softphone/queue assignments still take priority when present."
        actions={
          <Link
            href="/numbers"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Open Phone Numbers
          </Link>
        }
      />
      <VoiceSubNav />

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Assigned DID</th>
              <th className="px-3 py-2 font-medium">Inbound AI join</th>
              <th className="px-3 py-2 font-medium">Telnyx assistant</th>
            </tr>
          </thead>
          <tbody>
            {agentRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No agents yet.{" "}
                  <Link href="/voice/agents/new" className="underline">
                    Create an agent
                  </Link>
                </td>
              </tr>
            ) : (
              agentRows.map((agent) => {
                const pn = agent.phoneNumberId
                  ? numberById.get(agent.phoneNumberId)
                  : null;
                const join = assignByAgent.get(agent.id);
                const joinPn = join ? numberById.get(join.phoneNumberId) : null;
                return (
                  <tr key={agent.id} className="border-b border-border/70">
                    <td className="px-3 py-2">
                      <Link
                        href={`/voice/agents/${agent.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {agent.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{agent.status}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {pn?.e164 || "—"}
                      {pn?.friendlyName ? (
                        <span className="ml-1 text-muted-foreground">
                          ({pn.friendlyName})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {joinPn ? (
                        <span className="font-mono text-xs">
                          {joinPn.e164}
                          {join?.inboundEnabled ? " · inbound on" : " · inbound off"}
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          Not synced — open agent Identity, save number, publish
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {agent.telnyxAssistantId || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Assign or change a number in the agent builder Identity section, then publish.
        Publishing syncs the inbound AI join table used by Telnyx Call Control.
      </p>
    </div>
  );
}
