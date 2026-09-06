"use client";

import { useState } from "react";
import { AppointmentsAnalyticsClient } from "./analytics-client";
import { analyticsTabs, cn, type AnalyticsSection } from "./ui";

export function AppointmentsAnalyticsShell({
  section = "reminders",
}: {
  section?: AnalyticsSection;
}) {
  const [active, setActive] = useState<AnalyticsSection>(section);

  return (
    <div className="tv-shell">
      <div className="tv-container">
        <nav className="tv-tabs" aria-label="Analytics sections">
          {analyticsTabs.map((tab) => (
            <button
              key={tab.section}
              className={cn("tv-tab", active === tab.section && "active")}
              aria-current={active === tab.section ? "page" : undefined}
              onClick={() => setActive(tab.section)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {active === "reminders" ? (
          <AppointmentsAnalyticsClient />
        ) : (
          <div className="tv-empty">
            <h3 style={{ textTransform: "capitalize" }}>{active} analytics</h3>
            <p>
              This section is covered by its own analytics surface. The Reminders
              tab is active in this sandbox build.
            </p>
            <button
              className="tv-btn tv-btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setActive("reminders")}
            >
              Go to Reminders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
