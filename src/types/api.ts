import { z } from 'zod'

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
})

export type ApiError = z.infer<typeof ApiErrorSchema>

// Generic paginated response factory — use as: PaginatedResponseSchema(TransactionSchema)
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number().int(),
  })

export type PaginatedResponse<T> = {
  data: T[]
  nextCursor: string | null
  total: number
}
