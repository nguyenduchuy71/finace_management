# MSW Mock Patterns Reference

## Handler Structure

```ts
// In src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

http.get('/api/foos', ({ request }) => {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Number(url.searchParams.get('limit') ?? 20)

  // Apply cursor-based pagination
  const startIdx = cursor ? FIXTURES.findIndex(f => f.id === cursor) + 1 : 0
  const page = FIXTURES.slice(startIdx, startIdx + limit)
  const nextCursor = startIdx + limit < FIXTURES.length
    ? page[page.length - 1]?.id ?? null
    : null

  return HttpResponse.json({
    data: page,
    nextCursor,
    total: FIXTURES.length,
  })
}),
```

## Fixture File Pattern

```ts
// src/mocks/fixtures/foos.ts
import type { Foo } from '@/types/foo'

export const FOO_FIXTURES: Foo[] = [
  {
    id: 'foo-1',
    name: 'Example Foo',
    amount: 1500000,
  },
]
```

## Filtering in Handlers

```ts
http.get('/api/accounts/:accountId/transactions', ({ request, params }) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.toLowerCase()
  const txType = url.searchParams.get('txType') // 'income' | 'expense' | 'all'
  const category = url.searchParams.get('category')

  let results = TRANSACTION_FIXTURES

  if (search) {
    results = results.filter(t =>
      t.description.toLowerCase().includes(search) ||
      t.merchantName?.toLowerCase().includes(search)
    )
  }
  if (txType && txType !== 'all') {
    results = results.filter(t => t.type === txType)
  }
  if (category) {
    results = results.filter(t => t.category === category)
  }

  // ... pagination
})
```
