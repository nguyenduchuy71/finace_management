import { http, HttpResponse } from 'msw'

// Handlers added in Plan 03
export const handlers: ReturnType<typeof http.get>[] = []

// Suppress unused import warning — HttpResponse used in Plan 03 handlers
void HttpResponse
