import { Suspense } from "react";
import { KimiContactsConnected } from "@/components/contacts/kimi-contacts-connected";
import { mapApiContactToKimi } from "@/lib/contacts/kimi-contacts-adapter";
import { loadContactStats, loadContacts, requireWorkspaceContext } from "@/lib/workspace-data";

export default async function ContactsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [contacts, stats] = await Promise.all([
    loadContacts(workspaceId),
    loadContactStats(workspaceId),
  ]);

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <div className="kimi-surface kimi-contacts">
        <KimiContactsConnected
          initialContacts={contacts.map(mapApiContactToKimi)}
          initialStats={{
            contacts: stats.total,
            subscribed: stats.subscribed,
            unsubscribed: stats.unsubscribed,
          }}
        />
      </div>
    </Suspense>
  );
}
