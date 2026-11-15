import { createLiveMotionStudioClient, MotionStudioHttpError, type MotionStudioClient } from './client'
import { createMockMotionStudioClient } from './mock-client'

export * from './types'
export * from './config'
export * from './format'
export { createLiveMotionStudioClient, MotionStudioHttpError, assetKindForFile, newIdempotencyKey } from './client'
export type { MotionStudioClient } from './client'
export { createMockMotionStudioClient } from './mock-client'
export { buildMotionTracks } from './timeline'

/** FE-only example project (contract v1.1: `isExample` is always false on the backend). */
export const MS_EXAMPLE_PROJECT_ID = 'ms_example_gamestop'
export const isExampleProjectId = (id: string) => id === MS_EXAMPLE_PROJECT_ID

/**
 * Live is the default: the real `/api/motion-studio/*` backend (session cookie, same origin).
 * `NEXT_PUBLIC_MOTION_STUDIO_LIVE=0` is the only way back to the in-browser mock (local dev / demos).
 */
export function motionStudioLiveEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOTION_STUDIO_LIVE !== '0'
}

const READ_ONLY = () =>
  new MotionStudioHttpError(403, 'EXAMPLE_READ_ONLY', 'The example project is read-only. Start a new documentary to make your own.')

/**
 * Live client plus the local, read-only Example project. Calls for the example id are served by an
 * in-memory mock (reads only; every mutation is refused); everything else goes to the live backend.
 * The example is listed after the user's real projects; if the live list fails (e.g. 401), that error wins.
 */
export function withLocalExample(live: MotionStudioClient, example: MotionStudioClient = createMockMotionStudioClient({ storage: null, seedExample: true })): MotionStudioClient {
  const ex = isExampleProjectId
  const guard =
    <A extends unknown[], R>(liveFn: (id: string, ...a: A) => Promise<R>) =>
    (id: string, ...a: A): Promise<R> =>
      ex(id) ? Promise.reject(READ_ONLY()) : liveFn(id, ...a)
  return {
    mode: live.mode,
    async listProjects() {
      const mine = await live.listProjects()
      const examples = (await example.listProjects()).filter((p) => ex(p.id))
      return [...mine.filter((p) => !ex(p.id)), ...examples]
    },
    createProject: (input) => live.createProject(input),
    getProject: (id) => (ex(id) ? example.getProject(id) : live.getProject(id)),
    listActivity: (id, after) => (ex(id) ? example.listActivity(id, after) : live.listActivity(id, after)),
    listAssets: (id) => (ex(id) ? example.listAssets(id) : live.listAssets(id)),
    getAllowance: (id) => (ex(id) ? example.getAllowance(id) : live.getAllowance(id)),
    updateProject: guard(live.updateProject),
    createPlan: guard(live.createPlan),
    startProduction: guard(live.startProduction),
    approveStory: guard(live.approveStory),
    requestStoryChanges: guard(live.requestStoryChanges),
    addAssets: guard(live.addAssets),
    replaceAsset: guard(live.replaceAsset),
    updateScene: guard(live.updateScene),
    regenerateScene: guard(live.regenerateScene),
    sendDirectorMessage: guard(live.sendDirectorMessage),
    decideProposal: guard(live.decideProposal),
    retryStage: guard(live.retryStage),
    startExport: guard(live.startExport),
    getExportDownload: guard(live.getExportDownload),
    openInEditor: guard(live.openInEditor),
    cancelProject: guard(live.cancelProject),
    uploadFile: (file, onProgress) => live.uploadFile(file, onProgress),
  }
}

let singleton: MotionStudioClient | null = null
export function getMotionStudioClient(): MotionStudioClient {
  if (!singleton) singleton = motionStudioLiveEnabled() ? withLocalExample(createLiveMotionStudioClient()) : createMockMotionStudioClient()
  return singleton
}
