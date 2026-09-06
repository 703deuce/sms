"use client";

const TABS = [
  { key: "overview", label: "Overview", href: "/appointments/analytics" },
  { key: "booking", label: "Booking", href: "/appointments/analytics/booking" },
  { key: "reminders", label: "Reminders", href: "/appointments/analytics/reminders" },
  { key: "automations", label: "Automations", href: "/appointments/analytics/automations" },
  { key: "reports", label: "Reports", href: "/appointments/analytics/reports" },
];

export default function AnalyticsTabs({ active = "booking" }: { active?: string }) {
  return (
    <nav className="an-tabs" aria-label="Analytics sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`an-tab${t.key === active ? " active" : ""}`}
          aria-current={t.key === active ? "page" : undefined}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
