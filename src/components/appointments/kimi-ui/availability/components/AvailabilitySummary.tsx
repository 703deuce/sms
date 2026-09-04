import { Globe, Clock, CalendarDays, CalendarRange, Sparkles } from "lucide-react";

const items = [
  {
    icon: <Globe size={15} />,
    bg: "#efecfd",
    color: "#5b45e0",
    title: "Timezone",
    value: "America/New_York",
  },
  {
    icon: <Clock size={15} />,
    bg: "#e6f7ef",
    color: "#16a05a",
    title: "Minimum notice",
    value: "60 minutes",
  },
  {
    icon: <CalendarDays size={15} />,
    bg: "#efecfd",
    color: "#5b45e0",
    title: "Booking horizon",
    value: "14 days",
  },
  {
    icon: <CalendarRange size={15} />,
    bg: "#fdf3e3",
    color: "#d98a16",
    title: "Weekly coverage",
    value: "5 days per week",
  },
  {
    icon: <Sparkles size={15} />,
    bg: "#f1eafd",
    color: "#7c3aed",
    title: "Next available",
    value: "Tomorrow at 9:00 AM",
  },
];

export default function AvailabilitySummary() {
  return (
    <aside className="avail-card avail-fade-in avail-fade-in-1 p-5">
      <h3 className="text-[14px] font-semibold text-[#1c1a2e]">Availability summary</h3>
      <p className="text-[12px] text-[#8a87a0] mt-0.5 mb-4">Overview of your current settings.</p>

      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`flex items-center gap-3 py-2.5 ${
              i < items.length - 1 ? "border-b border-[#f2f1f7]" : ""
            }`}
          >
            <span
              className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
              style={{ background: item.bg, color: item.color }}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[#1c1a2e]">{item.title}</div>
              <div className="text-[12px] text-[#8a87a0] truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
