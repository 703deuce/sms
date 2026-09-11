export type RoutingSectionId =
  | "overview"
  | "rules"
  | "pools"
  | "services"
  | "test"
  | "activity"
  | "settings"
  | "type-rules";

export const ROUTING_SECTIONS: Array<{ id: RoutingSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "rules", label: "Routing rules" },
  { id: "pools", label: "Staff pools" },
  { id: "services", label: "Service assignments" },
  { id: "test", label: "Routing test" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];
