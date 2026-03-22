---
name: add-mock
description: >
  Add or modify MSW mock handlers and fixture data for the FinanceManager project.
  Use this skill when the user needs to add a new API endpoint mock, update existing fixture data,
  add more transactions/accounts/credit cards to fixtures, or debug why an API mock isn't working.
  Covers both browser (MSW worker) and Node (MSW server for tests) setups.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# Add Mock Skill — FinanceManager

## MSW Setup Overview

This project uses MSW v2 with two modes:
- **Browser (dev):** `src/mocks/browser.ts` → `setupWorker(handlers)`
- **Node (tests):** `src/mocks/server.ts` → `setupServer(handlers)`
- **Handlers:** `src/mocks/handlers.ts` — single source of truth
- **Fixtures:** `src/mocks/fixtures/` — static data arrays

## Before Modifying Mocks

Read these files first (use parallel reads):
1. `src/mocks/handlers.ts` — existing handlers
2. `src/mocks/fixtures/accounts.ts` — bank account fixtures
3. `src/mocks/fixtures/transactions.ts` — bank transaction fixtures
4. `src/mocks/fixtures/creditCards.ts` — credit card fixtures

## Handler Structure

```ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // GET list with cursor pagination
  http.get('/api/resource', ({ request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const search = url.searchParams.get('search')?.toLowerCase()

    let results = FIXTURES

    // Apply filters
    if (search) {
      results = results.filter(item =>
        item.description.toLowerCase().includes(search)
      )
    }

    // Apply cursor pagination
    const startIdx = cursor
      ? results.findIndex(r => r.id === cursor) + 1
      : 0
    const page = results.slice(startIdx, startIdx + limit)
    const nextCursor = startIdx + limit < results.length
      ? page[page.length - 1]?.id ?? null
      : null

    return HttpResponse.json({
      data: page,
      nextCursor,
      total: results.length,
    })
  }),

  // GET single resource
  http.get('/api/resource/:id', ({ params }) => {
    const item = FIXTURES.find(r => r.id === params.id)
    if (!item) return HttpResponse.json({ code: 'NOT_FOUND', message: 'Not found' }, { status: 404 })
    return HttpResponse.json(item)
  }),

  // POST create
  http.post('/api/resource', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...body, id: crypto.randomUUID() }, { status: 201 })
  }),
]
```

## Fixture File Pattern

```ts
// src/mocks/fixtures/newResource.ts
import type { NewResource } from '@/types/newResource'

export const NEW_RESOURCE_FIXTURES: NewResource[] = [
  {
    id: 'nr-1',
    // ... fields matching Zod schema
  },
]
```

## Currency Amounts (Vietnamese Dong)

Always use Vietnamese Dong amounts (positive integers, no decimals):
- Small: 15_000 (coffee), 50_000 (meal)
- Medium: 500_000, 1_500_000 (shopping)
- Large: 5_000_000, 15_000_000 (rent, salary)

## Transaction Categories (Vietnamese)

```ts
type Category = 'Ăn uống' | 'Mua sắm' | 'Di chuyển' | 'Giải trí' | 'Hóa đơn' | 'Khác'
```

Use `classifyTransaction(merchantName)` from `@/utils/categories` to auto-classify.

## Date Patterns

- Use ISO 8601 UTC strings: `"2026-01-15T07:30:00.000Z"`
- Dates should be in range Dec 2025 – Mar 2026 to match existing fixtures
- Transaction `amount`: positive = income, negative = expense

## Adding Transactions to Fixtures

When adding bank transactions:
```ts
{
  id: 'tx-NEW',
  accountId: 'vcb-1',          // or 'tcb-1'
  amount: -150000,              // negative = expense
  description: 'Mua cà phê',
  merchantName: 'Highlands Coffee',
  category: 'Ăn uống',
  type: 'expense' as const,
  status: 'posted' as const,
  transactionDate: '2026-01-20T08:00:00.000Z',
  postedDate: '2026-01-20T10:00:00.000Z',
}
```

## Simulate Network Delays (Optional)

```ts
import { delay } from 'msw'

http.get('/api/slow-endpoint', async () => {
  await delay(800)  // ms
  return HttpResponse.json(data)
})
```

## Debugging Mock Issues

If a mock isn't intercepting requests:
1. Verify MSW is enabled: `VITE_ENABLE_MSW=true` in `.env.local`
2. Check browser devtools Network tab — MSW logs intercepted requests
3. Check browser console for `[MSW] Mocking enabled` message
4. Ensure handler path exactly matches the API call path
5. For tests, verify `server.listen()` is called in test setup

Run to check env:
```bash
cat .env.local
```
