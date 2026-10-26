import { z } from 'zod'

export const swSceneV1Schema = z.object({
  scriptId: z.string(),
  versionId: z.string().optional(),
  scenes: z.array(
    z.object({
      elementId: z.string(),
      number: z.string().optional(),
      heading: z.string(),
      intExt: z.string().optional(),
      location: z.string().optional(),
      tod: z.string().optional(),
      action: z.array(z.string()),
      dialogue: z.array(
        z.object({
          character: z.string(),
          paren: z.string().optional(),
          text: z.string(),
        }),
      ),
      characters: z.array(z.object({ name: z.string(), description: z.string().optional() })),
      breakdown: z.record(z.unknown()).optional(),
      eighths: z.number().optional(),
    }),
  ),
})

export type SwSceneV1Payload = z.infer<typeof swSceneV1Schema>
