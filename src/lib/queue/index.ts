export {
  enqueueJob,
  enqueueMapsScanJob,
  enqueueReviewImportJob,
  enqueueScanEnrichmentJob,
  getJobStatus,
  cancelJob,
  retryJob,
  updateProgress,
  heartbeat,
  recoverPendingEnqueues,
  reconcileLegacyPendingJobs,
  resolveQueueDriver,
} from "@/lib/queue/service";
export { dispatchFeatureJob } from "@/lib/queue/dispatch";
export { jobTypeToQueue } from "@/lib/queue/job-handlers";
export {
  JOB_LIFECYCLE,
  canTransitionLifecycle,
  deriveLifecycleStatus,
  isTerminalLifecycle,
} from "@/lib/platform/job-lifecycle";
export type { JobLifecycleStatus } from "@/lib/platform/job-lifecycle";
export {
  getQueueDriverName,
  getRedisUrl,
  assertRedisEndpointReady,
  sanitizeRedisUrlForLogs,
  CURRENT_UPSTASH_HOST,
  QUEUE_CONFIGS,
  brightDataFairChunkSize,
  brightDataMaxInFlight,
  brightDataStartRatePerSec,
} from "@/lib/queue/config";
export {
  acquireBrightDataSlot,
  acquireBrightDataSlots,
  fairChunkSize,
} from "@/lib/queue/bright-data-limiter";
export {
  assertCanEnqueueMapsScan,
  assertOrgMapsScanSlotAvailable,
  findDuplicateActiveScan,
  resolveOrgMapsConcurrentCap,
} from "@/lib/queue/fairness";
export { scheduleJitterMs, delayWithinWindowMs } from "@/lib/queue/schedule-jitter";
export {
  assertValidBullmqQueueName,
  assertValidBullmqPrefix,
  resolveBullmqQueueIdentity,
  listRegisteredQueueNames,
  QUEUE_NAME_REGISTRY,
} from "@/lib/queue/bullmq-names";
export { JOB_QUEUES, ALL_QUEUE_NAMES } from "@/lib/queue/types";
export type {
  EnqueueJobInput,
  EnqueueJobResult,
  QueueDriverName,
  QueueJobRecord,
  QueueName,
  JobPriorityClass,
} from "@/lib/queue/types";
