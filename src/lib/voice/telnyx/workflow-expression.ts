/**
 * Telnyx Conversation Workflow expression AST helpers.
 * @see https://developers.telnyx.com/docs/inference/ai-assistants/workflows
 */

export type TelnyxExpression = Record<string, unknown>;

export function exprVariable(name: string): TelnyxExpression {
  return { type: "variable", name };
}

export function exprString(value: string): TelnyxExpression {
  return { type: "string_literal", value };
}

export function exprBool(value: boolean): TelnyxExpression {
  return { type: "bool_literal", value };
}

export function exprComparison(
  left: TelnyxExpression,
  op: "==" | "!=" | ">" | ">=" | "<" | "<=",
  right: TelnyxExpression,
): TelnyxExpression {
  return { type: "comparison", op, left, right };
}

export function exprVarEqualsString(name: string, value: string): TelnyxExpression {
  return exprComparison(exprVariable(name), "==", exprString(value));
}

export function exprVarEqualsBool(name: string, value: boolean): TelnyxExpression {
  return exprComparison(exprVariable(name), "==", exprBool(value));
}

export function llmEdgeCondition(prompt: string): Record<string, unknown> {
  return { type: "llm", prompt };
}

export function expressionEdgeCondition(expression: TelnyxExpression): Record<string, unknown> {
  return { type: "expression", expression };
}
