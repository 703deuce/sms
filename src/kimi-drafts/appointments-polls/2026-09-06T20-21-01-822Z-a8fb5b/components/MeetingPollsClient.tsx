"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Vote, CheckCircle2, AlertCircle } from "lucide-react";
import { MOCK_POLLS, MeetingPoll, PollStatus } from "../mock-data";
import { Button, Input, EmptyState } from "./ui";
import { PollRow } from "./PollCard";
import { CreatePollModal } from "./CreatePollModal";
import { PollDetailDrawer } from "./PollDetailDrawer";
import { ConfirmTimeModal, DeletePollModal } from "./ConfirmActionModal";

type LoadState = "loading" | "ready" | "error";
type Filter = "all" | PollStatus;

const LOCAL_NAV = [
  { label: "Booking Types", href: "/appointments/types" },
  { label: "Booking Pages", href: "/appointments/booking" },
  { label: "Availability", href: "/appointments/availability" },
  { label: "AI Booking", href: "/appointments/ai-booking" },
  { label: "Routing", href: "/appointments/routing-forms" },
  { label: "Meeting Polls", href: "/appointments/polls", active: true },
];

export function MeetingPollsClient() {
  const [polls, setPolls] = useState<MeetingPoll[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MeetingPoll | null>(null);
  const [confirmingPoll, setConfirmingPoll] = useState<MeetingPoll | null>(null);
  const [deletingPoll, setDeletingPoll] = useState<MeetingPoll | null>(null);
  const [toast, setToast] = useState("");

  // GET /api/appointments/meeting-polls (mocked)
  useEffect(() => {
    const t = setTimeout(() => {
      setPolls(MOCK_POLLS);
      setLoadState("ready");
    }, 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    return polls.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [polls, filter, query]);

  function showToast(msg: string) {
    setToast(msg);
  }

  function copyLink(poll: MeetingPoll) {
    navigator.clipboard?.writeText(poll.shareUrl).catch(() => {});
    showToast("Poll link copied to clipboard.");
  }

  /** Book winner — from ConfirmTimeModal */
  function bookWinningTime(poll: MeetingPoll, winningOptionId: string) {
    setPolls((ps) =>
      ps.map((p) => (p.id === poll.id ? { ...p, status: "scheduled", winningOptionId } : p))
    );
    if (selected?.id === poll.id) {
      setSelected({ ...poll, status: "scheduled", winningOptionId });
    }
    setConfirmingPoll(null);
    const winner = poll.options.find((o) => o.id === winningOptionId);
    const when = winner
      ? new Date(winner.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : "";
    showToast(`Poll closed — ${when} booked and invites sent.`);
  }

  /** Close without booking */
  function closeWithoutBooking(poll: MeetingPoll) {
    setPolls((ps) => ps.map((p) => (p.id === poll.id ? { ...p, status: "closed" } : p)));
    if (selected?.id === poll.id) setSelected({ ...poll, status: "closed" });
    showToast("Poll closed. The voting link no longer accepts responses.");
  }

  function deletePoll(poll: MeetingPoll) {
    setPolls((ps) => ps.filter((p) => p.id !== poll.id));
    if (selected?.id === poll.id) setSelected(null);
    setDeletingPoll(null);
    showToast("Poll deleted.");
  }

  function handleCreate(poll: MeetingPoll) {
    setPolls((ps) => [poll, ...ps]);
    setCreateOpen(false);
    showToast("Meeting poll created. Share the link to start collecting votes.");
  }

  const filteredOut = loadState === "ready" && polls.length > 0 && visible.length === 0;

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Meeting polls</h1>
          <p className="subtitle">
            Propose times, collect votes, and book the winning slot — no back-and-forth.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> New poll
        </Button>
      </div>

      {/* Local navigation (Booking domain) */}
      <nav className="local-nav" aria-label="Booking navigation">
        {LOCAL_NAV.map((item) => (
          <a key={item.label} href={item.href} className={item.active ? "active" : ""} aria-current={item.active ? "page" : undefined}>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Control bar */}
      <div className="control-bar">
        <div className="search-box">
          <Search size={15} />
          <Input
            placeholder="Search polls…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search polls"
          />
        </div>
        <div className="seg" role="tablist" aria-label="Filter by status">
          {(["all", "open", "scheduled", "closed"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "open" ? "Open" : f === "scheduled" ? "Confirmed" : "Closed"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loadState === "loading" && (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Poll</th><th className="hide-sm">Responses</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i} className="skeleton-row">
                  <td><span className="skeleton" style={{ width: "55%" }} /><span className="skeleton" style={{ width: "35%", marginTop: 6 }} /></td>
                  <td className="hide-sm"><span className="skeleton" style={{ width: 120 }} /></td>
                  <td><span className="skeleton" style={{ width: 64 }} /></td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error */}
      {loadState === "error" && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="alert-title">Meeting polls couldn&apos;t be loaded</div>
            Check your connection and try again.{" "}
            <Button variant="outline" size="sm" style={{ marginLeft: 8 }} onClick={() => setLoadState("loading")}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* First-use empty */}
      {loadState === "ready" && polls.length === 0 && (
        <EmptyState
          icon={<Vote size={20} />}
          title="No meeting polls yet"
          body="Create a poll with a few proposed times, share the link, and let invitees vote. Transovo books the winning time automatically."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Create your first poll
            </Button>
          }
        />
      )}

      {/* No results */}
      {filteredOut && (
        <EmptyState
          icon={<Search size={20} />}
          title="No polls match your filters"
          body={query ? `Nothing found for "${query}". Try a different search or clear the status filter.` : "No polls in this status right now."}
          action={
            <Button variant="outline" onClick={() => { setQuery(""); setFilter("all"); }}>
              Clear filters
            </Button>
          }
        />
      )}

      {/* Table */}
      {loadState === "ready" && visible.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Poll</th>
                <th scope="col" className="hide-sm">Responses</th>
                <th scope="col">Status</th>
                <th scope="col" style={{ width: 56 }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  onOpen={() => setSelected(poll)}
                  onCopyLink={() => copyLink(poll)}
                  onBookTime={() => setConfirmingPoll(poll)}
                  onClosePoll={() => closeWithoutBooking(poll)}
                  onDelete={() => setDeletingPoll(poll)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals / drawer / toast */}
      {createOpen && (
        <CreatePollModal onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
      )}
      {selected && (
        <PollDetailDrawer
          poll={selected}
          onClose={() => setSelected(null)}
          onCopyLink={() => copyLink(selected)}
          onBookTime={() => setConfirmingPoll(selected)}
        />
      )}
      {confirmingPoll && (
        <ConfirmTimeModal
          poll={confirmingPoll}
          onCancel={() => setConfirmingPoll(null)}
          onConfirm={(winnerId) => bookWinningTime(confirmingPoll, winnerId)}
        />
      )}
      {deletingPoll && (
        <DeletePollModal
          poll={deletingPoll}
          onCancel={() => setDeletingPoll(null)}
          onConfirm={() => deletePoll(deletingPoll)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
