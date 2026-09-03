import { Suspense } from "react";
import { KimiKeywordsConnected } from "@/components/grow/kimi-keywords-connected";
import { mapApiKeywordToKimi } from "@/lib/growth/kimi-keywords-adapter";
import { getActiveWorkspaceId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export default async function Page() {
  const workspaceId = await getActiveWorkspaceId();
  const rows = workspaceId
    ? await getPrisma().keyword.findMany({
        where: { workspaceId },
        orderBy: { keyword: "asc" },
      })
    : [];

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-grow-keywords">
        <KimiKeywordsConnected initialKeywords={rows.map(mapApiKeywordToKimi)} />
      </div>
    </Suspense>
  );
}
