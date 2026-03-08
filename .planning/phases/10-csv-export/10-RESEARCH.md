# Phase 10: CSV Export - Research

**Researched:** 2026-03-09
**Domain:** Client-side CSV generation, file download, filter integration
**Confidence:** HIGH

## Summary

Phase 10 implements CSV export for filtered transactions with UTF-8 BOM encoding to ensure Vietnamese characters display correctly in Excel on Windows. The implementation uses Papa Parse's `unparse()` function to generate CSV strings, then wraps them in a Blob with BOM prefix before triggering a browser download. The export respects all active filters (date range, account/card, type, category) using a dedicated service fetch rather than reading from the infinite-scroll cache.

**Primary recommendation:** Use Papa Parse's `unparse()` function with manual BOM injection (prepending `\ufeff`) and Blob download. Create a dedicated export service that mirrors the current filter query structure, reusing the existing `TransactionFilters` interface. Place export button in FilterBar next to the reset filter button.

## User Constraints

No CONTEXT.md exists for this phase. Research scope is unconstrained — investigating standard implementation patterns, not locking specific decisions.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | Download button exports CSV with UTF-8 BOM header (Vietnamese Excel compatibility) | Papa Parse + Blob API with BOM injection pattern identified |
| EXP-02 | CSV columns: Ngày, Mô tả, Số tiền (VND), Loại, Tài khoản, Danh mục; dedicated service fetch not infinite-scroll cache | Service function signature designed; mirrors getTransactions pattern |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | ^1.8.1 | CSV generation from arrays/objects | Industry standard, zero dependencies, proven in production (RFC 4180 compliant) |
| Blob API | Native | File-like object creation for download | Built into all modern browsers; no install needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (existing) | Format transaction dates for CSV | Already in stack; use formatDisplayDate() for "Ngày" column |
| Zod | ^4.3.6 (existing) | Validate export response shape | Reuse PaginatedResponseSchema for dedicated fetch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse | CSV string concatenation | More error-prone, no quote/newline escaping, maintenance burden |
| papaparse | xlsx library | Overkill for CSV; adds 200KB+ bundle size for single-column formatting |
| Blob + BOM | Content-Disposition header | Header-based approach requires backend; Blob + BOM is pure client-side |

**Installation:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse  # TypeScript support
```

## Architecture Patterns

### Recommended Project Structure

Export functionality spans three layers:

```
src/
├── services/
│   └── exports.ts           # exportTransactions() service function
├── utils/
│   └── csv.ts               # formatTransactionForCSV(), addBOM() helpers
├── components/
│   └── filters/
│       └── ExportButton.tsx  # New export button component
```

### Pattern 1: CSV Export Service
**What:** Dedicated service function that mirrors `getTransactions()` signature, accepts filter params, and returns structured data ready for CSV.
**When to use:** Separating data-fetching logic from UI logic; ensures export always has fresh data respecting current filters.
**Example:**
```typescript
// Source: Mirrors accounts.ts pattern
export async function exportTransactions(
  accountId: string | null,
  filters?: TransactionFilters
) {
  // Query without pagination (no cursor/limit) to get all filtered results
  const response = await apiClient.get(
    accountId ? `/accounts/${accountId}/transactions` : '/transactions',
    {
      params: {
        ...(filters?.search && { search: filters.search }),
        ...(filters?.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters?.dateTo && { dateTo: filters.dateTo }),
        ...(filters?.txType && filters.txType !== 'all' && { txType: filters.txType }),
        ...(filters?.category && filters.category !== 'all' && { category: filters.category }),
      },
    }
  )
  return PaginatedTransactionSchema.parse(response.data)
}
```

### Pattern 2: CSV Data Transformation
**What:** Transform domain Transaction/CreditCardTransaction objects into flat CSV row objects with localized field names.
**When to use:** Creating proper CSV headers in Vietnamese; decoupling domain model from export format.
**Example:**
```typescript
// Source: Project utilities pattern (currency.ts, dates.ts)
interface CSVTransactionRow {
  'Ngày': string                // formatDisplayDate(tx.transactionDate)
  'Mô tả': string              // tx.description
  'Số tiền': string            // formatVND(Math.abs(tx.amount))
  'Loại': string               // tx.type === 'income' ? 'Thu nhập' : 'Chi tiêu'
  'Tài khoản': string          // account?.accountName ?? card?.cardName ?? 'N/A'
  'Danh mục': string           // useCategoryOverrideStore.getEffectiveCategory(tx.id, tx.category)
}

export function formatTransactionForCSV(
  tx: Transaction | CreditCardTransaction,
  accountOrCard: BankAccount | CreditCard | undefined,
  categoryOverrides: Map<string, Category>
): CSVTransactionRow {
  // Implementation details
}
```

### Pattern 3: BOM Injection and Blob Download
**What:** Prepend UTF-8 BOM character to CSV string, wrap in Blob, trigger browser download via temporary anchor element.
**When to use:** Ensuring Excel on Windows recognizes UTF-8 encoding; Vietnamese characters display correctly.
**Example:**
```typescript
// Source: UTF-8 encoding best practices (skoumal.com, Medium articles on BOM)
export function downloadCSV(csvString: string, filename: string): void {
  const BOM = '\ufeff'  // UTF-8 BOM character
  const csvWithBOM = BOM + csvString

  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
```

### Anti-Patterns to Avoid
- **Reading from infinite-scroll cache:** Don't use `useTransactions()` data. It's paginated and incomplete. Fetch fresh data via dedicated service.
- **Hardcoding field order in CSV string:** Use Papa Parse's `columns` config to ensure consistent, maintainable column ordering.
- **Skipping BOM on Windows-only logic:** BOM is harmless on Mac/Linux and essential on Windows Excel. Always include it.
- **Missing category overrides in export:** Use `useCategoryOverrideStore` to get effective categories; exported CSV must match what user sees in UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV string generation | Manual string concatenation or template literals | Papa Parse `unparse()` | Handles quote escaping, newlines, delimiters correctly per RFC 4180 |
| BOM encoding | Custom encoding functions | Prepend `\ufeff` character to string | Simple, proven, no dependencies; Blob API handles the rest |
| File download | Data URI or localStorage hacks | Blob + anchor element + URL.createObjectURL | Reliable, works for large files, correct Content-Disposition semantics |
| Field ordering | Map iteration or manual field extraction | Papa Parse `columns` config option | Explicit, maintainable, resilient to field addition |

**Key insight:** CSV formatting has many subtle edge cases (quote escaping, newline handling, delimiter in values). Papa Parse solves this with zero dependencies. The BOM pattern is a 2-character fix (prepend + download) that handles the entire Vietnamese Excel compatibility problem.

## Common Pitfalls

### Pitfall 1: Forgetting BOM on UTF-8 CSV
**What goes wrong:** CSV exports to Excel on Windows with Vietnamese characters appear as mojibake (garbage characters like "???" or "ï»¿").
**Why it happens:** Windows Excel defaults to legacy encoding (Windows-1252) and ignores UTF-8 unless BOM (0xEF 0xBB 0xBF or `\ufeff`) is present at file start.
**How to avoid:** Always prepend `\ufeff` to CSV string before Blob creation. Verify in tests by checking exported string starts with `\ufeff`.
**Warning signs:** User reports "Vietnamese characters broken in Excel but fine in Google Sheets" — immediate indicator of missing BOM.

### Pitfall 2: Using Infinite-Scroll Cache Data for Export
**What goes wrong:** Export only contains first page (20 transactions); user expects all filtered results.
**Why it happens:** `useTransactions()` uses `useInfiniteQuery` and returns paginated data. Temptation is to reuse this hook.
**How to avoid:** Create separate `exportTransactions()` service that fetches without pagination. Planner task must wire this service, not the query hook.
**Warning signs:** Tests pass (first page is there) but user reports missing older transactions in export.

### Pitfall 3: Category Override Mismatch
**What goes wrong:** CSV shows auto-classified category; UI showed user's manual override.
**Why it happens:** Export service only returns API category; doesn't check localStorage overrides.
**How to avoid:** In export handler, call `useCategoryOverrideStore().getEffectiveCategory(txId, apiCategory)` for each transaction.
**Warning signs:** User manually overrode category in UI, exports CSV, category is different — loses trust in export feature.

### Pitfall 4: Filter Params Lost Between View and Export Click
**What goes wrong:** User filters to "Jan 2026, Expenses only", clicks export, but CSV contains all transactions.
**Why it happens:** Export button handler not capturing current `filterStore` state; calling service without filter params.
**How to avoid:** Export handler uses `useFilterParams()` selector; passes all filter state to service function explicitly.
**Warning signs:** QA reports "export button on filtered view exports unfiltered data".

## Code Examples

Verified patterns from official sources:

### Papa Parse Unparse with Headers
```typescript
// Source: papaparse.com/docs — unparse function syntax
import Papa from 'papaparse'

interface CSVRow {
  [key: string]: string | number
}

const data: CSVRow[] = [
  { 'Ngày': '09/03/2026', 'Mô tả': 'Lunch', 'Số tiền': 'đ 150.000' },
  { 'Ngày': '08/03/2026', 'Mô tả': 'Gas', 'Số tiền': 'đ 50.000' },
]

const csv = Papa.unparse(data, {
  header: true,           // Include header row
  delimiter: ',',         // Standard CSV
  newline: '\r\n',        // Windows/Unix compatible
})

console.log(csv)
// Output: Ngày,Mô tả,Số tiền\r\nCafé 09/03/2026,Lunch,đ 150.000\r\n...
```

### Download CSV with BOM
```typescript
// Source: UTF-8 BOM best practices (skoumal.com, GitHub issues)
export function downloadCSV(csvString: string, filename: string): void {
  const BOM = '\ufeff'  // UTF-8 BOM for Excel compatibility
  const csvWithBOM = BOM + csvString

  const blob = new Blob([csvWithBOM], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
```

### Export Button Integration
```typescript
// Source: Project FilterBar pattern (src/components/filters/FilterBar.tsx)
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFilterParams } from '@/stores/filterStore'
import { exportTransactions } from '@/services/exports'
import { useFilterStore } from '@/stores/filterStore'

export function ExportButton() {
  const filters = useFilterParams()
  const accountId = useFilterStore((s) => s.accountId)
  const cardId = useFilterStore((s) => s.cardId)
  const [isExporting, setIsExporting] = React.useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Fetch fresh data with current filters
      const data = await exportTransactions(
        accountId ?? cardId,  // Support both account and card exports
        filters
      )

      // Transform and generate CSV
      const csvRows = data.data.map((tx) => formatTransactionForCSV(tx, ...))
      const csv = Papa.unparse(csvRows)

      // Download with BOM
      downloadCSV(csv, `transactions-${new Date().toISOString().split('T')[0]}.csv`)

      // Optional: toast notification
      toast.success('Đã tải xuống CSV')
    } catch (error) {
      toast.error('Tải xuống thất bại')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="touch-target"
    >
      <Download className="h-4 w-4 mr-1.5" />
      {isExporting ? 'Đang tải...' : 'Xuất CSV'}
    </Button>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side CSV generation | Client-side Blob + download | ~2015 | Privacy (no data sent to server), instant feedback, reduced backend load |
| Data URI approach | Blob API | ~2016 | Supports larger files (no URL length limits), more reliable across browsers |
| ISO-8859-1 encoding | UTF-8 with BOM | Always for international text | Vietnamese and other multi-byte scripts require UTF-8; BOM signals encoding to Excel |
| Manual field extraction | Papa Parse unparse() | ~2012 onward | Correct handling of edge cases (quotes, newlines, delimiters in field values) |

**Deprecated/outdated:**
- CSV string building with `"` + field + `"` + ... — error-prone, misses quotes within fields
- atob/btoa base64 encoding for download — unnecessary with Blob API
- Excel XML format (XLSX via libraries) — overkill for simple CSV, large bundle size

## Open Questions

1. **Scope of concurrent export filtering**
   - What we know: Export respects current filterStore state (accountId, cardId, dateFrom, dateTo, txType, category, searchQuery)
   - What's unclear: Should export work when both accountId AND cardId are set? Or mutually exclusive?
   - Recommendation: Treat as OR logic — if cardId is set, export credit card txs; else if accountId, export bank txs. Implement in service layer with conditional route.

2. **Column order and header localization**
   - What we know: Phase requirement specifies Vietnamese header names: "Ngày, Mô tả, Số tiền, Loại, Tài khoản, Danh mục"
   - What's unclear: Should future localization be built in, or is Vietnamese hardcoded acceptable for v1.1?
   - Recommendation: Hardcode Vietnamese headers for v1.1 (no i18n infra in project). Add comment for future i18n refactor.

3. **Error handling for export service**
   - What we know: Service mirrors `getTransactions()` which uses Zod validation
   - What's unclear: Should validation errors be caught and shown to user, or fail silently/retry?
   - Recommendation: Wrap in try-catch, show toast with error message. Don't retry automatically (user can click export again).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library |
| Config file | vite.config.ts (test section) |
| Quick run command | `npm test -- src/utils/csv.test.ts --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-01 | CSV string starts with UTF-8 BOM character | unit | `npm test -- src/utils/csv.test.ts --run` | ❌ Wave 0 |
| EXP-01 | Downloaded Blob has charset=utf-8 in type | unit | `npm test -- src/utils/csv.test.ts --run` | ❌ Wave 0 |
| EXP-02 | CSV headers match Vietnamese column names | unit | `npm test -- src/utils/csv.test.ts --run` | ❌ Wave 0 |
| EXP-02 | Export respects all filter params (date, account, type, category) | integration | `npm test -- src/services/exports.test.ts --run` | ❌ Wave 0 |
| EXP-02 | Export fetches full result set (no pagination) | integration | `npm test -- src/services/exports.test.ts --run` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/utils/csv.test.ts src/services/exports.test.ts --run` (CSV utils + service)
- **Per wave merge:** `npm test -- --run` (full suite, 231+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/csv.test.ts` — unit tests for formatTransactionForCSV(), downloadCSV(), BOM injection
- [ ] `src/services/exports.test.ts` — integration tests for exportTransactions() with all filter combinations
- [ ] `src/components/filters/ExportButton.test.tsx` — component test for button disabled state, export handler, error toast

*(Wave 0 must establish test foundation before implementation tasks can verify behavior)*

## Sources

### Primary (HIGH confidence)
- **Papa Parse Documentation** ([papaparse.com/docs](https://www.papaparse.com/docs)) — `unparse()` function syntax, configuration options, column ordering
- **Papa Parse FAQ** ([papaparse.com/faq](https://www.papaparse.com/faq)) — performance characteristics, RFC 4180 compliance
- **UTF-8 BOM Best Practices** ([skoumal.com](https://www.skoumal.com/en/making-utf-8-csv-excel/)) — BOM prefix pattern, Excel compatibility reasoning
- **Project codebase** — existing formatVND(), formatDisplayDate(), filter patterns in filterStore, services/accounts.ts structure

### Secondary (MEDIUM confidence)
- **Medium: UTF-8 BOM for East Asian Languages** ([Medium article by Hyunbin](https://hyunbinseo.medium.com/save-csv-file-in-utf-8-with-bom-29abf608e86e)) — verified BOM injection pattern with verified with official sources
- **xjavascript.com** ([UTF8 CSV Encoding Issues](https://www.xjavascript.com/blog/encoding-issues-for-utf8-csv-file-when-opening-excel-and-textedit/)) — Windows Excel behavior, BOM necessity explained

### Tertiary (LOW confidence — sources marked for validation)
- **npm registry: papaparse** ([npmjs.com/package/papaparse](https://www.npmjs.com/package/papaparse)) — version info, download stats (not used for technical guidance)

## Metadata

**Confidence breakdown:**
- Standard stack (Papa Parse): **HIGH** — Verified via official docs, npm registry, production usage in ecosystem
- Architecture patterns (service layer, CSV transformation): **HIGH** — Mirrors existing project patterns (services/accounts.ts, utils/currency.ts)
- BOM + Blob download: **HIGH** — Official sources + verified across multiple UTF-8 guides, no contradictions
- Pitfalls: **MEDIUM** — Based on community reports + localized character issues, not exhaustive but high-probability issues
- Column order and localization: **MEDIUM** — Requirements specify Vietnamese headers, but future-proofing approach is inference

**Research date:** 2026-03-09
**Valid until:** 2026-03-30 (21 days) — Papa Parse is stable; CSV spec (RFC 4180) is unchanged; BOM is stable browser standard. Safe interval for v1.1 development.

**Next action:** Planner creates PLAN.md with two plans:
1. **10-01:** CSV utilities (formatTransactionForCSV, downloadCSV helpers) + service function + tests
2. **10-02:** ExportButton component integration + FilterBar wiring + E2E testing
