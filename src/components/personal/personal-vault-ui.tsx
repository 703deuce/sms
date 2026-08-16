"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import { formatPhone } from "@/lib/utils";
import {
  Archive,
  Clock,
  DollarSign,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  PersonalAsideCard,
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatCard,
  PersonalStatusBadge,
  pCard,
  pMuted,
} from "./personal-ui";

type VaultActivity = { id: string; text: string; at: string };

export function PersonalVaultUI({
  numbers,
  parked,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  parked: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [reactivateId, setReactivateId] = useState(
    initialNumberId && parked.some((n) => n.id === initialNumberId)
      ? initialNumberId
      : parked[0]?.id || "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parked;
    return parked.filter(
      (n) =>
        n.number.includes(q) ||
        n.friendlyName?.toLowerCase().includes(q) ||
        formatPhone(n.number).toLowerCase().includes(q),
    );
  }, [parked, search]);

  const activeToPark = numbers.filter((n) => n.serviceState !== "PARKED");
  const monthlyEst = numbers.reduce((s, n) => s + n.monthlyCost, 0);
  const activeCount = activeToPark.length;

  const activity: VaultActivity[] = parked.slice(0, 3).map((n) => ({
    id: n.id,
    text: `Number ${formatPhone(n.number)} vaulted`,
    at: n.parkedSince ? new Date(n.parkedSince).toLocaleDateString() : "Recently",
  }));

  async function reactivateSelected() {
    if (!reactivateId) return;
    setBusy("reactivate");
    setError(null);
    try {
      await runPersonalNumberAction(reactivateId, "reactivate");
      router.push(`/personal/forwarding?numberId=${reactivateId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reactivate number.");
    } finally {
      setBusy(null);
    }
  }

  async function removeFromVault(numberId: string) {
    if (
      !window.confirm(
        "Remove this number from your vault? It will return to active service in your account.",
      )
    ) {
      return;
    }
    setBusy(numberId);
    setError(null);
    try {
      await runPersonalNumberAction(numberId, "reactivate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove from vault.");
    } finally {
      setBusy(null);
    }
  }

  const addToVaultHref =
    activeToPark.length > 0 ? "/personal/numbers" : "/personal/numbers/premium";

  return (
    <PersonalPageWrap
      aside={
        <>
          <PersonalAsideCard title="Why use Number Vault?">
            <ul className="space-y-3">
              {[
                { icon: Lock, text: "Keep your numbers — don't lose a number you care about." },
                { icon: DollarSign, text: "Save on costs — low monthly vault pricing." },
                { icon: RefreshCw, text: "Instant reactivation when you need it again." },
              ].map((item) => (
                <li key={item.text} className="flex gap-2">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </PersonalAsideCard>
          <div className={pCard + " p-4"}>
            <h3 className="text-[13px] font-semibold text-[#111827]">Quick Reactivation</h3>
            {parked.length === 0 ? (
              <p className="mt-3 text-[12px] text-[#6b7280]">No vaulted numbers to reactivate.</p>
            ) : (
              <>
                <select
                  className="mt-3 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                  value={reactivateId}
                  onChange={(e) => setReactivateId(e.target.value)}
                >
                  {parked.map((n) => (
                    <option key={n.id} value={n.id}>
                      {formatPhone(n.number)} {n.friendlyName ? `· ${n.friendlyName}` : ""}
                    </option>
                  ))}
                </select>
                <PersonalPrimaryButton
                  className="mt-3 w-full"
                  disabled={!reactivateId || busy === "reactivate"}
                  onClick={reactivateSelected}
                >
                  {busy === "reactivate" ? "Reactivating…" : "Reactivate Number"}
                </PersonalPrimaryButton>
              </>
            )}
          </div>
          <PersonalAsideCard title="Need Help?">
            <p>Questions about vault pricing or reactivation?</p>
            <Link href="/contact" className="font-semibold text-[#6366f1]">Contact support</Link>
          </PersonalAsideCard>
        </>
      }
    >
      <PersonalPageHeader
        title="Number Vault"
        description="Keep your valuable phone numbers safe, even when not actively using them."
        actions={
          <>
            <Link href={addToVaultHref}>
              <PersonalPrimaryButton className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add to Vault
              </PersonalPrimaryButton>
            </Link>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                className="h-9 w-56 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-[13px] outline-none focus:border-[#6366f1] focus:bg-white"
                placeholder="Search your vault…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </>
        }
      />

      {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalStatCard
          label="Active Numbers"
          value={activeCount}
          sub="not in vault"
          icon={Shield}
        />
        <PersonalStatCard
          label="Monthly Cost Est."
          value={`$${monthlyEst.toFixed(2)}`}
          sub={`Based on ${numbers.length} numbers`}
          icon={DollarSign}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalStatCard
          label="Yearly cost"
          value="0"
          sub="Est. from yearly numbers"
          icon={Archive}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalStatCard
          label="Vaulted Numbers"
          value={parked.length}
          sub="Out of 5 limit"
          icon={Lock}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
      </div>

      <PersonalSection title="Vaulted Numbers">
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className={pMuted}>No numbers in your vault yet.</p>
            <Link href={addToVaultHref} className="mt-3 text-[13px] font-semibold text-[#6366f1]">
              {activeToPark.length > 0 ? "Park a number from My Numbers" : "Find a number to vault"}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-3 pr-3">Phone Number</th>
                  <th className="pb-3 pr-3">Plan</th>
                  <th className="pb-3 pr-3">Monthly Fee</th>
                  <th className="pb-3 pr-3">Renewal Date</th>
                  <th className="pb-3 pr-3">Incoming calls</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Last Activity</th>
                  <th className="pb-3 pr-3">Usage</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((n) => (
                  <tr key={n.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-[#111827]">{formatPhone(n.number)}</p>
                      {n.friendlyName ? (
                        <p className="text-[11px] font-medium uppercase tracking-wide text-[#6366f1]">
                          {n.friendlyName}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-[#6b7280]">Vault</td>
                    <td className="py-3 pr-3 font-medium">${n.monthlyCost.toFixed(2)}</td>
                    <td className="py-3 pr-3 text-[#6b7280]">
                      {n.parkedSince ? new Date(n.parkedSince).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        className="h-8 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
                        value={n.vaultIncomingMode}
                        disabled={busy === n.id}
                        onChange={async (e) => {
                          const mode = e.target.value as "parked_message" | "voicemail";
                          setBusy(n.id);
                          setError(null);
                          try {
                            await runPersonalNumberAction(
                              n.id,
                              mode === "voicemail"
                                ? "set_vault_voicemail"
                                : "set_vault_message_only",
                            );
                            router.refresh();
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Could not update vault mode.",
                            );
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        <option value="parked_message">Parked message</option>
                        <option value="voicemail">Voicemail</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <PersonalStatusBadge status="protected" />
                      <p className="mt-1 text-[11px] text-[#9ca3af]">Vaulted</p>
                    </td>
                    <td className="py-3 pr-3 text-[#6b7280]">Vaulted</td>
                    <td className="py-3 pr-3 text-[#6b7280]">Low</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/personal/numbers/${n.id}`}
                          className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                          aria-label="Edit number"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-50"
                          aria-label="Remove from vault"
                          disabled={busy === n.id}
                          onClick={() => removeFromVault(n.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[12px] text-[#9ca3af]">
              Showing {filtered.length} of {parked.length} vaulted numbers
            </p>
          </div>
        )}
      </PersonalSection>

      <PersonalSection title="Recent Vault Activity" id="vault-activity">
        {activity.length === 0 ? (
          <p className={pMuted}>No vault activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-[13px]">
                <Archive className="mt-0.5 h-4 w-4 text-[#6366f1]" />
                <div>
                  <p className="text-[#111827]">{a.text}</p>
                  <p className="text-[11px] text-[#9ca3af] flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {a.at}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="#vault-activity" className="mt-3 text-[13px] font-semibold text-[#6366f1]">
          View all activity
        </Link>
      </PersonalSection>
    </PersonalPageWrap>
  );
}
