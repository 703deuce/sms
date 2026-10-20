/** Prisma JSON column typing shim. */
export type InputJsonValue =
  | string
  | number
  | boolean
  | null
  | InputJsonValue[]
  | { [key: string]: InputJsonValue };
