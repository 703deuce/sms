import { SYSTEM_FIELD_IDS } from "./system-fields";

/** Map legacy save_caller_info flat args → field-id entries (migration shim only). */
export function legacyFlatArgsToFieldEntries(
  args: Record<string, unknown>,
): Array<{ field_id: string; value: unknown }> {
  if (Array.isArray(args.fields)) {
    return (args.fields as Array<{ field_id?: string; value?: unknown }>)
      .filter((r) => r?.field_id)
      .map((r) => ({ field_id: String(r.field_id), value: r.value }));
  }

  const out: Array<{ field_id: string; value: unknown }> = [];
  const name = args.name || args.customerName || args.customer_name || args.full_name;
  if (name) out.push({ field_id: SYSTEM_FIELD_IDS.name, value: name });
  const phone = args.phone || args.customerPhone || args.customer_phone;
  if (phone) out.push({ field_id: SYSTEM_FIELD_IDS.phone, value: phone });
  const email = args.email || args.customerEmail || args.customer_email;
  if (email) out.push({ field_id: SYSTEM_FIELD_IDS.email, value: email });
  const address = args.address || args.service_address || args.location;
  if (address) out.push({ field_id: SYSTEM_FIELD_IDS.address, value: address });
  const service = args.serviceName || args.service || args.service_name;
  if (service) out.push({ field_id: SYSTEM_FIELD_IDS.service, value: service });
  const message = args.message || args.reason;
  if (message) out.push({ field_id: SYSTEM_FIELD_IDS.message, value: message });

  if (args.custom_fields && typeof args.custom_fields === "object") {
    for (const [key, value] of Object.entries(args.custom_fields as Record<string, unknown>)) {
      if (value != null) out.push({ field_id: key, value });
    }
  }

  return out;
}
