import { getSceneMedia, postSceneMedia } from '@/lib/server/t2v/routes/scene-media'

type Ctx = { params: Promise<{ id: string; sceneId: string }> }

export async function GET(request: Request, { params }: Ctx) {
  const { id, sceneId } = await params
  const url = new URL(request.url)
  return getSceneMedia(id, sceneId, {
    q: url.searchParams.get('q') ?? undefined,
    provider: url.searchParams.get('provider') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
  })
}

export async function POST(request: Request, { params }: Ctx) {
  const { id, sceneId } = await params
  return postSceneMedia(id, sceneId, request)
}
