/**
 * Maps Kimi segment builder UI state → SegmentConditions for /api/contacts/segments.
 */
import type { SegmentConditions, SegmentOperator, SegmentRule } from "@/lib/contacts/segment-query";
import { parseSegmentConditions } from "@/lib/contacts/segment-query";

export type KimiConditionState = {
  property: string;
  condition: string;
  value: string;
  values?: string[];
};

export type KimiConditionGroup = {
  conditions: KimiConditionState[];
};

function mapOptInStatus(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "subscribed") return "SUBSCRIBED";
  if (v === "unsubscribed") return "UNSUBSCRIBED";
  if (v === "blocked") return "BLOCKED";
  if (v === "not subscribed") return "UNSUBSCRIBED";
  return value.trim().toUpperCase();
}

function mapOperator(condition: string): SegmentOperator | null {
  switch (condition) {
    case "Is":
      return "equals";
    case "Is Not":
      return "not_equals";
    case "Is Less Than":
      return "lt";
    case "Is Less Than Or Equal To":
      return "lte";
    case "Is Greater Than":
      return "gt";
    case "Is Greater Than or Equal To":
      return "gte";
    case "Is Between":
      return "between";
    case "Is Not Between":
      return "not_between";
    case "Is Known":
      return "exists";
    case "Is Not Known":
      return "not_exists";
    default:
      return null;
  }
}

function mapProperty(property: string): string | null {
  switch (property) {
    case "Opt-In Status":
      return "status";
    case "Source":
      return "source";
    case "State":
      return "custom:state";
    case "City":
      return "custom:city";
    case "Age":
      return "custom:age";
    case "Email Address":
      return "email";
    case "First Name":
      return "firstName";
    case "Last Name":
      return "lastName";
    case "List Membership":
      return "list";
    case "Link Clicked":
      return "link_clicked";
    case "Campaign Sent":
      return "campaign_sent";
    case "Timezone":
      return "timezone";
    case "Created":
      return "createdAt";
    case "Area Code":
      return "areaCode";
    case "Favorite Sports Team":
      return "custom:favorite_sports_team";
    default:
      if (property.startsWith("custom:")) return property;
      return `custom:${property.toLowerCase().replace(/\s+/g, "_")}`;
  }
}

function mapOneCondition(cond: KimiConditionState): SegmentRule[] {
  if (!cond.property || !cond.condition) return [];
  const op = mapOperator(cond.condition);
  const field = mapProperty(cond.property);
  if (!op || !field) return [];

  if (cond.property === "State" && cond.values?.length) {
    if (cond.condition === "Is Not") {
      return [{ field, op: "not_in", value: cond.values.join(",") }];
    }
    if (cond.values.length > 1) {
      return [{ field, op: "in", value: cond.values.join(",") }];
    }
    return cond.values.map((v) => ({
      field,
      op: "equals",
      value: v,
    }));
  }

  const rawValue = cond.value?.trim() || "";
  const value = field === "status" ? mapOptInStatus(rawValue) : rawValue;

  if (op === "exists" || op === "not_exists") {
    return [{ field, op }];
  }
  if (!value && field !== "tag") return [];

  return [{ field, op, value }];
}

/** Convert Kimi AND/OR groups into API segment conditions (best-effort). */
export function kimiGroupsToSegmentConditions(groups: KimiConditionGroup[]): SegmentConditions {
  const activeGroups = groups
    .map((g) => ({
      conditions: g.conditions.filter((c) => c.property && c.condition),
    }))
    .filter((g) => g.conditions.length > 0);

  if (!activeGroups.length) return { match: "all", rules: [] };

  if (activeGroups.length === 1) {
    const rules = activeGroups[0].conditions.flatMap(mapOneCondition);
    const match = activeGroups[0].conditions.length > 1 ? "any" : "all";
    return { match, rules };
  }

  return {
    match: "all",
    rules: [],
    groups: activeGroups.map((g) => {
      const rules = g.conditions.flatMap(mapOneCondition);
      const match = g.conditions.length > 1 ? "any" : "all";
      return { match, rules };
    }),
  };
}

/** Seed Kimi builder from stored API conditions (partial reverse map). */
export function segmentConditionsToKimiGroups(conditions: unknown): KimiConditionGroup[] {
  const parsed = parseSegmentConditions(conditions);
  const rules = parsed.rules;
  if (!rules.length && !(parsed.groups || []).length) {
    return [{ conditions: [{ property: "", condition: "", value: "", values: [] }] }];
  }

  const reverseField = (field: string): string => {
    if (field === "status") return "Opt-In Status";
    if (field === "source") return "Source";
    if (field === "list") return "List Membership";
    if (field === "tag") return "Tag";
    if (field === "firstName") return "First Name";
    if (field === "lastName") return "Last Name";
    if (field === "email") return "Email Address";
    if (field === "timezone") return "Timezone";
    if (field === "createdAt") return "Created";
    if (field === "link_clicked") return "Link Clicked";
    if (field === "campaign_sent") return "Campaign Sent";
    if (field === "areaCode") return "Area Code";
    if (field.startsWith("custom:")) {
      const key = field.slice("custom:".length);
      const map: Record<string, string> = {
        state: "State",
        city: "City",
        age: "Age",
        email: "Email Address",
        firstname: "First Name",
        lastname: "Last Name",
        favorite_sports_team: "Favorite Sports Team",
      };
      return map[key] || key.replace(/_/g, " ");
    }
    return field;
  };

  const reverseOp = (op: SegmentOperator): string => {
    if (op === "exists") return "Is Known";
    if (op === "not_exists") return "Is Not Known";
    if (op === "not_equals") return "Is Not";
    if (op === "lt") return "Is Less Than";
    if (op === "lte") return "Is Less Than Or Equal To";
    if (op === "gt") return "Is Greater Than";
    if (op === "gte") return "Is Greater Than or Equal To";
    if (op === "between") return "Is Between";
    if (op === "not_between") return "Is Not Between";
    return "Is";
  };

  const ruleToKimi = (r: SegmentRule): KimiConditionState => {
    if (r.field === "custom:state" && r.op === "in" && r.value) {
      return {
        property: reverseField(r.field),
        condition: "Is",
        value: "",
        values: splitListValue(r.value),
      };
    }
    if (r.field === "custom:state" && r.op === "not_in" && r.value) {
      return {
        property: reverseField(r.field),
        condition: "Is Not",
        value: "",
        values: splitListValue(r.value),
      };
    }
    return {
      property: reverseField(r.field),
      condition: reverseOp(r.op),
      value: r.field === "status" ? r.value?.toLowerCase() || "" : r.value || "",
      values: r.field === "custom:state" && r.value ? [r.value] : [],
    };
  };

  if (parsed.groups?.length) {
    return parsed.groups.map((group) => ({
      conditions: group.rules.length
        ? group.rules.map(ruleToKimi)
        : [{ property: "", condition: "", value: "", values: [] }],
    }));
  }

  if (parsed.match === "all" && rules.length > 1) {
    return rules.map((r) => ({
      conditions: [ruleToKimi(r)],
    }));
  }

  return [
    {
      conditions: rules.map(ruleToKimi),
    },
  ];
}

function splitListValue(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((p) => p.trim())
    .filter(Boolean);
}
