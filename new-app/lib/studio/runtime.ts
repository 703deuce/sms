import { getClipStorage, storageDriverName } from '../storage'
import { createStudioKieClient } from './kie-client'
import { createPrismaStudioStore } from './store-prisma'
import { studioConcurrencyLimit, type StudioService, type StudioStorage } from './jobs'

export function defaultStudioStorage(): StudioStorage {
  return {
    async putBytes(objectKey, body, contentType) {
      await getClipStorage().putBytes(objectKey, body, contentType)
    },
    async createSignedDownloadUrl(objectKey, expiresInSec) {
      return getClipStorage().createSignedDownloadUrl(objectKey, expiresInSec)
    },
    driverName: () => storageDriverName(),
  }
}

export function createDefaultStudioService(): StudioService {
  return {
    store: createPrismaStudioStore(),
    kie: createStudioKieClient(),
    storage: defaultStudioStorage(),
    concurrencyLimit: studioConcurrencyLimit(),
    now: () => new Date(),
  }
}
