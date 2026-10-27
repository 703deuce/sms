const SCENE_ID_RE = /^[A-Za-z0-9_-]+$/

export function assertValidT2vSceneId(sceneId: string) {
  if (!SCENE_ID_RE.test(sceneId)) throw new Error('invalid_scene_id')
}
