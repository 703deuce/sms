export const MCTB_DURABLE_OPERATION_JOB = "mctb_durable_operation_process";

/** Worker claim lease — expired leases may be reclaimed after crash/deploy. */
export const MCTB_DURABLE_OPERATION_LEASE_MS = 120_000;

export const MCTB_DURABLE_OPERATION_MAX_ATTEMPTS = 8;

export const MCTB_DURABLE_DEEPSEEK_ATTEMPT_TIMEOUT_MS = 25_000;
export const MCTB_DURABLE_PROVIDER_ATTEMPT_TIMEOUT_MS = 20_000;
