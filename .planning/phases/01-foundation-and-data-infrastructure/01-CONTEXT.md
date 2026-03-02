# Phase 1: Foundation and Data Infrastructure - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Cài đặt toàn bộ nền tảng kỹ thuật: Vite + React 19 + TypeScript strict mode + Tailwind + shadcn/ui, MSW mock API với data Vietnamese banking, API service layer với Zod validation, TanStack Query v5 + Zustand. Chưa build UI thật — chỉ data layer và wiring. Sau phase này, mọi developer có thể build feature mà không cần real API.

</domain>

<decisions>
## Implementation Decisions

### Mock Data Richness
- 2 tài khoản ngân hàng (ví dụ: Vietcombank checking + Techcombank saving)
- 2 thẻ tín dụng (ví dụ: Techcombank Visa + VPBank Mastercard)
- 30–50 giao dịch per tài khoản, trải dài 3 tháng gần nhất
- Merchant names thực tế: Circle K, Grab, Shopee, Bách Hoá Xanh, Điện Máy Xanh, etc.
- Bao gồm cả income và expense, mix pending/posted cho thẻ tín dụng
- Billing cycle data: ngày sao kê ngày 15, ngày đến hạn ngày 5 tháng sau

### API Response Contract
- Amount: **integer** (VND không có decimal — ISO 4217)
- Field naming: **camelCase** (chuẩn cho TypeScript frontend)
- Timestamps: **ISO 8601 UTC** (`"2026-01-15T00:00:00Z"`), convert sang UTC+7 khi hiển thị
- Pagination: **cursor-based** (`nextCursor: string | null`, `limit: number`)
- Response envelope: `{ data: T[], nextCursor: string | null, total: number }`
- Error shape: `{ code: string, message: string, details?: unknown }`

### Project Structure
- **Feature-based** organization dưới `src/features/`
  - `src/features/accounts/` — bank accounts
  - `src/features/transactions/` — transaction lists + filters
  - `src/features/creditCards/` — CC + billing cycle
  - `src/features/dashboard/` — overview + charts
- Shared primitives ở `src/components/ui/` (shadcn components)
- Shared hooks ở `src/hooks/`
- API service layer ở `src/services/`
- Zod schemas + TypeScript types ở `src/types/`
- MSW handlers ở `src/mocks/`
- Zustand stores ở `src/stores/`

### Error Handling Strategy
- **Inline error states** trong từng data component (không phải global)
- Error component dạng: icon + message + retry button
- Toast (shadcn Sonner) chỉ cho transient errors (network timeout, etc.)
- TanStack Query retry: 2 lần tự động trước khi hiển thị error state
- Loading: skeleton placeholder (không phải spinner toàn trang)

### Claude's Discretion
- Exact Zod schema fields (sẽ derive từ mock data shape)
- MSW handler implementation details
- Tailwind config tweaks
- shadcn component selection cho base UI primitives

</decisions>

<specifics>
## Specific Ideas

- Số tiền VND format: `đ 1.500.000` (Intl.NumberFormat với locale `vi-VN`, currency `VND`)
- Timezone display: Tất cả ngày giờ hiển thị theo UTC+7 dùng `date-fns-tz`
- TypeScript: strict mode bật (`"strict": true` trong tsconfig)
- MSW chạy trong `src/mocks/browser.ts`, enabled khi `import.meta.env.DEV === true`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Không có codebase hiện tại — greenfield project

### Established Patterns
- Tất cả patterns sẽ được establish trong phase này

### Integration Points
- `main.tsx`: Khởi động MSW worker trước khi render App
- `App.tsx`: Wrap với `QueryClientProvider` (TanStack Query) + `Toaster` (shadcn Sonner)
- Feature components sẽ import từ `src/services/` và `src/stores/` (established trong phase này)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-data-infrastructure*
*Context gathered: 2026-03-02*
