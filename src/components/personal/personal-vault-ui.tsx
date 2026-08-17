"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import type { VaultIncomingMode } from "@/lib/numbers/personal-call-settings";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import { formatPhone, cn } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  Clock,
  DollarSign,
  Filter,
  Lock,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Shield,
  Trash2,
  Voicemail,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PersonalMockBtn,
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

type VaultActivity = {
  id: string;
  text: string;
  at: string;
  by?: string;
  icon: "archive" | "shield" | "megaphone" | "reactivate";
};
type ModeFilter = "All" | "Silent" | "Announcement" | "Voicemail" | "Porting";
type SortKey = "recent" | "name" | "cost";
type VaultStatusTone = "blue" | "orange" | "green";

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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatVaultDate(dateStr: string | null): string {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntilRenewal(parkedSince: string | null): number | null {
  if (!parkedSince) return null;
  const renewal = new Date(parkedSince);
  renewal.setMonth(renewal.getMonth() + 1);
  return Math.ceil((renewal.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function vaultRowStatus(n: PersonalNumberRow): {
  label: string;
  tone: VaultStatusTone;
  sub?: string;
} {
  const daysLeft = daysUntilRenewal(n.parkedSince);
  if (n.portAwayExpiresAt || n.serviceState.includes("PORT")) {
    return {
      label: "Action Required",
      tone: "orange",
      sub: daysLeft != null ? `${daysLeft} days` : undefined,
    };
  }
  if (daysLeft != null && daysLeft >= 0 && daysLeft <= 7) {
    return { label: "Action Required", tone: "orange", sub: `${daysLeft} days` };
  }
  if (n.portOutLocked) {
    return { label: "Protected", tone: "green" };
  }
  return { label: "Vaulted", tone: "blue" };
}

function VaultModeTabs({
  active,
  onChange,
}: {
  active: ModeFilter;
  onChange: (v: ModeFilter) => void;
}) {
  const tabs: ModeFilter[] = ["All", "Silent", "Announcement", "Voicemail", "Porting"];
  return (
    <div className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
            active === tab
              ? "bg-[#eef2ff] text-[#6366f1]"
              : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function ModeIcon({ mode }: { mode: VaultIncomingMode }) {
  const className = "h-3.5 w-3.5";
  if (mode === "silent") return <VolumeX className={className} />;
  if (mode === "voicemail") return <Voicemail className={className} />;
  return <Megaphone className={className} />;
}

function ActivityIcon({ kind }: { kind: VaultActivity["icon"] }) {
  const className = "mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]";
  if (kind === "shield") return <Shield className={className} />;
  if (kind === "megaphone") return <Megaphone className={className} />;
  if (kind === "reactivate") return <ArrowRightLeft className={className} />;
  return <Archive className={className} />;
}

export function PersonalVaultUI({
  numbers,
  parked,
  initialNumberId,
  actorName = "You",
}: {
  numbers: PersonalNumberRow[];
  parked: PersonalNumberRow[];
  initialNumberId?: string;
  actorName?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [localOnly, setLocalOnly] = useState(false);
  const [tollFreeOnly, setTollFreeOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [manageId, setManageId] = useState<string | null>(
    initialNumberId && parked.some((n) => n.id === initialNumberId) ? initialNumberId : null,
  );
  const [modeDraft, setModeDraft] = useState<VaultIncomingMode>("silent");
  const [messageDraft, setMessageDraft] = useState("");
  const [portLocked, setPortLocked] = useState(true);
  const [callScreening, setCallScreening] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [drawerMoreOpen, setDrawerMoreOpen] = useState(false);
  const [unreadVm, setUnreadVm] = useState<Record<string, number>>({});
  const [managedVmGreeting, setManagedVmGreeting] = useState("Default greeting");
  const [managedUnreadVm, setManagedUnreadVm] = useState(0);
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
  const protectionNumber = managed ?? parked[0];

  const loadUnreadCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    await Promise.all(
      parked.map(async (n) => {
        const res = await fetch(`/api/phone/voicemail?phoneNumberId=${encodeURIComponent(n.id)}`);
        const j = await res.json().catch(() => ({}));
        const { messages } = parseVoicemailApiPayload(j.data);
        counts[n.id] = messages.filter((m) => !m.readAt).length;
      }),
    );
    setUnreadVm(counts);
  }, [parked]);

  useEffect(() => {
    if (parked.length === 0) return;
    loadUnreadCounts();
  }, [parked, loadUnreadCounts]);

  useEffect(() => {
    if (!managed) return;
    setModeDraft(managed.vaultIncomingMode);
    setMessageDraft(managed.parkedMessageText || "");
    setPortLocked(managed.portOutLocked);
    setCallScreening(managed.callScreeningEnabled);
    setDrawerMoreOpen(false);

    (async () => {
      const res = await fetch(
        `/api/phone/voicemail?phoneNumberId=${encodeURIComponent(managed.id)}`,
      );
      const j = await res.json().catch(() => ({}));
      const { boxes, messages } = parseVoicemailApiPayload(j.data);
      const box = boxes[0];
      if (box?.greetingUrl) setManagedVmGreeting("Custom greeting");
      else if (box?.greetingText) setManagedVmGreeting("Personal greeting");
      else setManagedVmGreeting("Default greeting");
      setManagedUnreadVm(messages.filter((m) => !m.readAt).length);
    })();
  }, [managed]);

  useEffect(() => {
    if (!protectionNumber) return;
    setPortLocked(protectionNumber.portOutLocked);
    setCallScreening(protectionNumber.callScreeningEnabled);
  }, [protectionNumber]);

  const filtered = useMemo(() => {
    const modeTarget = modeFromChip(modeFilter);
    let list = [...parked];

    if (modeTarget) {
      list = list.filter((n) => n.vaultIncomingMode === modeTarget);
    } else if (modeFilter === "Porting") {
      list = list.filter((n) => n.portAwayExpiresAt || n.serviceState.includes("PORT"));
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const pageEnd = Math.min(pageSafe * pageSize, filtered.length);
  const paginated = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activity = useMemo((): VaultActivity[] => {
    const events: VaultActivity[] = [];
    for (const n of parked) {
      const label = n.friendlyName || formatPhone(n.number);
      if (n.parkedSince) {
        events.push({
          id: `${n.id}-vault`,
          text: `${label} was vaulted`,
          by: actorName,
          at: formatVaultDate(n.parkedSince),
          icon: "archive",
        });
      }
      if (n.portOutLocked) {
        events.push({
          id: `${n.id}-port`,
          text: `Port protection enabled for ${formatPhone(n.number)}`,
          by: actorName,
          at: formatVaultDate(n.parkedSince),
          icon: "shield",
        });
      }
      if (n.vaultIncomingMode === "parked_message" && n.parkedMessageText) {
        events.push({
          id: `${n.id}-announce`,
          text: `Announcement updated for ${label}`,
          by: actorName,
          at: formatVaultDate(n.parkedSince),
          icon: "megaphone",
        });
      }
    }
    return events.sort((a, b) => (a.at > b.at ? -1 : 1)).slice(0, 5);
  }, [parked, actorName]);

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

  async function reactivateNumber(numberId: string) {
    setBusy("reactivate");
    setError(null);
    try {
      await runPersonalNumberAction(numberId, "reactivate");
      if (manageId === numberId) setManageId(null);
      router.push(`/personal/forwarding?numberId=${numberId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reactivate number.");
    } finally {
      setBusy(null);
    }
  }

  async function reactivateManaged() {
    if (!manageId) return;
    await reactivateNumber(manageId);
  }

  async function releaseNumber(numberId: string) {
    if (
      !window.confirm(
        "Release this number permanently? It will be removed from your account and cannot be undone.",
      )
    ) {
      return;
    }
    setBusy("release");
    setError(null);
    try {
      const res = await fetch(`/api/numbers/${numberId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not release number.");
      if (manageId === numberId) setManageId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not release number.");
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

  return (
    <div className="relative">
      <PersonalMockPage>
        <PersonalMockHeader
          title="Number Vault"
          description="Keep valuable numbers secure while they're not actively in use."
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative min-w-[280px] flex-1 max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
            />
            <PersonalMockInput
              className="w-full bg-[#f9fafb] pl-9 focus:bg-white"
              placeholder="Search numbers or names"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link href={addToVaultHref}>
              <PersonalMockBtn className="!bg-[#6366f1] hover:!bg-[#4f46e5]">
                <Plus className="h-4 w-4" />
                Add to Vault
              </PersonalMockBtn>
            </Link>
            <Link href="/personal/porting">
              <PersonalMockBtn variant="outline" className="!border-[#6366f1] !text-[#6366f1]">
                Port a Number In
              </PersonalMockBtn>
            </Link>
          </div>
        </div>

        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PersonalMockKpi
            label="Vaulted Numbers"
            value={parked.length}
            sub="Across all locations"
            icon={Lock}
            iconClass="bg-[#eef2ff] text-[#6366f1]"
          />
          <PersonalMockKpi
            label="Monthly Vault Cost"
            value={`$${monthlyVaultCost.toFixed(2)}`}
            sub={`Billed on ${parked.length} number${parked.length === 1 ? "" : "s"}`}
            icon={DollarSign}
            iconClass="bg-[#ecfdf5] text-[#059669]"
          />
          <PersonalMockKpi
            label="Voicemail Enabled"
            value={voicemailEnabledCount}
            sub="Numbers taking VM"
            icon={Voicemail}
            iconClass="bg-[#f3e8ff] text-[#9333ea]"
          />
          <PersonalMockKpi
            label="Action Required"
            value={actionRequiredCount}
            sub={actionRequiredCount > 0 ? "Renewals or updates" : "All clear"}
            icon={actionRequiredCount > 0 ? AlertTriangle : Shield}
            iconClass={
              actionRequiredCount > 0
                ? "bg-[#fff7ed] text-[#ea580c]"
                : "bg-[#ecfdf5] text-[#059669]"
            }
          />
        </div>

        <div className={pm.card}>
          <div className="border-b border-[#f3f4f6] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#111827]">Your Vault</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] px-5 py-3">
            <VaultModeTabs
              active={modeFilter}
              onChange={(v) => {
                setModeFilter(v);
                setPage(1);
              }}
            />
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
              <button
                type="button"
                aria-label="Filter local numbers"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition",
                  localOnly
                    ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                    : "border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]",
                )}
                onClick={() => {
                  setLocalOnly((v) => !v);
                  if (!localOnly) setTollFreeOnly(false);
                  setPage(1);
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Local
              </button>
              <button
                type="button"
                aria-label="Filter toll-free numbers"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition",
                  tollFreeOnly
                    ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                    : "border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]",
                )}
                onClick={() => {
                  setTollFreeOnly((v) => !v);
                  if (!tollFreeOnly) setLocalOnly(false);
                  setPage(1);
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                Toll-Free
              </button>
            </div>
          </div>

          <div className="p-5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
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
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[1040px] text-left text-[13px]">
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
                    {paginated.map((n) => {
                      const status = vaultRowStatus(n);
                      const unread = unreadVm[n.id] ?? 0;
                      return (
                        <tr key={n.id} className="group">
                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              className="font-semibold text-[#6366f1] hover:underline"
                              onClick={() => openManage(n.id)}
                            >
                              {formatPhone(n.number)}
                            </button>
                          </td>
                          <td className="py-3 pr-3 text-[#374151]">
                            {n.friendlyName || "—"}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">{n.type}</td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex items-center gap-1.5 text-[#374151]">
                              <ModeIcon mode={n.vaultIncomingMode} />
                              {vaultModeLabel(n.vaultIncomingMode)}
                            </span>
                          </td>
                          <td className="py-3 pr-3 font-medium text-[#111827]">
                            ${n.monthlyCost.toFixed(2)}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">
                            {nextRenewalDate(n.parkedSince)}
                          </td>
                          <td className="py-3 pr-3">
                            <PersonalMockPill tone={status.tone}>{status.label}</PersonalMockPill>
                            {status.sub ? (
                              <p className="mt-0.5 text-[10px] font-medium text-[#ea580c]">
                                {status.sub}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3">
                            {unread > 0 ? (
                              <span
                                className="inline-flex rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold text-[#374151]"
                              >
                                {unread}
                              </span>
                            ) : (
                              <span className="text-[#9ca3af]">0</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-[#6b7280]">
                            {formatVaultDate(n.parkedSince)}
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
                                  aria-label="Row menu"
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
                                      className="block w-full px-3 py-2 text-left hover:bg-[#f9fafb]"
                                      disabled={busy === n.id}
                                      onClick={() => reactivateNumber(n.id)}
                                    >
                                      Reactivate number
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <PersonalMockPagination
                  showing={
                    filtered.length === 0
                      ? "No results"
                      : `Showing ${pageStart} to ${pageEnd} of ${filtered.length} results`
                  }
                  total={filtered.length}
                  page={pageSafe}
                  pages={totalPages}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PersonalMockSection title="Recent Vault Activity">
            {activity.length === 0 ? (
              <p className={pm.muted}>No vault activity yet.</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-[13px]">
                      <ActivityIcon kind={a.icon} />
                      <div>
                        <p className="text-[#111827]">{a.text}</p>
                        <p className="text-[11px] text-[#9ca3af]">
                          {a.by ? `by ${a.by} · ` : ""}
                          {a.at}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/personal/activity"
                  className="mt-4 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
                >
                  View all activity →
                </Link>
              </>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Number Protection">
            {protectionNumber ? (
              <div className="space-y-5">
                <div>
                  <PersonalMockToggle
                    label="Port-out Lock"
                    checked={portLocked}
                    onChange={(v) => togglePortLock(v)}
                  />
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280]">
                    Prevent unauthorized porting of your numbers to another carrier.
                  </p>
                </div>
                <div>
                  <PersonalMockToggle
                    label="Verification Required"
                    checked={callScreening}
                    onChange={(v) => toggleCallScreening(v)}
                  />
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280]">
                    Require extra verification steps before sensitive number changes.
                  </p>
                </div>
                <div className="flex gap-3 rounded-lg border border-[#e0e7ff] bg-[#eef2ff] p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                  <p className="text-[12px] leading-relaxed text-[#4338ca]">
                    Your numbers are protected with enterprise-grade security.{" "}
                    <Link href="/help" className="font-semibold text-[#6366f1] hover:underline">
                      Learn more
                    </Link>
                  </p>
                </div>
              </div>
            ) : (
              <p className={pm.muted}>Vault a number to configure protection.</p>
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
                <p className="text-[22px] font-bold text-[#111827]">
                  {formatPhone(managed.number)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#111827]">
                    {managed.friendlyName || "Main Line"}
                  </p>
                  <Pencil className="h-3.5 w-3.5 text-[#9ca3af]" />
                </div>
                <div className="mt-2">
                  <PersonalMockPill tone="blue">Vaulted</PersonalMockPill>
                </div>
              </div>

              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Vaulted Since</dt>
                  <dd className="font-medium text-[#111827]">
                    {managed.parkedSince
                      ? new Date(managed.parkedSince).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Recently"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Monthly Price</dt>
                  <dd className="font-medium text-[#111827]">${managed.monthlyCost.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Next Renewal</dt>
                  <dd className="font-medium text-[#111827]">
                    {nextRenewalDate(managed.parkedSince)}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="mb-3 text-[13px] font-semibold text-[#111827]">
                  Incoming Call Handling
                </p>
                <div className="space-y-2 text-[13px] text-[#374151]">
                  {(
                    [
                      { id: "silent", label: "Hold Only" },
                      { id: "parked_message", label: "Play Announcement" },
                      { id: "voicemail", label: "Take Voicemail" },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="accent-[#6366f1]"
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
                    className="w-full rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[13px] outline-none focus:border-[#6366f1] focus:bg-white"
                    rows={4}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Thank you for calling. This number is currently parked…"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PersonalMockBtn variant="outline" className="h-8 text-[12px]">
                      Record
                    </PersonalMockBtn>
                    <PersonalMockBtn variant="outline" className="h-8 text-[12px]">
                      Upload
                    </PersonalMockBtn>
                    <PersonalMockBtn variant="outline" className="h-8 text-[12px]">
                      <Plus className="h-3.5 w-3.5" />
                      Generate
                    </PersonalMockBtn>
                    <PersonalMockBtn variant="ghost" className="h-8 text-[12px]">
                      <Play className="h-3.5 w-3.5" />
                      Preview
                    </PersonalMockBtn>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[12px]">
                <p className="font-semibold text-[#111827]">Voicemail Summary</p>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6b7280]">Voicemail Greeting</dt>
                    <dd className="font-medium text-[#111827]">{managedVmGreeting}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6b7280]">Unread Messages</dt>
                    <dd className="font-medium text-[#111827]">{managedUnreadVm}</dd>
                  </div>
                </dl>
                <Link
                  href={`/personal/voicemail?numberId=${managed.id}`}
                  className="mt-3 inline-block font-semibold text-[#6366f1] hover:underline"
                >
                  Open Voicemail →
                </Link>
              </div>
            </div>

            <div className="border-t border-[#e5e7eb] p-5 space-y-2">
              <PersonalMockBtn
                className="w-full !bg-[#6366f1] hover:!bg-[#4f46e5]"
                disabled={busy === "save" || busy === "reactivate"}
                onClick={saveManaged}
              >
                {busy === "save" ? "Saving…" : "Save Changes"}
              </PersonalMockBtn>
              <PersonalMockBtn
                variant="outline"
                className="w-full !border-[#6366f1] !text-[#6366f1]"
                disabled={busy === "reactivate" || busy === "save"}
                onClick={reactivateManaged}
              >
                {busy === "reactivate" ? "Reactivating…" : "Reactivate Number"}
              </PersonalMockBtn>
              <div className="relative">
                <PersonalMockBtn
                  variant="outline"
                  className="w-full"
                  onClick={() => setDrawerMoreOpen((v) => !v)}
                >
                  More Actions
                </PersonalMockBtn>
                {drawerMoreOpen ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg text-[13px]">
                    <Link
                      href={`/personal/porting?tab=out&numberId=${managed.id}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-[#f9fafb]"
                    >
                      <ArrowRightLeft className="h-4 w-4 text-[#6b7280]" />
                      Transfer Out
                    </Link>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-[#fef2f2]"
                      disabled={busy === "release"}
                      onClick={() => releaseNumber(managed.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Release Number
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
