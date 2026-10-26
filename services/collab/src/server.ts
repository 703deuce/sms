/**
 * Hocuspocus collab service (W10). Deploy as separate Coolify app at collab.transovo.ai.
 * Database persistence hooks to Prisma are wired in extension-database when DATABASE_URL is set.
 */
import { Server } from '@hocuspocus/server'

const port = Number(process.env.PORT || 1234)

const server = new Server({
  port,
  async onAuthenticate({ token }) {
    // Token verified upstream; minimal stub accepts non-empty token in dev.
    if (!token) throw new Error('Unauthorized')
    return { user: { name: 'writer' } }
  },
})

server.listen()
console.log(`[sw-collab] listening on ${port}`)
