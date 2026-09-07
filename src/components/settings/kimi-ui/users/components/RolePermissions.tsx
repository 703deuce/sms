"use client";

import { ROLE_DESCRIPTIONS } from "../types";
import { Card, CardTitle } from "./ui";
import { Check } from "lucide-react";

export function RolePermissions() {
  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <CardTitle>Role permissions</CardTitle>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          Roles control which areas of Transovo each team member can access and change.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          marginTop: 14,
        }}
      >
        {ROLE_DESCRIPTIONS.map((item) => (
          <div
            key={item.role}
            style={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              padding: "12px 14px",
              background: "var(--bg-card)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>{item.role}</p>
            <p style={{ margin: "4px 0 8px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {item.desc}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {item.caps.map((cap) => (
                <li
                  key={cap}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  <Check size={12} strokeWidth={2.5} color="var(--success)" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
