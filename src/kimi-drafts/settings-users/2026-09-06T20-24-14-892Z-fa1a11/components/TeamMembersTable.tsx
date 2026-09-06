"use client";

import { TeamMember } from "../mock-data";
import { Card, CardTitle, StatusChip } from "./ui";
import { TeamMemberRow } from "./TeamMemberRow";

export function TeamMembersTable({
  members,
  loading,
  readOnly,
  onSaveRole,
  onRemove,
}: {
  members: TeamMember[];
  loading: boolean;
  readOnly?: boolean;
  onSaveRole: (membershipId: string, role: string) => Promise<void>;
  onRemove: (membershipId: string) => Promise<void>;
}) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <CardTitle>Team members</CardTitle>
        <StatusChip label={`${members.length} ${members.length === 1 ? "user" : "users"}`} />
      </div>

      {loading ? (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 20px",
                borderTop: i ? "1px solid var(--border)" : undefined,
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-muted)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: 140, height: 10, borderRadius: 5, background: "var(--bg-muted)" }} />
                <div style={{ width: 200, height: 8, borderRadius: 4, background: "var(--bg-muted)", marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}
            aria-label="Team members"
          >
            <thead>
              <tr style={{ borderTop: "1px solid var(--border)", background: "var(--bg-muted)" }}>
                {["Member", "Role", "Admin", "Last active", ""].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    style={{
                      textAlign: "left",
                      fontSize: 11.5,
                      fontWeight: 650,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "8px 16px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <TeamMemberRow
                  key={m.membershipId}
                  member={m}
                  readOnly={readOnly}
                  onSaveRole={onSaveRole}
                  onRemove={onRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
