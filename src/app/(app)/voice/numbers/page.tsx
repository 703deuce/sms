import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  enrichWorkspacePhoneWithMessagingStatus,
  loadWorkspaceAccessiblePhoneNumbers,
} from "@/lib/numbers/workspace-accessible-numbers";
import { getPlatformDemoPhoneRecord, isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
import Link from "next/link";

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

export default async function VoiceNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [numbers, platformDemoAuthorized, platformDemoPhone] = await Promise.all([
    loadWorkspaceAccessiblePhoneNumbers(workspaceId),
    isWorkspaceAuthorizedForPlatformDemoNumber(workspaceId),
    getPlatformDemoPhoneRecord(),
  ]);
  const numbersWithStatus = enrichWorkspacePhoneWithMessagingStatus(
    numbers,
    platformDemoAuthorized ? platformDemoPhone?.phoneNumberId : null,
  );

  return (
    <div>
      <PageHeader
        title="Numbers"
        description="Add, connect, and manage the phone numbers used for missed-call text back."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/numbers/buy"
              className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
            >
              Add number
            </Link>
            <Link
              href="/voice/numbers"
              className="inline-flex h-9 items-center rounded-[10px] border border-[#e5e7eb] px-4 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
            >
              Refresh list
            </Link>
          </div>
        }
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Messaging status</th>
              <th className="px-3 py-2 font-medium">Line status</th>
            </tr>
          </thead>
          <tbody>
            {numbersWithStatus.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-muted-foreground">
                  No numbers yet.{" "}
                  <Link href="/numbers/buy" className="font-semibold text-primary underline">
                    Add your first business number
                  </Link>{" "}
                  to start missed-call recovery.
                </td>
              </tr>
            ) : (
              numbersWithStatus.map((n) => (
                <tr key={n.id} className="border-b border-border/70">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{fmtPhone(n.e164)}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <p>{n.friendlyName || "—"}</p>
                      {n.source === "linked" ? (
                        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                          {n.sourceLabel || "Assigned to your workspace"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{n.type || "Local"}</td>
                  <td className="px-3 py-2">
                    <Link href="/compliance" className="underline-offset-2 hover:underline">
                      {n.messagingStatus?.label || n.a2pStatus || "Not started"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{n.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Choose which number runs missed-call text back in{" "}
        <Link href="/voice/setup" className="font-semibold text-primary underline">
          Setup
        </Link>
        . Switching numbers in Setup updates which line handles missed-call recovery. Complete{" "}
        <Link href="/compliance" className="font-semibold text-primary underline">
          Messaging Compliance
        </Link>{" "}
        before going live.
      </p>
    </div>
  );
}
