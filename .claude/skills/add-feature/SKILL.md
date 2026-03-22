---
name: add-feature
description: >
  Full workflow for adding a new feature to the FinanceManager project.
  Use this skill when the user asks to add a new feature, new page, new data entity,
  or new UI section. Follows the project's 8-step checklist: Type → Service → Mock → Hook → Store → Component → Tests → QueryKey.
  Automatically uses sub-agents to parallelize independent work like reading existing files.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, TodoWrite
---

# Add Feature Skill — FinanceManager

## Overview

You are adding a new feature to the FinanceManager project (React 19 + TypeScript + Vite).
Follow every step below in order. Use sub-agents to read multiple files in parallel when gathering context.

## Before You Start

**Parallelize context gathering using sub-agents.** Launch these reads concurrently:
- Read `src/types/` to understand existing type patterns
- Read `src/services/` to understand service patterns
- Read `src/hooks/` to understand hook patterns
- Read `src/mocks/handlers.ts` to understand mock handler patterns

## 8-Step Feature Checklist

### Step 1 — Type Definition (`src/types/`)
- Create Zod schema first, then infer TypeScript type: `type Foo = z.infer<typeof FooSchema>`
- Never hand-write duplicate types — always use `z.infer<>`
- Add to existing type file or create new one following naming convention

```ts
// Example pattern
import { z } from 'zod'

export const FooSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
})

export type Foo = z.infer<typeof FooSchema>
```

### Step 2 — Service Function (`src/services/`)
- Use `apiClient` (Axios, base `/api`, timeout 10s)
- Always parse response with Zod schema
- Export named async function

```ts
import { apiClient } from '@/services/apiClient'
import { FooSchema } from '@/types/foo'

export async function getFoos() {
  const res = await apiClient.get('/foos')
  return z.array(FooSchema).parse(res.data)
}
```

### Step 3 — MSW Mock Handler (`src/mocks/handlers.ts`)
- Add handler to the existing handlers array
- Use fixture data from `src/mocks/fixtures/`
- Apply cursor-based pagination if returning a list

See reference: `references/mock-patterns.md`

### Step 4 — TanStack Query Hook (`src/hooks/`)
- Use `useQuery` for single fetch, `useInfiniteQuery` for paginated lists
- Include ALL filter params in `queryKey`
- Read filters from `filterStore` or `dashboardStore` via `useShallow`

```ts
export function useFoos() {
  return useQuery({
    queryKey: ['foos', ...filterParams],
    queryFn: () => getFoos(),
    staleTime: 5 * 60 * 1000,
  })
}
```

### Step 5 — Zustand Store (`src/stores/`) — Only if UI state needed
- Use double-curry pattern: `create<State>()()`
- Use `useShallow` for multi-field selectors
- Add `persist` middleware if data should survive page refresh

```ts
const useStore = create<State>()(
  persist((set) => ({ ... }), { name: 'finance-key' })
)
```

### Step 6 — Component (`src/features/<domain>/`)
- Place in appropriate feature folder: `accounts/`, `transactions/`, `creditCards/`, `dashboard/`, `chatbot/`
- Use existing shadcn components from `src/components/ui/`
- Apply custom utility classes: `.card-padding`, `.section-spacing`, `.body-base`, etc.
- Use `formatVND()` for currency, `formatDisplayDate()` for dates
- Use `CategoryBadge` for category display

### Step 7 — Tests (colocated `.test.tsx`)
- Place test file next to the component/hook/service file
- Use `renderWithProviders` for components
- Use MSW `server` from `src/mocks/server.ts` for API mocking
- See `write-tests` skill for detailed test patterns

### Step 8 — Verify QueryKey Completeness
- Double-check all active filters are in queryKey
- Confirm Zod parse is at service boundary, not in the component

## Sub-Agent Strategy

When implementing this feature, use sub-agents for:
1. **Exploration phase**: Launch parallel agents to read existing similar features
2. **Validation phase**: Use an Explore agent to verify no imports are broken

Example:
```
Launch sub-agents in parallel:
- Agent 1: Read src/features/accounts/ to understand account feature pattern
- Agent 2: Read src/features/transactions/ to understand transaction patterns
- Agent 3: Read src/mocks/fixtures/ to understand fixture structure
```

## Critical Rules

- Never call `ReactDOM.createRoot` outside of `enableMocking().then()` in `main.tsx`
- Always use `@/` path alias for imports within `src/`
- No `any` types — use `unknown` and narrow, or `z.infer<>`
- Recharts must stay lazy-loaded: `React.lazy(() => import(...))`
- Dark mode via `.dark` class on `<html>`, use CSS vars `--color-*` not hardcoded colors
