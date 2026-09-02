"use client";

import { useEffect, useState } from "react";
import InboxSettings from "@/components/kimi/auto-replies/components/InboxSettings";
import {
  businessHoursToKimiActiveDays,
  fetchMessagingRuntimeSettings,
  inboxPermissionsToKimiToggles,
  kimiActiveDaysToBusinessHours,
  kimiTogglesToInboxPermissions,
  patchMessagingRuntimeSettings,
} from "@/lib/auto-replies/kimi-messaging-settings-adapter";

export function ConversationsInboxSettingsWired({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [awayMessage, setAwayMessage] = useState("");
  const [awayInsideMessage, setAwayInsideMessage] = useState("");
  const [awayEnabled, setAwayEnabled] = useState(true);
  const [officeHoursEnabled, setOfficeHoursEnabled] = useState(true);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [inboxToggles, setInboxToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchMessagingRuntimeSettings()
      .then((s) => {
        setAwayMessage(s.awayMessage || "");
        setAwayInsideMessage(s.awayInsideMessage || "");
        setAwayEnabled(s.awayEnabled);
        setOfficeHoursEnabled(!s.awayAlways && !!s.businessHoursJson);
        setActiveDays(businessHoursToKimiActiveDays(s.businessHoursJson));
        setTimezone(s.timezone || "America/New_York");
        setInboxToggles(inboxPermissionsToKimiToggles(s.inboxPermissionsJson));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
        Loading inbox settings…
      </div>
    );
  }

  return (
    <InboxSettings
      onBack={onBack}
      initialAwayMessage={awayMessage}
      initialAwayInsideMessage={awayInsideMessage}
      initialAwayEnabled={awayEnabled}
      initialOfficeHoursEnabled={officeHoursEnabled}
      initialActiveDays={activeDays}
      initialTimezone={timezone}
      initialInboxToggles={inboxToggles}
      onSave={async (payload) => {
        await patchMessagingRuntimeSettings({
          awayMessage: payload.awayMessage || null,
          awayInsideMessage: payload.awayInsideMessage || null,
          awayEnabled: payload.awayEnabled,
          awayAlways: payload.officeHoursEnabled ? false : true,
          businessHoursJson: payload.officeHoursEnabled
            ? kimiActiveDaysToBusinessHours(payload.activeDays || activeDays)
            : null,
          timezone: payload.timezone || timezone,
          inboxPermissionsJson: payload.inboxToggles
            ? kimiTogglesToInboxPermissions(payload.inboxToggles)
            : undefined,
        });
      }}
    />
  );
}
