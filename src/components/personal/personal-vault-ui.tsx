"use client";

import type { PersonalNumberRow, VaultHubSummary } from "@/lib/workspace/personal-data";
import type { VaultIncomingMode } from "@/lib/numbers/personal-call-settings";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import { formatPhone, cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  Banknote,
  Columns3,
  Download,
  Filter,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PersonalMockSparkline } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSelect,
  pm,
} from "./mockup/primitives";

type SortKey = "recent" | "name" | "cost";
type HubStatus = "vault" | "forward" | "ported";
type StatusFilter = "All" | "Vault" | "Forward" | "Ported";
type ProviderFilter = "all" | "telnyx" | "twilio";
type TypeFilter = "all" | "local" | "tollfree";

function nextRenewalDate(parkedSince: string | null): string {
  if (!parkedSince) return "—";
  const d = new Date(parkedSince);
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function hubStatus(n: PersonalNumberRow, portOutIds: Set<string>): HubStatus {
  if (
    portOutIds.has(n.id) ||
    n.serviceState === "PORTING_OUT" ||
    n.serviceState === "PORT_AWAY_WINDOW"
  ) {
    return "ported";
  }
  if (n.serviceState === "PARKED" || n.serviceState === "PARKED_VOICEMAIL") {
    return "vault";
  }
  return "forward";
}

function hubStatusPillTone(status: HubStatus): "orange" | "green" | "red" {
  if (status === "vault") return "orange";
  if (status === "forward") return "green";
  return "red";
}

function hubStatusLabel(status: HubStatus): string {
  if (status === "vault") return "Vault";
  if (status === "forward") return "Forward";
  return "Ported";
}

function configurationLabel(n: PersonalNumberRow, status: HubStatus): string {
  if (status === "forward") {
    const dest = n.forwardTargets[0] || n.voiceForwardTo;
    return dest ? `To: ${formatPhone(dest)}` : "Forwarding enabled";
  }
  if (status === "ported") return "Transfer in progress";
  if (n.vaultIncomingMode === "voicemail") return "Voicemail on vault";
  if (n.vaultIncomingMode === "parked_message") return "Play announcement";
  return "Hold only";
}

function weekDeltaText(delta: number): string {
  if (delta === 0) return "+0 from last week";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} from last week`;
}

function providerLabel(provider?: string): string {
  if (provider === "twilio") return "Twilio";
  if (provider === "telnyx") return "Telnyx";
  return "Carrier";
}

export function PersonalVaultUI({
  numbers,
  parked,
  hubSummary,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  parked: PersonalNumberRow[];
  hubSummary: VaultHubSummary;
  initialNumberId?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [manageId, setManageId] = useState<string | null>(
    initialNumberId && parked.some((n) => n.id === initialNumberId) ? initialNumberId : null,
  );
  const [modeDraft, setModeDraft] = useState<VaultIncomingMode>("silent");
  const [messageDraft, setMessageDraft] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [drawerMoreOpen, setDrawerMoreOpen] = useState(false);
  const [managedVmGreeting, setManagedVmGreeting] = useState("Default greeting");
  const [managedUnreadVm, setManagedUnreadVm] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managed = manageId ? parked.find((n) => n.id === manageId) : null;

  useEffect(() => {
    if (!managed) return;
    setModeDraft(managed.vaultIncomingMode);
    setMessageDraft(managed.parkedMessageText || "");
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

  const portOutIds = useMemo(
    () => new Set(hubSummary.activePortOutNumberIds),
    [hubSummary.activePortOutNumberIds],
  );

  const filtered = useMemo(() => {
    let list = [...numbers];

    if (statusFilter !== "All") {
      const want: HubStatus =
        statusFilter === "Vault"
          ? "vault"
          : statusFilter === "Forward"
            ? "forward"
            : "ported";
      list = list.filter((n) => hubStatus(n, portOutIds) === want);
    }

    if (providerFilter !== "all") {
      list = list.filter((n) => n.provider === providerFilter);
    }

    if (typeFilter === "local") list = list.filter((n) => n.type === "Local");
    if (typeFilter === "tollfree") list = list.filter((n) => n.type === "Toll-free");

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.number.includes(q) ||
          n.friendlyName?.toLowerCase().includes(q) ||
          formatPhone(n.number).toLowerCase().includes(q) ||
          hubStatusLabel(hubStatus(n, portOutIds)).toLowerCase().includes(q),
      );
    }

    if (sortKey === "name") {
      list.sort((a, b) =>
        (a.friendlyName || a.number).localeCompare(b.friendlyName || b.number),
      );
    } else if (sortKey === "cost") {
      list.sort((a, b) => b.monthlyCost - a.monthlyCost);
    } else {
      list.sort((a, b) => a.number.localeCompare(b.number));
    }

    return list;
  }, [numbers, statusFilter, providerFilter, typeFilter, search, sortKey, portOutIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const pageEnd = Math.min(pageSafe * pageSize, filtered.length);
  const paginated = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openManage(id: string) {
    const row = parked.find((n) => n.id === id);
    if (!row) return;
    setManageId(id);
    setModeDraft(row.vaultIncomingMode);
    setMessageDraft(row.parkedMessageText || "");
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

  function handleManage(n: PersonalNumberRow) {
    const status = hubStatus(n, portOutIds);
    if (status === "vault") {
      openManage(n.id);
      return;
    }
    if (status === "forward") {
      router.push(`/personal/forwarding?numberId=${n.id}`);
      return;
    }
    router.push(`/personal/porting?tab=out&numberId=${n.id}`);
  }

  const recentActionIcon = (tone: VaultHubSummary["recentActions"][0]["tone"]) => {
    if (tone === "green") return "bg-[#ecfdf5] text-[#059669]";
    if (tone === "red") return "bg-[#fef2f2] text-[#dc2626]";
    if (tone === "yellow") return "bg-[#fffbeb] text-[#d97706]";
    return "bg-[#eff6ff] text-[#2563eb]";
  };

  return (
    <div className="relative">
      <PersonalMockPage>
        <PersonalMockHeader
          title="Number Vault"
          description="Manage and monitor your phone numbers here."
          titleClassName="text-[26px] leading-tight"
          descriptionClassName="text-[13px] text-[#6b7280]"
          actions={
            <Link
              href="/personal/numbers/premium"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1e40af] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#1e3a8a]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add New Number
            </Link>
          }
        />

        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PersonalMockKpi
            className="p-5"
            label="Total Numbers"
            value={hubSummary.totalNumbers}
            icon={Phone}
            iconClass="bg-[#eff6ff] text-[#2563eb]"
            iconWrapClassName="h-10 w-10"
            valueClassName="text-[32px]"
            deltaText={weekDeltaText(hubSummary.totalDeltaWeek)}
            deltaTone={
              hubSummary.totalDeltaWeek > 0
                ? "green"
                : hubSummary.totalDeltaWeek < 0
                  ? "red"
                  : "gray"
            }
          />
          <PersonalMockKpi
            className="p-5"
            label="Vaulted"
            value={hubSummary.vaulted}
            icon={Shield}
            iconClass="bg-[#fff7ed] text-[#ea580c]"
            iconWrapClassName="h-10 w-10"
            valueClassName="text-[32px]"
            deltaText={weekDeltaText(hubSummary.vaultedDeltaWeek)}
            deltaTone={
              hubSummary.vaultedDeltaWeek > 0
                ? "green"
                : hubSummary.vaultedDeltaWeek < 0
                  ? "red"
                  : "gray"
            }
          />
          <PersonalMockKpi
            className="p-5"
            label="Forwarding"
            value={hubSummary.forwarding}
            icon={PhoneForwarded}
            iconClass="bg-[#ecfdf5] text-[#059669]"
            iconWrapClassName="h-10 w-10"
            valueClassName="text-[32px]"
            deltaText={weekDeltaText(hubSummary.forwardingDeltaWeek)}
            deltaTone="gray"
          />
          <PersonalMockKpi
            className="p-5"
            label="Incoming Calls"
            value={hubSummary.incomingCalls7d}
            icon={PhoneIncoming}
            iconClass="bg-[#f3e8ff] text-[#7c3aed]"
            iconWrapClassName="h-10 w-10"
            valueClassName="text-[32px]"
            deltaText={`${hubSummary.incomingCallsTrendPct >= 0 ? "+" : ""}${hubSummary.incomingCallsTrendPct}% from last week`}
            deltaTone={hubSummary.incomingCallsTrendPct >= 0 ? "green" : "red"}
          />
          <PersonalMockKpi
            className="p-5"
            label="Ported Out"
            value={hubSummary.portedOut}
            icon={PhoneOutgoing}
            iconClass="bg-[#fef2f2] text-[#dc2626]"
            iconWrapClassName="h-10 w-10"
            valueClassName="text-[32px]"
            deltaText={hubSummary.portedOutLabel}
            deltaTone="gray"
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-[420px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
            />
            <PersonalMockInput
              className="h-10 w-full border-[#e5e7eb] bg-white pl-9 shadow-sm"
              placeholder="Search numbers or status"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <PersonalMockSelect
              className="h-10 w-[130px] text-[13px] shadow-sm"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TypeFilter);
                setPage(1);
              }}
            >
              <option value="all">All Types</option>
              <option value="local">Local</option>
              <option value="tollfree">Toll-free</option>
            </PersonalMockSelect>
            <PersonalMockSelect
              className="h-10 w-[140px] text-[13px] shadow-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Vault">Vault</option>
            <option value="Forward">Forward</option>
            <option value="Ported">Ported</option>
          </PersonalMockSelect>
            <PersonalMockSelect
              className="h-10 w-[140px] text-[13px] shadow-sm"
              value={providerFilter}
            onChange={(e) => {
              setProviderFilter(e.target.value as ProviderFilter);
              setPage(1);
            }}
          >
            <option value="all">All Providers</option>
            <option value="telnyx">Telnyx</option>
            <option value="twilio">Twilio</option>
          </PersonalMockSelect>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] shadow-sm hover:bg-[#f9fafb]"
              aria-label="Filter"
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] shadow-sm hover:bg-[#f9fafb]"
              aria-label="Columns"
            >
              <Columns3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] shadow-sm hover:bg-[#f9fafb]"
              aria-label="Export"
              title="Export numbers"
              onClick={() => router.push("/personal/activity")}
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={pm.card}>
          <div className="flex items-center justify-between border-b border-[#f3f4f6] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[#111827]">Phone Numbers</h2>
          </div>
          <div className="p-5">
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className={pm.muted}>No numbers match your filters.</p>
                <Link
                  href="/personal/numbers/premium"
                  className="mt-3 text-[13px] font-semibold text-[#2563eb] hover:underline"
                >
                  Add a number
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[960px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                      <th className="pb-3 pr-4">Number</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Configuration</th>
                      <th className="pb-3 pr-4">Usage Stats</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {paginated.map((n) => {
                      const status = hubStatus(n, portOutIds);
                      const usage = hubSummary.usageByNumberId[n.id] ?? { minutes: 0, calls: 0 };
                      const spark = [
                        Math.max(1, usage.calls),
                        Math.max(1, usage.minutes),
                        usage.calls + 1,
                        usage.minutes + 2,
                        usage.calls,
                      ];
                      return (
                        <tr key={n.id} className="group">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                                <Phone className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </span>
                              <div>
                                <p className="font-semibold text-[#111827]">
                                  {formatPhone(n.number)}
                                </p>
                                <p className="text-[11px] text-[#9ca3af]">
                                  {providerLabel(n.provider)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4">
                            <PersonalMockPill tone={hubStatusPillTone(status)}>
                              {hubStatusLabel(status)}
                            </PersonalMockPill>
                          </td>
                          <td className="py-3.5 pr-4 text-[#6b7280]">
                            {configurationLabel(n, status)}
                          </td>
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <PersonalMockSparkline
                                points={spark}
                                color="#2563eb"
                                width={56}
                                height={22}
                                className="shrink-0"
                              />
                              <span className="text-[12px] text-[#6b7280]">
                                {usage.minutes} min · {usage.calls} calls
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <PersonalMockBtn
                                variant="outline"
                                className="h-8 px-3.5 text-[12px] font-semibold !border-[#2563eb] !bg-white !text-[#2563eb] hover:!bg-[#eff6ff]"
                                onClick={() => handleManage(n)}
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
                                      Number details
                                    </Link>
                                    {status === "vault" ? (
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-2 text-left hover:bg-[#f9fafb]"
                                        onClick={() => openManage(n.id)}
                                      >
                                        Vault settings
                                      </button>
                                    ) : null}
                                    {status === "forward" ? (
                                      <Link
                                        href={`/personal/forwarding?numberId=${n.id}`}
                                        className="block px-3 py-2 hover:bg-[#f9fafb]"
                                      >
                                        Forwarding settings
                                      </Link>
                                    ) : null}
                                    {status === "ported" ? (
                                      <Link
                                        href={`/personal/porting?tab=out&numberId=${n.id}`}
                                        className="block px-3 py-2 hover:bg-[#f9fafb]"
                                      >
                                        Port-out status
                                      </Link>
                                    ) : null}
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
                {totalPages > 1 ? (
                  <PersonalMockPagination
                    showing={`Showing ${pageStart} to ${pageEnd} of ${filtered.length} numbers`}
                    total={filtered.length}
                    page={pageSafe}
                    pages={totalPages}
                    pageSizeLabel={`${pageSize} / page`}
                    onPageChange={setPage}
                    hideWhenSinglePage={false}
                  />
                ) : null}
                <p className="mt-3 text-[11px] text-[#9ca3af]">
                  Showing {pageEnd} of {hubSummary.totalNumbers} numbers. See more at the bottom
                  of the page.
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[#111827]">Recent Actions</h2>
            <Link
              href="/personal/activity"
              className="text-[12px] font-semibold text-[#2563eb] hover:underline"
            >
              See all activity &gt;
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {hubSummary.recentActions.map((action) => (
              <div key={action.id} className={cn(pm.card, "p-4 shadow-sm")}>
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      recentActionIcon(action.tone),
                    )}
                  >
                    {action.kind === "number_added" ? (
                      <Plus className="h-4 w-4" />
                    ) : action.kind === "ported_out" ? (
                      <PhoneOutgoing className="h-4 w-4" />
                    ) : action.kind === "payment" ? (
                      <Banknote className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827]">{action.title}</p>
                    <p className="text-[12px] font-medium text-[#2563eb]">{action.detail}</p>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">{action.atLabel}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
