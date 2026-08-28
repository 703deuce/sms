/**
 * Type-aware field operators for triggers, conditions, and field-change waits.
 */

export type FieldType = "text" | "number" | "date" | "boolean";

export type FieldOperator = {
  value: string;
  label: string;
  /** When false, hide the value input in settings UI */
  requiresValue: boolean;
};

export const TEXT_OPERATORS: FieldOperator[] = [
  { value: "is", label: "Is", requiresValue: true },
  { value: "is_not", label: "Is Not", requiresValue: true },
  { value: "contains", label: "Contains", requiresValue: true },
  { value: "not_contains", label: "Does Not Contain", requiresValue: true },
  { value: "starts_with", label: "Starts With", requiresValue: true },
  { value: "ends_with", label: "Ends With", requiresValue: true },
  { value: "has_value", label: "Has Any Value", requiresValue: false },
  { value: "has_no_value", label: "Has No Value", requiresValue: false },
];

export const NUMBER_OPERATORS: FieldOperator[] = [
  { value: "equals", label: "Equals", requiresValue: true },
  { value: "not_equal", label: "Not Equal", requiresValue: true },
  { value: "greater_than", label: "Greater Than", requiresValue: true },
  { value: "greater_than_or_equal", label: "Greater Than or Equal", requiresValue: true },
  { value: "less_than", label: "Less Than", requiresValue: true },
  { value: "less_than_or_equal", label: "Less Than or Equal", requiresValue: true },
  { value: "between", label: "Between", requiresValue: true },
];

export const DATE_OPERATORS: FieldOperator[] = [
  { value: "is", label: "Is", requiresValue: true },
  { value: "before", label: "Is Before", requiresValue: true },
  { value: "after", label: "Is After", requiresValue: true },
  { value: "between", label: "Between", requiresValue: true },
  { value: "within_last", label: "Within Last", requiresValue: true },
  { value: "within_next", label: "Within Next", requiresValue: true },
  { value: "has_value", label: "Has Any Value", requiresValue: false },
  { value: "has_no_value", label: "Has No Value", requiresValue: false },
];

export const BOOLEAN_OPERATORS: FieldOperator[] = [
  { value: "yes", label: "Yes", requiresValue: false },
  { value: "no", label: "No", requiresValue: false },
];

export const MESSAGE_MATCH_TYPES = [
  { value: "any", label: "Any message" },
  { value: "exact", label: "Exact text" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "keyword", label: "Keyword" },
  { value: "email", label: "Email address detected" },
  { value: "phone", label: "Phone number detected" },
  { value: "url", label: "URL detected" },
  { value: "yes_no", label: "Yes/No" },
  { value: "number", label: "Number" },
  { value: "pattern", label: "Advanced custom pattern" },
] as const;

export const CONTACT_FIELD_OPTIONS = [
  { value: "firstName", label: "First name", type: "text" as FieldType },
  { value: "lastName", label: "Last name", type: "text" as FieldType },
  { value: "email", label: "Email", type: "text" as FieldType },
  { value: "phone", label: "Phone", type: "text" as FieldType },
  { value: "company", label: "Company", type: "text" as FieldType },
  { value: "status", label: "Status", type: "text" as FieldType },
  { value: "birthday", label: "Birthday", type: "date" as FieldType },
  { value: "consentDate", label: "Consent date", type: "date" as FieldType },
  { value: "lastReply", label: "Last reply", type: "date" as FieldType },
];

export function operatorsForFieldType(fieldType: FieldType): FieldOperator[] {
  switch (fieldType) {
    case "number":
      return NUMBER_OPERATORS;
    case "date":
      return DATE_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

export function operatorRequiresValue(
  fieldType: FieldType,
  operator: string,
): boolean {
  const ops = operatorsForFieldType(fieldType);
  return ops.find((o) => o.value === operator)?.requiresValue ?? true;
}

export function fieldTypeForContactField(field: string): FieldType {
  const found = CONTACT_FIELD_OPTIONS.find((f) => f.value === field);
  return found?.type ?? "text";
}
