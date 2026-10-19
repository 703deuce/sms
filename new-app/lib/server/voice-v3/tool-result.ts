export type ToolOk<T = Record<string, unknown>> = {
  ok: true;
  status: string;
  data?: T;
  [key: string]: unknown;
};

export type ToolErr = {
  ok: false;
  status: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type ToolResult<T = Record<string, unknown>> = ToolOk<T> | ToolErr;

export function toolOk<T extends Record<string, unknown>>(status: string, data?: T): ToolOk<T> {
  return data ? { ok: true, status, ...data } : { ok: true, status };
}

export function toolErr(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  retryable?: boolean,
): ToolErr {
  return { ok: false, status: "error", code, message, details, retryable };
}
