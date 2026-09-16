/** Apply strict JSON-schema constraints for Telnyx tool parameters. */
export function strictToolSchema(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  next.additionalProperties = false;
  if (next.type !== "object") next.type = "object";
  if (next.properties && typeof next.properties === "object") {
    const props = { ...(next.properties as Record<string, unknown>) };
    for (const [key, val] of Object.entries(props)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>;
        props[key] =
          "additionalProperties" in obj ? { ...obj } : { ...obj, additionalProperties: false };
      }
    }
    next.properties = props;
  }
  return next;
}

export function strictWebhookBodyParameters(
  bodyParameters: Record<string, unknown>,
): Record<string, unknown> {
  return strictToolSchema(bodyParameters);
}
