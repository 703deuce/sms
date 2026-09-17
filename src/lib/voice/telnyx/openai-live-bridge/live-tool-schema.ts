/**
 * OpenAI Live delegation uses strict function schemas (strict: true).
 * Telnyx/Voice V2 bodies use partial nested objects; adapt without changing certified executors.
 */
type JsonSchemaObject = Record<string, unknown>;

function isObjectSchema(node: JsonSchemaObject): boolean {
  const t = node.type;
  if (t === "object") return true;
  if (Array.isArray(t) && t.includes("object")) return true;
  return Boolean(node.properties && typeof node.properties === "object");
}

function makeNullableStringLeaf(node: JsonSchemaObject): JsonSchemaObject {
  const t = node.type;
  if (t === "string") {
    return { ...node, type: ["string", "null"] };
  }
  if (Array.isArray(t) && t.includes("string") && !t.includes("null")) {
    return { ...node, type: [...t, "null"] };
  }
  return node;
}

function normalizeSchemaNode(node: JsonSchemaObject): JsonSchemaObject {
  if (!node || typeof node !== "object") return node;

  if (node.anyOf && Array.isArray(node.anyOf)) {
    return {
      ...node,
      anyOf: (node.anyOf as JsonSchemaObject[]).map((child) => normalizeSchemaNode(child)),
    };
  }

  if (isObjectSchema(node)) {
    const props = (node.properties ?? {}) as Record<string, JsonSchemaObject>;
    const nextProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(props)) {
      nextProps[key] = normalizeSchemaNode(val);
    }
    return {
      ...node,
      type: "object",
      properties: nextProps,
      required: Object.keys(nextProps),
      additionalProperties: false,
    };
  }

  if (node.type === "boolean") {
    return { ...node, type: ["boolean", "null"] };
  }

  if (node.enum) {
    return { ...node, type: ["string", "null"] };
  }

  return makeNullableStringLeaf(node);
}

/** Deep-adapt Voice V2 tool parameters for OpenAI Live strict function tools. */
export function adaptParametersForOpenAiLiveStrict(
  parameters: JsonSchemaObject,
): JsonSchemaObject {
  return normalizeSchemaNode(parameters);
}
