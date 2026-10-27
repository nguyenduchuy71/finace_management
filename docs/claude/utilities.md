<!-- Tách từ CLAUDE.md (import bằng @). Hàm tiện ích trong src/utils. -->

## Utility Functions (`src/utils/`)

### Currency (`currency.ts`)
```typescript
formatVND(amount)         → "đ 1.500.000"
formatVNDSigned(amount)   → "- đ 500.000"
// Ô nhập số tiền: KHÔNG tự parse — dùng moneyAmountField (src/types/form-fields.ts)
```

### Dates (`dates.ts`)
```typescript
toVietnamDate(isoUtcString)             → TZDate (UTC+7)
formatDisplayDate(isoString)            → "15/01/2026"
formatDisplayDateTime(isoString)        → "15/01/2026 14:30"
calculateMonthDelta(current, previous)  → number | null (% change)
getPreviousMonthDateRange(from, to)     → { prevFrom, prevTo }
```

### Categories (`categories.ts`)
```typescript
classifyTransaction(merchantName?)  → Category   // Auto-classify by merchant keywords
getCategoryLabel(category)          → string
CATEGORY_TAXONOMY                   // Record<Category, string[]> keyword map
```

### CSV (`csv.ts`)
```typescript
formatTransactionForCSV(tx, accountOrCard?, overrides?)  → CSVTransactionRow   // có cột 'Dòng tiền' (Nội bộ/Cashback)
downloadCSV(csvString, filename)                         // UTF-8 BOM download
```

### Billing Cycle (`billingCycle.ts`)
```typescript
computeCurrentCycle(statementDay, nowISO)         → BillingCycle   // ngày sao kê 29-31 được KẸP vào độ dài tháng
groupTransactionsByCycle(txs, currentCycle, statementDay) → BillingCycleGroupData[]   // mỗi giao dịch vào chu kỳ CHỨA ngày giao dịch (không dồn vào kỳ hiện tại)
formatCycleDateRange(startISO, endISO)            → { startDisplay, endDisplay }
cycleProgressPercent(startISO, endISO, nowISO)    → number      // cycle-progress.ts
cycleUrgency(daysUntilClose)                      → 'calm' | 'soon' | 'urgent'   // ≤3 ngày = urgent, ≤7 = soon
```
Chu kỳ là khoảng **nửa mở `[startISO, endISO)`**; truy vấn dùng `dateFrom` + `dateBefore` (cận trên loại trừ).

### Dashboard & danh sách (`cashflow.ts`, `group-by-day.ts`)
```typescript
computeNetFlow(totalIncome, totalExpense) → { net, spendRatio | null }   // nhận số DƯƠNG từ RPC; spendRatio null khi không có thu
groupByDay(items)                         → DayGroup[] { dayKey, income, expense, items }   // theo ngày VN, tổng chỉ của dòng ĐÃ TẢI, không gồm internal_transfer (khớp dashboard)
formatDayLabel(dayKey, nowISO)            → "Hôm nay" | "Hôm qua" | "Thứ hai, 05/10/2026"
getCategoryChartColor(category)           → 'var(--chart-n)'   // danh mục lạ → màu "Khác"
```

### MCC (`mcc.ts`, `mcc-search.ts`)
```typescript
MCC_OPTIONS                       // ~1000 mã ISO 18245 {code, label, keywords} từ mcc-codes.ts (FILE SINH: sửa scripts/generate-mcc-codes.py)
COMMON_MCC_OPTIONS                // mã có từ khoá gợi ý (mcc-keywords.ts) — hiện sẵn khi ô tìm trống
suggestMcc(merchantName)          → mã | null   // chỉ GỢI Ý, không bao giờ tự lưu; ranh giới từ, từ khoá dài nhất thắng, hoà → mã nhỏ hơn
getMccLabel(code) / formatMcc(code)   // "5411 · Siêu thị"
searchMcc(query, limit = 50)      → MccOption[]   // mã > đầu mã > chữ (mã nhóm chung trước mã hãng 3000–3999)
getMccGroup(code)                 → "Bán lẻ, ô tô, xăng dầu"
```
Chọn MCC luôn qua `MccPicker` (không `<select>` nghìn option). Mã 4 chữ số ngoài danh sách vẫn hợp lệ (giao dịch lẫn rule).

### Cashback (`cashback.ts`)
```typescript
computeCashback(rules, txs, cardCap = null) → { total, uncappedTotal, cardCap, cardCapped, byRule, unmatchedSpend }
```
Chỉ tính giao dịch chi; mỗi giao dịch vào 1 rule (MCC trùng → rule mặc định → unmatched); ngưỡng, bậc thang và trần áp **riêng từng rule**:
lấy **bậc cao nhất có `minSpend ≤ chi`** (bậc nền + `tiers`, tự sắp xếp) và áp % của bậc đó cho **cả khoản chi** (không lũy tiến → có
"vách đá": 9.999.999đ ≠ 10.000.000đ). Trần rule cắt trước, **trần cả thẻ cắt sau** khi cộng các rule. Làm tròn xuống trên tổng rule bằng **điểm cơ bản nguyên** (số thực sai 1đ: 0,57% × 1.000.000 → 5.699). Luôn hiển thị là "ước tính".
