---
name: review-code
description: >
  Review code in the FinanceManager project for correctness, quality, and adherence to project standards.
  Use this skill when the user asks to review code, check for bugs, audit a feature, validate patterns,
  or get feedback before committing. This is a READ-ONLY skill — it reads and analyzes without modifying files.
  Checks TypeScript strictness, Zustand patterns, Zod boundaries, import paths, and MSW setup.
allowed-tools: Read, Grep, Glob, Bash
---

# Review Code Skill — FinanceManager

## Overview

You are performing a code review on the FinanceManager project. This skill is READ-ONLY.
Do not edit files — report findings only. Use sub-agents (Explore type) to read multiple files in parallel.

## Review Checklist

Run through each section systematically. Report issues by file and line number.

---

### 1. TypeScript Strictness

Check for violations of full strict mode (`noUnusedLocals`, `noUnusedParameters`, no fallthrough):

```bash
# Run TypeScript check
npx tsc --noEmit
```

Manual checks:
- No `any` types — should use `unknown` + narrowing, or `z.infer<typeof Schema>`
- No unused variables (unless prefixed with `_`)
- All props/params typed explicitly — no implicit `any`

---

### 2. Zod at Service Boundary

Every service function must parse its API response with Zod:

**Good:**
```ts
// src/services/accounts.ts
export async function getAccounts() {
  const res = await apiClient.get('/accounts')
  return AccountsResponseSchema.parse(res.data)  // ✅ parse here
}
```

**Bad:**
```ts
// Component or hook calling apiClient directly — ❌
const res = await apiClient.get('/accounts')
return res.data as BankAccount[]  // ❌ no Zod parse
```

Search for violations:
```bash
grep -r "apiClient\." src/hooks/ src/components/ src/features/ src/pages/
grep -r "as BankAccount\|as Transaction\|as CreditCard" src/
```

---

### 3. Zustand Patterns

Check for missing `useShallow` in multi-field selectors:

**Bad (causes infinite re-renders):**
```ts
const { a, b } = useStore(s => ({ a: s.a, b: s.b }))  // ❌ no useShallow
```

**Good:**
```ts
const { a, b } = useStore(useShallow(s => ({ a: s.a, b: s.b })))  // ✅
```

Search:
```bash
grep -n "useStore\|useFilterStore\|useBudgetStore\|useDashboardStore\|useChatStore" src/
```

Also verify double-curry in store definitions:
```ts
create<State>()(...)   // ✅ double-curry
create<State>(...)     // ❌ missing outer ()
```

---

### 4. QueryKey Completeness

Every `useQuery`/`useInfiniteQuery` that uses filters must include ALL filter params in `queryKey`:

**Good:**
```ts
queryKey: ['transactions', accountId, { dateFrom, dateTo, searchQuery, txType, category }]
```

**Bad:**
```ts
queryKey: ['transactions', accountId]   // ❌ missing filter params
```

---

### 5. Import Path Aliases

All imports within `src/` must use `@/` alias, not relative `../../` paths:

```bash
grep -rn "from '\.\./\.\." src/
```

Expected: zero results (all cross-directory imports should use `@/`).

---

### 6. Lazy Loading — Recharts

The Recharts chunk (~372KB) must stay lazy-loaded:

```bash
grep -rn "from 'recharts'" src/
```

Only `src/features/dashboard/CategoryChart.tsx` should import from recharts directly.
All other files must use `React.lazy(() => import(...))`.

---

### 7. MSW Deferred Render Guard

`src/main.tsx` must wrap `ReactDOM.createRoot` inside `enableMocking().then()`:

```bash
grep -n "createRoot\|enableMocking" src/main.tsx
```

`createRoot` must NOT appear before `enableMocking().then(`.

---

### 8. CSS / Styling

- No hardcoded colors — must use `--color-*` CSS variables
- Dark mode via `.dark` class on `<html>`, not media queries
- Currency must use `formatVND()` / `formatVNDSigned()` — no manual formatting

```bash
grep -rn "color: #\|color: rgb\|background: #" src/
```

---

### 9. Test Coverage Check

```bash
npm run test:coverage -- --run 2>&1 | tail -30
```

Check that new files have corresponding `.test.ts(x)` files colocated.

---

## Review Report Format

When reporting findings, use this format:

```
## Code Review Report

### Critical Issues (must fix)
- src/hooks/useNewHook.ts:15 — Missing `useShallow` for multi-field Zustand selector
- src/services/newService.ts:8 — No Zod parse on API response

### Warnings (should fix)
- src/features/new/Component.tsx:42 — Hardcoded color '#ff0000', use --color-* variable

### Minor (optional)
- src/features/new/Component.tsx:10 — Import could use @/ alias

### Passed Checks ✅
- TypeScript: no errors
- All @/ aliases used correctly
- Recharts still lazy-loaded
```
