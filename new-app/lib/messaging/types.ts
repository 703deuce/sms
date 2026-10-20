export class JobDeferredError extends Error {
  constructor(message = "Job deferred") {
    super(message);
    this.name = "JobDeferredError";
  }
}
