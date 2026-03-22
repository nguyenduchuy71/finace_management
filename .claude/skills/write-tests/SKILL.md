---
name: write-tests
description: >
  Write, run, and fix tests for the FinanceManager project using Vitest + React Testing Library + MSW.
  Use this skill when the user asks to write tests, add test coverage, fix failing tests,
  or run the test suite. Covers unit tests for hooks/utils, component tests, and store tests.
  This is a read-focused skill that reads existing tests before writing new ones.
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent
---

# Write Tests Skill — FinanceManager

## Test Stack

- **Runner:** Vitest v4
- **Component testing:** React Testing Library
- **API mocking:** MSW v2 (Node server setup)
- **Assertions:** `@testing-library/jest-dom`
- **Commands:** `npm test` (watch), `npm run test:coverage`

## Before Writing Tests

Use an Explore sub-agent to read existing test files first:
- Search for `*.test.tsx` and `*.test.ts` in `src/` to understand current patterns
- Read `src/test-setup.ts` for global setup
- Read the target file before writing tests for it

## File Location Convention

Tests are **colocated** — place `.test.ts(x)` next to the source file:
```
src/hooks/useAccounts.ts          → src/hooks/useAccounts.test.ts
src/features/accounts/Tabs.tsx    → src/features/accounts/Tabs.test.tsx
src/stores/budgetStore.ts         → src/stores/budgetStore.test.ts
src/utils/currency.ts             → src/utils/currency.test.ts
```

## Test Wrapper — `renderWithProviders`

All component tests use the shared wrapper from `src/test-utils`:

```ts
import { renderWithProviders } from '@/test-utils'

test('renders account list', async () => {
  renderWithProviders(<AccountTabs />)
  expect(await screen.findByText('Vietcombank')).toBeInTheDocument()
})
```

## MSW Node Server Setup

For tests that hit the API:

```ts
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'

// Override handler for a specific test
server.use(
  http.get('/api/accounts', () => {
    return HttpResponse.json({ data: [], nextCursor: null, total: 0 })
  })
)
```

Server lifecycle (already configured in test-setup.ts):
```ts
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Hook Testing Pattern

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@/test-utils' // QueryClient wrapper

test('useAccounts returns accounts', async () => {
  const { result } = renderHook(() => useAccounts(), {
    wrapper: createWrapper(),
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toHaveLength(2)
})
```

## Store Testing Pattern (Zustand)

```ts
import { act } from 'react'
import { useBudgetStore } from '@/stores/budgetStore'

// Reset store state between tests
beforeEach(() => {
  useBudgetStore.setState(useBudgetStore.getInitialState())
})

test('setBudget updates category budget', () => {
  act(() => useBudgetStore.getState().setBudget('Ăn uống', 2000000))
  expect(useBudgetStore.getState().budgets['Ăn uống']).toBe(2000000)
})
```

## Utility Testing Pattern

```ts
import { formatVND, parseVND } from '@/utils/currency'

describe('formatVND', () => {
  it('formats positive amount', () => {
    expect(formatVND(1500000)).toBe('đ 1.500.000')
  })
  it('handles zero', () => {
    expect(formatVND(0)).toBe('đ 0')
  })
})
```

## Important: React 19 StrictMode

Effects run **twice** in dev/test. Tests must be idempotent:
- Don't assert on call counts for effects
- Use `waitFor` or `findBy*` queries (async) instead of `getBy*` for data that loads

## Running Tests

```bash
# Run all tests once
npm run test -- --run

# Run specific file
npm run test -- src/hooks/useAccounts.test.ts --run

# Coverage
npm run test:coverage
```

## Sub-Agent Usage for Test Writing

When writing tests for a complex feature:
1. Launch an Explore sub-agent to read: the source file, any existing tests, and related types
2. Return the gathered context to write accurate tests without guessing API shapes
3. Run `npm run test -- --run` to verify tests pass after writing

## Test Quality Checklist

- [ ] Test renders correctly (smoke test)
- [ ] Test loading state
- [ ] Test success state with real fixture data
- [ ] Test error state (use `server.use()` to return 500)
- [ ] Test empty state
- [ ] Test user interactions (clicks, inputs) if applicable
- [ ] No hardcoded magic values — import from fixtures or constants
