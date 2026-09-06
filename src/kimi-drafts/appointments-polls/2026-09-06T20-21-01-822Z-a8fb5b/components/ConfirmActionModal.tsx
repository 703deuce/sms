"use client";

import { useState } from "react";
import { Trophy, Trash2 } from "lucide-react";
import { Modal, Button } from "./ui";
import { MeetingPoll } from "../mock-data";

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTimeRange(start: string, end: string) {
  const fmt = (v: string) =>
    new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Close poll & book the winning time — winner selection step. */
export function ConfirmTimeModal({
  poll,
  onCancel,
  onConfirm,
}: {
  poll: MeetingPoll;
  onCancel: () => void;
  onConfirm: (winningOptionId: string) => void;
}) {
  const leader = poll.options.reduce((a, b) => (b.votes > a.votes ? b : a), poll.options[0]);
  const [selectedId, setSelectedId] = useState<string>(leader?.id ?? poll.options[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    // Simulate PATCH /api/appointments/meeting-polls/:id (close + book winner)
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onConfirm(selectedId);
  }

  const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));

  return (
    <Modal
      title="Close poll & confirm time"
      subtitle={`Pick the time to book for “${poll.title}”. Calendar invites go out to all ${poll.invitees} invitees.`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Keep poll open</Button>
          <Button onClick={confirm} disabled={!selectedId || saving}>
            {saving ? "Booking…" : "Book this time"}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Winning time">
        {poll.options.map((o) => {
          const isLeader = o.id === leader?.id && o.votes > 0;
          return (
            <label key={o.id} className={`pick-row${selectedId === o.id ? " selected" : ""}`}>
              <input
                type="radio"
                name="winning-time"
                value={o.id}
                checked={selectedId === o.id}
                onChange={() => setSelectedId(o.id)}
              />
              <span style={{ flex: 1 }}>
                <span className="vote-time">
                  {fmtDateTime(o.startsAt)}
                  {isLeader && (
                    <span className="win-badge"><Trophy size={11} /> Most votes</span>
                  )}
                </span>
                <span className="vote-sub" style={{ display: "block" }}>
                  {fmtTimeRange(o.startsAt, o.endsAt)} ET · {o.votes} vote{o.votes === 1 ? "" : "s"} of {maxVotes} max
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {poll.responded < poll.invitees && (
        <div className="alert alert-warn" role="status" style={{ marginTop: 14 }}>
          <div>
            <div className="alert-title">Not everyone has voted</div>
            {poll.invitees - poll.responded} of {poll.invitees} invitees haven&apos;t responded. You can still book now — the poll closes when you confirm.
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Destructive delete confirmation. */
export function DeletePollModal({
  poll,
  onCancel,
  onConfirm,
}: {
  poll: MeetingPoll;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    // Simulate DELETE /api/appointments/meeting-polls/:id
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    onConfirm();
  }

  return (
    <Modal
      narrow
      title="Delete this poll?"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={saving}>
            <Trash2 size={14} /> {saving ? "Deleting…" : "Delete poll"}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        <strong style={{ color: "var(--text)" }}>{poll.title}</strong> and its{" "}
        {poll.responded} collected vote{poll.responded === 1 ? "" : "s"} will be permanently removed.
        The shared poll link will stop working. This can&apos;t be undone.
      </p>
    </Modal>
  );
}
