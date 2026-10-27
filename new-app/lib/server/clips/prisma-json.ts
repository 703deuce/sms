import type { Prisma } from '@prisma/client'

/** Prisma JSON columns — strip undefined and satisfy InputJsonValue. */
export function toPrismaJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
