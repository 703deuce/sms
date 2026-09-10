"use client";

import { Trash2 } from "lucide-react";
import type { StaffDayRow, StaffEditorTab, StaffRoundRobinStat } from "@/features/appointments/kimi/staff/types";

type Props = {
  tab: StaffEditorTab;
  name: string;
  active: boolean;
  customerSelectable: boolean;
  appointmentTypes: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  selectedTypeIds: string[];
  selectedLocationIds: string[];
  dayRows: StaffDayRow[];
  calendarColor: string;
  roundRobinStats: StaffRoundRobinStat[];
  saving: boolean;
  saved: boolean;
  error: string;
  onTabChange: (tab: StaffEditorTab) => void;
  onNameChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
  onCustomerSelectableChange: (value: boolean) => void;
  onToggleTypeId: (typeId: string) => void;
  onToggleLocationId: (locationId: string) => void;
  onSetCustomHours: (dayKey: string, enabled: boolean) => void;
  onUpdateWindow: (dayKey: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (dayKey: string) => void;
  onCalendarColorChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
};

const TABS: Array<{ id: StaffEditorTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "availability", label: "Availability" },
  { id: "assignments", label: "Assigned services" },
  { id: "calendar", label: "Calendar display" },
];

export default function StaffEditorPanel({
  tab,
  name,
  active,
  customerSelectable,
  appointmentTypes,
  locations,
  selectedTypeIds,
  selectedLocationIds,
  dayRows,
  calendarColor,
  roundRobinStats,
  saving,
  saved,
  error,
  onTabChange,
  onNameChange,
  onActiveChange,
  onCustomerSelectableChange,
  onToggleTypeId,
  onToggleLocationId,
  onSetCustomHours,
  onUpdateWindow,
  onAddWindow,
  onCalendarColorChange,
  onSave,
  onRemove,
}: Props) {
  return (
    <div className="card min-h-[560px] flex flex-col">
      <div className="px-5 pt-4 border-b border-[#ecedf2]">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`staff-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-5 space-y-5">
        {tab === "details" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="staff-name">Name</label>
                <input
                  id="staff-name"
                  className="input w-full"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-3 justify-end">
                <label className="flex items-center gap-2 text-[13px] text-[#3f4254]">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={active}
                    onChange={(e) => onActiveChange(e.target.checked)}
                  />
                  Active / bookable
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[#3f4254]">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={customerSelectable}
                    onChange={(e) => onCustomerSelectableChange(e.target.checked)}
                  />
                  Customer can select this staff member
                </label>
              </div>
            </div>
            <p className="text-[12.5px] text-[#8a8fa3]">
              Inactive staff won&apos;t appear on booking pages. If customer selection is disabled, routing rules
              or round robin will assign them automatically.
            </p>
          </>
        ) : null}

        {tab === "assignments" ? (
          <>
            {appointmentTypes.length > 0 ? (
              <div>
                <label className="label">Appointment types</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {appointmentTypes.map((t) => {
                    const selected = selectedTypeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                          selected
                            ? "bg-[#147d74] text-white border-[#147d74]"
                            : "border-[#e4e6ee] text-[#3f4254] hover:border-[#d8d2ff]"
                        }`}
                        onClick={() => onToggleTypeId(t.id)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#8a8fa3]">Create appointment types before assigning staff.</p>
            )}
            {locations.length > 0 ? (
              <div>
                <label className="label">Locations</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {locations.map((l) => {
                    const selected = selectedLocationIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                          selected
                            ? "bg-[#147d74] text-white border-[#147d74]"
                            : "border-[#e4e6ee] text-[#3f4254] hover:border-[#d8d2ff]"
                        }`}
                        onClick={() => onToggleLocationId(l.id)}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "availability" ? (
          <div className="space-y-2">
            <p className="text-[12.5px] text-[#8a8fa3] mb-3">
              Override workspace hours for this staff member. Leave a day on workspace defaults when no custom
              windows are set.
            </p>
            {dayRows.map((day) => (
              <div key={day.key} className="py-3 border-b border-[#ecedf2] last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-[13px] font-semibold text-[#1a1d29]">{day.label}</span>
                  {day.usesWorkspaceDefault ? (
                    <span className="text-[12.5px] text-[#8a8fa3]">Uses workspace hours</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {day.windows.map((w, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1">
                          <input
                            type="time"
                            className="input text-[12px] py-1.5"
                            value={w.open}
                            onChange={(e) => onUpdateWindow(day.key, idx, "open", e.target.value)}
                          />
                          <span className="text-[#8a8fa3]">–</span>
                          <input
                            type="time"
                            className="input text-[12px] py-1.5"
                            value={w.close}
                            onChange={(e) => onUpdateWindow(day.key, idx, "close", e.target.value)}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-[12px] font-semibold text-[#147d74]"
                    onClick={() => onSetCustomHours(day.key, !day.usesWorkspaceDefault)}
                  >
                    {day.usesWorkspaceDefault ? "Set custom" : "Use workspace default"}
                  </button>
                  {!day.usesWorkspaceDefault ? (
                    <button
                      type="button"
                      className="text-[12px] text-[#147d74]"
                      onClick={() => onAddWindow(day.key)}
                    >
                      + Add window
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "calendar" ? (
          <div className="space-y-5">
            <div>
              <label className="label" htmlFor="staff-calendar-color">Calendar color</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  id="staff-calendar-color"
                  type="color"
                  className="h-10 w-14 rounded border border-[#ecedf2] cursor-pointer"
                  value={calendarColor}
                  onChange={(e) => onCalendarColorChange(e.target.value)}
                />
                <span className="text-[13px] text-[#3f4254]">{calendarColor}</span>
              </div>
              <p className="text-[12.5px] text-[#8a8fa3] mt-2">
                Used on the appointments calendar when coloring by staff.
              </p>
            </div>
            {roundRobinStats.length > 0 ? (
              <div>
                <h4 className="text-[13px] font-semibold text-[#1a1d29]">Round robin activity</h4>
                <p className="text-[12px] text-[#8a8fa3] mt-1 mb-2">
                  Assignment counts from meeting types using round robin. Reset happens automatically as bookings assign staff.
                </p>
                <ul className="space-y-1.5 text-[12.5px]">
                  {roundRobinStats.map((stat) => (
                    <li key={stat.serviceKey} className="flex justify-between rounded-lg border px-3 py-2">
                      <span>{stat.serviceKey}</span>
                      <span className="text-[#8a8fa3]">
                        {stat.assignmentCount} assigned{stat.lastAssigned ? " · last pick" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[12.5px] text-[#8a8fa3]">
                No round robin assignments recorded yet for this staff member.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4 border-t border-[#ecedf2] flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-[13px] text-rose-600 font-medium inline-flex items-center gap-1.5"
          onClick={onRemove}
        >
          <Trash2 size={14} /> Remove staff
        </button>
        <div className="flex items-center gap-3">
          {saved ? <span className="text-[12px] text-emerald-600 font-medium">Saved</span> : null}
          {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
          <button
            type="button"
            className="btn-brand h-9 px-4 rounded-lg text-[13px] font-semibold disabled:opacity-60"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
