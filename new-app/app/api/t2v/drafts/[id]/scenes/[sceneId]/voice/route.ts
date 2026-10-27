import { postSceneVoice } from '@/lib/server/t2v/scene-voice'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const { id, sceneId } = await ctx.params
  return postSceneVoice(id, sceneId)
}
