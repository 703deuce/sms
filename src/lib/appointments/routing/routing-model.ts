import type {
  AppointmentTypeConfig,
  AutoAssignmentMethod,
  CustomerStaffSelectionMode,
  StaffAssignmentMode,
  StaffRoutingConfig,
} from "@/lib/appointments/types";

export type DecodedRoutingPolicy = {
  usesWorkspaceDefault: boolean;
  customerSelection: CustomerStaffSelectionMode;
  autoMethod: AutoAssignmentMethod;
  staffAssignment: StaffAssignmentMode;
  isRoutable: boolean;
  routingNaReason?: string;
};

const DEFAULT_WORKSPACE_ROUTING: StaffRoutingConfig = {
  defaultCustomerSelection: "auto_assign_hidden",
  defaultAutoMethod: "round_robin",
  rescheduleWhenStaffUnavailable: "require_new_slot",
  countCancelledTowardBalance: false,
  countManualTowardBalance: true,
};

export function normalizeStaffRouting(config?: StaffRoutingConfig): StaffRoutingConfig {
  return { ...DEFAULT_WORKSPACE_ROUTING, ...config };
}

export function staffAssignmentToAutoMethod(mode: StaffAssignmentMode): AutoAssignmentMethod {
  if (mode === "round_robin") return "round_robin";
  if (mode === "priority") return "priority";
  if (mode === "maximize_availability") return "maximize_availability";
  return "first_eligible";
}

export function staffAssignmentToCustomerSelection(
  cfg: AppointmentTypeConfig,
): CustomerStaffSelectionMode {
  if (cfg.staffAssignment === "customer_chooses") {
    return cfg.allowAnyAvailable ? "customer_may_choose_or_any" : "customer_must_choose";
  }
  if (cfg.staffAssignment === "specific_staff" || cfg.staffAssignment === "collective") {
    return "auto_assign_hidden";
  }
  return "auto_assign_hidden";
}

export function encodeStaffAssignment(
  customerSelection: CustomerStaffSelectionMode,
  autoMethod: AutoAssignmentMethod,
): StaffAssignmentMode {
  if (customerSelection === "customer_must_choose") return "customer_chooses";
  if (customerSelection === "customer_may_choose_or_any") return "customer_chooses";
  if (autoMethod === "round_robin") return "round_robin";
  if (autoMethod === "priority") return "priority";
  if (autoMethod === "maximize_availability") return "maximize_availability";
  return "any_eligible";
}

export function decodeRoutingPolicy(
  cfg: AppointmentTypeConfig,
  workspace: StaffRoutingConfig,
): DecodedRoutingPolicy {
  const kind = cfg.bookingTypeKind || "SERVICE";
  if (kind === "CLASS") {
    return {
      usesWorkspaceDefault: true,
      customerSelection: "auto_assign_hidden",
      autoMethod: "first_eligible",
      staffAssignment: cfg.staffAssignment || "any_eligible",
      isRoutable: false,
      routingNaReason: "Scheduled instructor on class occurrence",
    };
  }

  const usesWorkspaceDefault = Boolean(cfg.useWorkspaceRoutingDefault);
  const ws = normalizeStaffRouting(workspace);

  let customerSelection = staffAssignmentToCustomerSelection(cfg);
  let autoMethod = staffAssignmentToAutoMethod(cfg.staffAssignment || "any_eligible");

  if (usesWorkspaceDefault) {
    customerSelection = ws.defaultCustomerSelection || "auto_assign_hidden";
    autoMethod = ws.defaultAutoMethod || "round_robin";
  }

  const staffAssignment = encodeStaffAssignment(customerSelection, autoMethod);
  const poolSize = cfg.staffIds?.length || 0;
  const isRoutable =
    staffAssignment !== "specific_staff" &&
    staffAssignment !== "collective" &&
    (staffAssignment === "customer_chooses" ? poolSize > 0 : poolSize > 1 || staffAssignment === "any_eligible");

  return {
    usesWorkspaceDefault,
    customerSelection,
    autoMethod,
    staffAssignment,
    isRoutable,
    routingNaReason: isRoutable ? undefined : poolSize === 0 ? "No eligible staff assigned" : undefined,
  };
}

export function routingMethodLabel(method: AutoAssignmentMethod | StaffAssignmentMode): string {
  switch (method) {
    case "round_robin":
      return "Round Robin";
    case "priority":
      return "Priority";
    case "maximize_availability":
      return "Least loaded (open slots)";
    case "first_eligible":
    case "any_eligible":
      return "First eligible";
    case "customer_chooses":
      return "Customer chooses";
    case "specific_staff":
      return "Specific staff";
    case "collective":
      return "Collective";
    default:
      return String(method);
  }
}

export function customerSelectionLabel(mode: CustomerStaffSelectionMode): string {
  switch (mode) {
    case "customer_must_choose":
      return "Customer must choose staff";
    case "customer_may_choose_or_any":
      return "Customer may choose or Any available";
    case "auto_assign_hidden":
      return "Auto-assign (hide staff step)";
    default:
      return mode;
  }
}
