export type DomainActionTiming = {
  action: string;
  callId: string;
  taskId?: string;
  invokedAt: string;
  domainStartMs: number;
  providerStartMs?: number;
  providerEndMs?: number;
  domainEndMs: number;
  totalMs: number;
  ok: boolean;
  errorCode?: string;
};

export function startDomainActionTimer(action: string, callId: string, taskId?: string) {
  const started = Date.now();
  let providerStart = 0;
  let providerEnd = 0;
  return {
    markProviderStart() {
      providerStart = Date.now();
    },
    markProviderEnd() {
      providerEnd = Date.now();
    },
    finish(ok: boolean, errorCode?: string): DomainActionTiming {
      const ended = Date.now();
      const timing: DomainActionTiming = {
        action,
        callId,
        taskId,
        invokedAt: new Date(started).toISOString(),
        domainStartMs: 0,
        providerStartMs: providerStart ? providerStart - started : undefined,
        providerEndMs: providerEnd ? providerEnd - started : undefined,
        domainEndMs: ended - started,
        totalMs: ended - started,
        ok,
        errorCode,
      };
      console.info("[amy.domain_action]", JSON.stringify(timing));
      return timing;
    },
  };
}
