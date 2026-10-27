// GET ?q=&provider=pixabay|pexels|library|ai&type=video|image&page= -> candidates (Replace-media drawer grid)
// POST {action:'replace', media} | {action:'shuffle'} | {action:'upload', uploadId} | {action:'ai_image', prompt}
// ai_image REUSES lib/server/clips/broll-gen (KIE) with kind AI_IMAGE; returns generationId, poll /api/clips/generations/[id].
export { GET, POST } from '@/lib/server/t2v/routes/scene-media' // implementation lives in lib to keep the route thin
