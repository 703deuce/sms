import type { PlatformToolErrorCode } from "./types";

export class PlatformToolError extends Error {
  constructor(
    public readonly code: PlatformToolErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly userMessage?: string,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PlatformToolError";
  }
}

export function platformFail(
  code: PlatformToolErrorCode,
  message: string,
  userMessage?: string,
  data: Record<string, unknown> = {},
): never {
  throw new PlatformToolError(code, message, false, userMessage, data);
}
