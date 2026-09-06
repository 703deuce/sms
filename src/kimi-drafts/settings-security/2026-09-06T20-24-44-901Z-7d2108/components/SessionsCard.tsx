"use client";

import { useState } from "react";
import { Laptop, Smartphone, Monitor, Globe } from "lucide-react";
import type { SessionRow } from "../mock-data";
import { Button, Card, CardHeader, InlineAlert, StatusChip } from "./ui";

function DeviceIcon({ device }: { device: string }) {
  const cls = "tv-device-icon";
  if (/iphone|android|mobile/i.test(device)) return <Smartphone size={16} className={cls} aria-hidden />;
  if (/macbook|imac|laptop/i.test(device)) return <Laptop size={16} className={cls} aria-hidden />;
  if (/windows|desktop/i.test(device)) return <Monitor size={16} className={cls} aria-hidden />;
  return <Globe size={16} className={cls} aria-hidden />;
}

export function SessionsCard({
  sessions,
  loading,
  onRevoke,
}: {
  sessions: SessionRow[];
  loading: boolean;
  onRevoke: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState("");

  function revoke(id: string) {
    onRevoke(id);
    setConfirmId(null);
    setNotice("Session signed out.");
  }

  function revokeAll() {
    sessions.filter((s) => !s.current).forEach((s) => onRevoke(s.id));
    setConfirmAll(false);
    setNotice("All other sessions signed out.");
  }

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        description="Devices currently signed in to your account. Sign out any session you don't recognize."
      />

      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}

      {loading ? (
        <div className="tv-sessions-list" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="tv-skeleton-row" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="tv-empty">
          <p className="tv-empty-title">No active sessions found</p>
          <p className="tv-muted">Sessions appear here after you sign in on a device.</p>
        </div>
      ) : (
        <ul className="tv-sessions-list">
          {sessions.map((s) => (
            <li key={s.id} className="tv-session-row">
              <div className="tv-session-icon">
                <DeviceIcon device={s.device} />
              </div>
              <div className="tv-session-main">
                <div className="tv-session-title">
                  <span>{s.device}</span>
                  {s.current ? <StatusChip status="This device" /> : null}
                </div>
                <p className="tv-session-meta">
                  {s.browser} · {s.location} · {s.ip}
                </p>
                <p className="tv-session-meta tv-session-last">{s.lastActive}</p>
              </div>
              {!s.current ? (
                confirmId === s.id ? (
                  <div className="tv-session-confirm" role="group" aria-label={`Confirm sign out of ${s.device}`}>
                    <span className="tv-session-confirm-text">Sign out this session?</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      Keep
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => revoke(s.id)}>
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmId(s.id)}>
                    Sign out
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!loading && sessions.some((s) => !s.current) ? (
        <div className="tv-sessions-footer">
          {confirmAll ? (
            <div className="tv-session-confirm" role="group" aria-label="Confirm sign out of all other sessions">
              <span className="tv-session-confirm-text">
                Sign out all other sessions? You'll stay signed in on this device.
              </span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={revokeAll}>
                Sign out all
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)}>
              Sign out all other sessions
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
