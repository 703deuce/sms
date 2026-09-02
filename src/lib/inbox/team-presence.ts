export type TeamPresenceRow = {
  userId: string;
  status: string;
  queueAvailable?: boolean;
  customLabel?: string | null;
  updatedAt?: string;
};

export function presenceLabel(status: string): string {
  switch (status) {
    case "available":
      return "Online";
    case "busy":
      return "Busy";
    case "on_call":
      return "On a call";
    case "away":
      return "Away";
    case "dnd":
      return "Do not disturb";
    case "offline":
      return "Offline";
    default:
      return "Online";
  }
}

export function presenceColor(status: string): string {
  switch (status) {
    case "available":
      return "#10b981";
    case "busy":
    case "on_call":
      return "#f59e0b";
    case "away":
      return "#9ca3af";
    case "dnd":
    case "offline":
      return "#ef4444";
    default:
      return "#10b981";
  }
}

export function presencePillStyles(status: string): {
  border: string;
  background: string;
  color: string;
} {
  const color = presenceColor(status);
  return {
    border: `1px solid ${color}55`,
    background: `${color}18`,
    color: status === "available" ? "#059669" : "#374151",
  };
}
