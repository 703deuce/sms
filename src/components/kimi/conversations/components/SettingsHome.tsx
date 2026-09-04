"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, BadgeCheck, ListChecks, Puzzle, Code2, PhoneOutgoing, Inbox as InboxIcon, ShoppingCart, Link2, BarChart2, ShieldCheck, FileCode2, ChevronRight } from "lucide-react";

const CARDS = [
  { icon: <SlidersHorizontal size={16} />, tint: "#eef2ff", color: "#4f46e5", title: "General", desc: "Manage basic settings and default messaging." },
  { icon: <BadgeCheck size={16} />, tint: "#ecfeff", color: "#0891b2", title: "Brand Info", desc: "Manage your brand's info and contact information." },
  { icon: <ListChecks size={16} />, tint: "#f5f3ff", color: "#7c3aed", title: "Custom Fields", desc: "Create and manage custom contact fields." },
  { icon: <Puzzle size={16} />, tint: "#fff7ed", color: "#ea580c", title: "Integrations", desc: "View and manage your existing integrations." },
  { icon: <Code2 size={16} />, tint: "#f0fdf4", color: "#16a34a", title: "API & Webhooks", desc: "Manage your API keys and webhook settings." },
  { icon: <PhoneOutgoing size={16} />, tint: "#eff6ff", color: "#2563eb", title: "Sending Numbers", desc: "View your sending numbers and number options." },
  { icon: <InboxIcon size={16} />, tint: "#eef2ff", color: "#4f46e5", title: "Inbox", desc: "Manage your inbox settings, tags, and rules.", go: "inboxSettings" },
  { icon: <ShoppingCart size={16} />, tint: "#fdf2f8", color: "#db2777", title: "Ecommerce", desc: "Manage your abandoned cart and revenue attribution settings." },
  { icon: <Link2 size={16} />, tint: "#f0fdfa", color: "#0d9488", title: "Link Domains", desc: "View and manage the domains used for your links." },
  { icon: <BarChart2 size={16} />, tint: "#fffbeb", color: "#d97706", title: "UTM Parameters", desc: "View and manage your link's UTM settings." },
  { icon: <ShieldCheck size={16} />, tint: "#f0fdf4", color: "#059669", title: "Compliance", desc: "Manage all things related to TCPA compliance." },
  { icon: <FileCode2 size={16} />, tint: "#f1f5f9", color: "#475569", title: "Transovo Tag", desc: "Access the code snippet that powers Transovo-related features on your website." },
];

const SETTINGS_ROUTES: Record<string, string> = {
  General: "/settings/messaging",
  "Brand Info": "/settings/brand",
  "Custom Fields": "/settings/custom-fields",
  Integrations: "/settings/integrations",
  "API & Webhooks": "/settings/api",
  "Sending Numbers": "/settings/numbers",
  Ecommerce: "/settings/ecommerce",
  "Link Domains": "/settings/link-domains",
  "UTM Parameters": "/settings/utm",
  Compliance: "/settings/compliance",
  "Transovo Tag": "/settings/tag",
};

export default function SettingsHome({
  onOpenInbox,
  cardHref,
}: {
  onOpenInbox: () => void;
  cardHref?: (title: string) => string | undefined;
}) {
  const router = useRouter();
  const openCard = (title: string, go?: string) => {
    if (go) {
      onOpenInbox();
      return;
    }
    const href = cardHref?.(title) ?? SETTINGS_ROUTES[title];
    if (href) router.push(href);
  };
  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "32px 36px", background: "var(--tv-panel)" }}>
      <div style={{ fontSize: 12, color: "var(--tv-faint)", marginBottom: 10 }}>Settings</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: "var(--tv-text)", margin: 0 }}>Settings</h2>
      <p style={{ fontSize: 13, color: "var(--tv-muted)", margin: "6px 0 26px" }}>Manage functional settings for your brand / account.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, maxWidth: 980 }}>
        {CARDS.map((c) => {
          const clickable = Boolean(c.go || cardHref?.(c.title) || SETTINGS_ROUTES[c.title]);
          return (
            <div key={c.title} onClick={() => clickable && openCard(c.title, c.go)}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter") openCard(c.title, c.go); } : undefined}
              style={{
                position: "relative",
                background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 12, padding: "18px 18px 16px",
                cursor: clickable ? "pointer" : "default",
                transition: "box-shadow .15s, border-color .15s, transform .15s",
                boxShadow: "0 1px 2px rgba(16,24,40,.04)",
              }}
              onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.boxShadow = "0 8px 20px rgba(16,24,40,.09)"; e.currentTarget.style.borderColor = "#d3d8e0"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,.04)"; e.currentTarget.style.borderColor = "var(--tv-border)"; e.currentTarget.style.transform = "none"; }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: c.tint, display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</span>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12, letterSpacing: -0.1, color: "var(--tv-text)", display: "flex", alignItems: "center", gap: 4 }}>
                {c.title}
                {clickable ? <ChevronRight size={13} style={{ color: "#c3c9d2" }} /> : null}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--tv-muted)", marginTop: 5, lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
