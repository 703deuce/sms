"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import type { VaultIncomingMode } from "@/lib/numbers/personal-call-settings";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import { formatPhone } from "@/lib/utils";
import {
  Archive,
  Clock,
  DollarSign,
  Lock,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  Voicemail,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PersonalMockBtn,
  PersonalMockFilterChips,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";

type VaultActivity = { id: string; text: string; at: string };
type ModeFilter = "All" | "Silent" | "Announcement" | "Voicemail" | "Porting";
type SortKey = "recent" | "name" | "cost";

function vaultModeLabel(mode: VaultIncomingMode): string {
  if (mode === "silent") return "Silent";
  if (mode === "voicemail") return "Voicemail";
  return "Announcement";
}

function modeFromChip(chip: ModeFilter): VaultIncomingMode | null {
  if (chip === "Silent") return "silent";
  if (chip === "Voicemail") return "voicemail";
  if (chip === "Announcement") return "parked_message";
  return null;
}

function nextRenewalDate(parkedSince: string | null): string {
  if (!parkedSince) return "—";
  const d = new Date(parkedSince);
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString();
}

function trendPct(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

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
  const [modeFilter, setModeFilter] = useState<ModeFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [localOnly, setLocalOnly] = useState(false);
  const [tollFreeOnly, setTollFreeOnly] = useState(false);
  const [manageId, setManageId] = useState<string | null>(
    initialNumberId && parked.some((n) => n.id === initialNumberId)
      ? initialNumberId
      : null,
  );
  const [modeDraft, setModeDraft] = useState<VaultIncomingMode>("silent");
  const [messageDraft, setMessageDraft] = useState("");
  const [portLocked, setPortLocked] = useState(true);
  const [callScreening, setCallScreening] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeToPark = numbers.filter((n) => n.serviceState !== "PARKED");
  const addToVaultHref =
    activeToPark.length > 0 ? "/personal/numbers" : "/personal/numbers/premium";

  const monthlyVaultCost = parked.reduce((s, n) => s + n.monthlyCost, 0);
  const voicemailEnabledCount = parked.filter(
    (n) => n.vaultIncomingMode === "voicemail" || n.voicemailEnabled,
  ).length;
  const actionRequiredCount = parked.filter(
    (n) => n.portAwayExpiresAt || n.serviceState === "PORT_AWAY_WINDOW",
  ).length;

  const managed = manageId ? parked.find((n) => n.id === manageId) : null;

  useEffect(() => {
    if (!managed) return;
    setModeDraft(managed.vaultIncomingMode);
    setMessageDraft(managed.parkedMessageText || "");
    setPortLocked(managed.portOutLocked);
    setCallScreening(managed.callScreeningEnabled);
  }, [managed]);

  const filtered = useMemo(() => {
    const modeTarget = modeFromChip(modeFilter);
    let list = [...parked];

    if (modeTarget) {
      list = list.filter((n) => n.vaultIncomingMode === modeTarget);
    } else if (modeFilter === "Porting") {
      list = list.filter(
        (n) => n.portAwayExpiresAt || n.serviceState.includes("PORT"),
      );
    }

    if (localOnly) list = list.filter((n) => n.type === "Local");
    if (tollFreeOnly) list = list.filter((n) => n.type === "Toll-free");

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.number.includes(q) ||
          n.friendlyName?.toLowerCase().includes(q) ||
          formatPhone(n.number).toLowerCase().includes(q),
      );
    }

    if (sortKey === "name") {
      list.sort((a, b) =>
        (a.friendlyName || a.number).localeCompare(b.friendlyName || b.number),
      );
    } else if (sortKey === "cost") {
      list.sort((a, b) => b.monthlyCost - a.monthlyCost);
    } else {
      list.sort((a, b) => {
        const ad = a.parkedSince ? new Date(a.parkedSince).getTime() : 0;
        const bd = b.parkedSince ? new Date(b.parkedSince).getTime() : 0;
        return bd - ad;
      });
    }

    return list;
  }, [parked, modeFilter, localOnly, tollFreeOnly, search, sortKey]);

  const activity: VaultActivity[] = parked
    .slice()
    .sort((a, b) => {
      const ad = a.parkedSince ? new Date(a.parkedSince).getTime() : 0;
      const bd = b.parkedSince ? new Date(b.parkedSince).getTime() : 0;
      return bd - ad;
    })
    .slice(0, 5)
    .map((n) => ({
      id: n.id,
      text: `Number ${formatPhone(n.number)} vaulted`,
      at: n.parkedSince ? new Date(n.parkedSince).toLocaleDateString() : "Recently",
    }));

  const protectionNumber = managed ?? parked[0];

  function openManage(id: string) {
    const row = parked.find((n) => n.id === id);
    if (!row) return;
    setManageId(id);
    setModeDraft(row.vaultIncomingMode);
    setMessageDraft(row.parkedMessageText || "");
    setPortLocked(row.portOutLocked);
    setCallScreening(row.callScreeningEnabled);
    setMenuOpenId(null);
  }

  async function saveManaged() {
    if (!manageId) return;
    setBusy("save");
    setError(null);
    try {
      if (modeDraft === "voicemail") {
        await runPersonalNumberAction(manageId, "set_vault_voicemail");
      } else if (modeDraft === "parked_message") {
        await runPersonalNumberAction(manageId, "set_vault_message_only");
      } else {
        await fetch(`/api/numbers/${manageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personalCallSettings: { vaultIncomingMode: "silent" } }),
        });
      }
      await fetch(`/api/numbers/${manageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalCallSettings: { parkedMessageText: messageDraft },
        }),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save vault settings.");
    } finally {
      setBusy(null);
    }
  }

  async function reactivateManaged() {
    if (!manageId) return;
    setBusy("reactivate");
    setError(null);
    try {
      await runPersonalNumberAction(manageId, "reactivate");
      setManageId(null);
      router.push(`/personal/forwarding?numberId=${manageId}`);
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
      if (manageId === numberId) setManageId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove from vault.");
    } finally {
      setBusy(null);
    }
  }

  async function togglePortLock(locked: boolean) {
    if (!protectionNumber) return;
    setBusy("port-lock");
    try {
      const res = await fetch(`/api/personal/numbers/${protectionNumber.id}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: locked ? "lock" : "unlock" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not update port-out lock.");
      }
      setPortLocked(locked);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update port-out protection.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleCallScreening(enabled: boolean) {
    if (!protectionNumber) return;
    setBusy("screening");
    try {
      const res = await fetch(`/api/numbers/${protectionNumber.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalCallSettings: { callScreeningEnabled: enabled } }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not update call screening.");
      }
      setCallScreening(enabled);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update call screening.");
    } finally {
      setBusy(null);
    }
  }

  const prevMonthVaulted = parked.filter((n) => {
    if (!n.parkedSince) return false;
    const d = new Date(n.parkedSince);
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d >= prev && d < new Date(now.getFullYear(), now.getMonth(), 1);
  }).length;
  const thisMonthVaulted = parked.filter((n) => {
    if (!n.parkedSince) return false;
    const d = new Date(n.parkedSince);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="relative">
      <PersonalMockPage>
        <PersonalMockHeader
          title="Number Vault"
          description="Keep valuable numbers secure while they're not actively in use."
          actions={
            <>
              <Link href={addToVaultHref}>
                <PersonalMockBtn>
                  <Plus className="h-4 w-4" />
                  Add to Vault
                </PersonalMockBtn>
              </Link>
              <Link href="/personal/porting">
                <PersonalMockBtn variant="outline">Port a Number In</PersonalMockBtn>
              </Link>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
                />
                <PersonalMockInput
                  className="w-56 bg-[#f9fafb] pl-9 focus:bg-white"
                  placeholder="Search numbers or names"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </>
          }
        />

        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PersonalMockKpi
            label="Vaulted Numbers"
            value={parked.length}
            sub="Out of 5 limit"
            icon={Lock}
            iconClass="bg-[#fff7ed] text-[#ea580c]"
            trend={trendPct(thisMonthVaulted, prevMonthVaulted)}
            trendLabel="vs last month"
          />
          <PersonalMockKpi
            label="Monthly Vault Cost"
            value={`$${monthlyVaultCost.toFixed(2)}`}
            sub={`${parked.length} vaulted line${parked.length === 1 ? "" : "s"}`}
            icon={DollarSign}
            iconClass="bg-[#ecfdf5] text-[#059669]"
          />
          <PersonalMockKpi
            label="Voicemail Enabled"
            value={voicemailEnabledCount}
            sub="On vaulted numbers"
            icon={Voicemail}
            iconClass="bg-[#eff6ff] text-[#2563eb]"
          />
          <PersonalMockKpi
            label="Action Required"
            value={actionRequiredCount}
            sub={actionRequiredCount > 0 ? "Review port or vault settings" : "All clear"}
            icon={Shield}
            iconClass={
              actionRequiredCount > 0
                ? "bg-[#fffbeb] text-[#d97706]"
                : "bg-[#ecfdf5] text-[#059669]"
            }
          />
        </div>

        <PersonalMockSection
          title="Your Vault"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <PersonalMockSelect
                className="h-8 text-[12px]"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="recent">Recently Added</option>
                <option value="name">Friendly Name</option>
                <option value="cost">Monthly Cost</option>
              </PersonalMockSelect>
              <PersonalMockBtn
                variant={localOnly ? "primary" : "outline"}
                className="h-8 px-3 text-[12px]"
                onClick={() => {
                  setLocalOnly((v) => !v);
                  if (!localOnly) setTollFreeOnly(false);
                }}
              >
                Local
              </PersonalMockBtn>
              <PersonalMockBtn
                variant={tollFreeOnly ? "primary" : "outline"}
                className="h-8 px-3 text-[12px]"
                onClick={() => {
                  setTollFreeOnly((v) => !v);
                  if (!tollFreeOnly) setLocalOnly(false);
                }}
              >
                Toll-Free
              </PersonalMockBtn>
            </div>
          }
        >
          <PersonalMockFilterChips
            options={["All", "Silent", "Announcement", "Voicemail", "Porting"]}
            active={modeFilter}
            onChange={(v) => setModeFilter(v as ModeFilter)}
          />

          {filtered.length === 0 ? (
            <div className="mt-6 py-8 text-center">
              <p className={pm.muted}>No numbers in your vault yet.</p>
              <Link
                href={addToVaultHref}
                className="mt-3 text-[13px] font-semibold text-[#6366f1] hover:underline"
              >
                {activeToPark.length > 0
                  ? "Park a number from My Numbers"
                  : "Find a number to vault"}
              </Link>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[960px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-3">Phone Number</th>
                    <th className="pb-3 pr-3">Friendly Name</th>
                    <th className="pb-3 pr-3">Type</th>
                    <th className="pb-3 pr-3">Incoming Mode</th>
                    <th className="pb-3 pr-3">Monthly Cost</th>
                    <th className="pb-3 pr-3">Next Renewal</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Unread VM</th>
                    <th className="pb-3 pr-3">Last Activity</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {filtered.map((n) => (
                    <tr key={n.id} className="group">
                      <td className="py-3 pr-3 font-semibold text-[#111827]">
                        {formatPhone(n.number)}
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">
                        {n.friendlyName || "—"}
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">{n.type}</td>
                      <td className="py-3 pr-3">
                        <PersonalMockPill tone="blue">
                          {vaultModeLabel(n.vaultIncomingMode)}
                        </PersonalMockPill>
                      </td>
                      <td className="py-3 pr-3 font-medium">
                        ${n.monthlyCost.toFixed(2)}
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">
                        {nextRenewalDate(n.parkedSince)}
                      </td>
                      <td className="py-3 pr-3">
                        <PersonalMockPill tone="green">Vaulted</PersonalMockPill>
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">—</td>
                      <td className="py-3 pr-3 text-[#6b7280]">
                        {n.parkedSince
                          ? new Date(n.parkedSince).toLocaleDateString()
                          : "Vaulted"}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <PersonalMockBtn
                            variant="outline"
                            className="h-8 px-3 text-[12px]"
                            onClick={() => openManage(n.id)}
                          >
                            Manage
                          </PersonalMockBtn>
                          <div className="relative">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                              aria-label="More actions"
                              onClick={() =>
                                setMenuOpenId((cur) => (cur === n.id ? null : n.id))
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpenId === n.id ? (
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg text-[12px]">
                                <Link
                                  href={`/personal/numbers/${n.id}`}
                                  className="block px-3 py-2 hover:bg-[#f9fafb]"
                                >
                                  Edit number details
                                </Link>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left hover:bg-[#f9fafb]"
                                  onClick={() => openManage(n.id)}
                                >
                                  Manage vault settings
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-rose-600 hover:bg-[#fef2f2]"
                                  disabled={busy === n.id}
                                  onClick={() => removeFromVault(n.id)}
                                >
                                  Remove from vault
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PersonalMockPagination
                showing={`Showing ${filtered.length} of ${parked.length} vaulted numbers`}
                total={parked.length}
                pages={Math.max(1, Math.ceil(parked.length / 10))}
              />
            </div>
          )}
        </PersonalMockSection>

        <div className="grid gap-4 lg:grid-cols-2">
          <PersonalMockSection title="Recent Vault Activity">
            {activity.length === 0 ? (
              <p className={pm.muted}>No vault activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-[13px]">
                    <Archive className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                    <div>
                      <p className="text-[#111827]">{a.text}</p>
                      <p className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
                        <Clock className="h-3 w-3" /> {a.at}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>

          <PersonalMockSection
            title="Number Protection"
            description={
              protectionNumber
                ? `Settings for ${formatPhone(protectionNumber.number)}`
                : "Vault a number to configure protection"
            }
          >
            {protectionNumber ? (
              <div className="space-y-4">
                <PersonalMockToggle
                  label="Port-out Lock"
                  checked={portLocked}
                  onChange={(v) => togglePortLock(v)}
                />
                <PersonalMockToggle
                  label="Verification Required"
                  checked={callScreening}
                  onChange={(v) => toggleCallScreening(v)}
                />
                <PersonalMockToggle
                  label="Voicemail while vaulted"
                  checked={
                    protectionNumber.vaultIncomingMode === "voicemail" ||
                    protectionNumber.voicemailEnabled
                  }
                  onChange={(v) => {
                    const id = protectionNumber.id;
                    setBusy("quick-vm");
                    if (v) {
                      runPersonalNumberAction(id, "set_vault_voicemail")
                        .then(() => router.refresh())
                        .catch((e) =>
                          setError(
                            e instanceof Error ? e.message : "Could not enable voicemail.",
                          ),
                        )
                        .finally(() => setBusy(null));
                    } else {
                      fetch(`/api/numbers/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          personalCallSettings: { vaultIncomingMode: "silent" },
                        }),
                      })
                        .then(() => router.refresh())
                        .catch(() => undefined)
                        .finally(() => setBusy(null));
                    }
                  }}
                />
              </div>
            ) : (
              <p className={pm.muted}>No vaulted numbers yet.</p>
            )}
          </PersonalMockSection>
        </div>
      </PersonalMockPage>

      {managed ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close vault details"
            onClick={() => setManageId(null)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <h2 className="text-[16px] font-bold text-[#111827]">Manage Vaulted Number</h2>
              <button
                type="button"
                onClick={() => setManageId(null)}
                className="rounded-lg p-1 hover:bg-[#f3f4f6]"
              >
                <X className="h-5 w-5 text-[#6b7280]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  Number
                </p>
                <p className="mt-1 text-[20px] font-bold text-[#111827]">
                  {formatPhone(managed.number)}
                </p>
                {managed.friendlyName ? (
                  <p className="mt-1 text-[13px] text-[#6366f1]">{managed.friendlyName}</p>
                ) : null}
                <p className="mt-1 text-[12px] text-[#6b7280]">
                  {managed.type} · ${managed.monthlyCost.toFixed(2)}/mo
                </p>
              </div>

              <div>
                <p className="mb-3 text-[13px] font-semibold text-[#111827]">
                  Incoming call handling
                </p>
                <div className="space-y-2 text-[13px]">
                  {(
                    [
                      { id: "silent", label: "Silent — no service" },
                      { id: "parked_message", label: "Play announcement" },
                      { id: "voicemail", label: "Voicemail" },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={modeDraft === opt.id}
                        onChange={() => setModeDraft(opt.id)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {modeDraft === "parked_message" ? (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-[#111827]">
                    Vault announcement
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-[#e5e7eb] p-3 text-[13px] outline-none focus:border-[#6366f1]"
                    rows={4}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Message played when callers reach this vaulted number…"
                  />
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#e5e7eb] p-5 space-y-2">
              <PersonalMockBtn
                className="w-full"
                disabled={busy === "save" || busy === "reactivate"}
                onClick={saveManaged}
              >
                {busy === "save" ? "Saving…" : "Save changes"}
              </PersonalMockBtn>
              <PersonalMockBtn
                variant="outline"
                className="w-full"
                disabled={busy === "reactivate" || busy === "save"}
                onClick={reactivateManaged}
              >
                {busy === "reactivate" ? "Reactivating…" : "Reactivate number"}
              </PersonalMockBtn>
              <div className="flex gap-2">
                <Link href={`/personal/numbers/${managed.id}`} className="flex-1">
                  <PersonalMockBtn variant="ghost" className="w-full">
                    <Phone className="h-4 w-4" />
                    Number details
                  </PersonalMockBtn>
                </Link>
                <PersonalMockBtn
                  variant="ghost"
                  className="flex-1 text-rose-600 hover:bg-[#fef2f2]"
                  disabled={busy === managed.id}
                  onClick={() => removeFromVault(managed.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </PersonalMockBtn>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
