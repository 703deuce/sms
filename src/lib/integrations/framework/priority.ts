import type { ExternalProviderId } from "./types";

export type IntegrationJobKind =
  | "validate"
  | "initial"
  | "incremental"
  | "manual"
  | "write"
  | "webhook"
  | "metadata"
  | "health";

/** Lower number = higher priority. */
export function priorityForIntegrationKind(kind: IntegrationJobKind): number {
  switch (kind) {
    case "webhook":
      return 15;
    case "write":
      return 20;
    case "validate":
    case "health":
      return 25;
    case "incremental":
    case "manual":
      return 40;
    case "metadata":
      return 50;
    case "initial":
      return 70;
    default:
      return 50;
  }
}

export function integrationQueueName(provider: ExternalProviderId | string) {
  return `ext-${provider}`;
}
