"use client";

import React from "react";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        marginBottom: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color: "rgba(16,24,40,0.9)",
        letterSpacing: "-0.005em",
      }}
    >
      {children}
    </label>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface" style={{ borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "2px 0 0" }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
