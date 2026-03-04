import { http, HttpResponse } from 'msw'
import { mockAccounts } from './fixtures/accounts'
import { mockTransactions } from './fixtures/transactions'
import { mockCreditCards, mockCreditCardTransactions } from './fixtures/creditCards'

export const handlers = [
  // GET /api/accounts — returns all bank accounts
  http.get('/api/accounts', () => {
    return HttpResponse.json({
      data: mockAccounts,
      nextCursor: null,
      total: mockAccounts.length,
    })
  }),

  // GET /api/accounts/:accountId/transactions — cursor-based pagination with filter support
  // CRITICAL: query params go in request.url, NOT in the path pattern
  http.get('/api/accounts/:accountId/transactions', ({ params, request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const search = url.searchParams.get('search') ?? ''
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const txType = url.searchParams.get('txType') ?? 'all'
    const accountId = params.accountId as string

    let allTx = mockTransactions.filter((tx) => tx.accountId === accountId)

    // Apply text search filter — match description or merchantName
    if (search) {
      const q = search.toLowerCase()
      allTx = allTx.filter(
        (tx) =>
          tx.description.toLowerCase().includes(q) ||
          (tx.merchantName?.toLowerCase().includes(q) ?? false)
      )
    }

    // Apply date range filter — append T23:59:59Z to dateTo to include transactions on the dateTo day
    if (dateFrom) allTx = allTx.filter((tx) => tx.transactionDate >= dateFrom)
    if (dateTo) allTx = allTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')

    // Apply transaction type filter
    if (txType !== 'all') allTx = allTx.filter((tx) => tx.type === txType)

    const startIndex = cursor
      ? allTx.findIndex((tx) => tx.id === cursor) + 1
      : 0
    const page = allTx.slice(startIndex, startIndex + limit)
    const nextCursor =
      startIndex + limit < allTx.length
        ? (page[page.length - 1]?.id ?? null)
        : null

    return HttpResponse.json({
      data: page,
      nextCursor,
      total: allTx.length,
    })
  }),

  // GET /api/credit-cards — returns all credit cards
  http.get('/api/credit-cards', () => {
    return HttpResponse.json({
      data: mockCreditCards,
      nextCursor: null,
      total: mockCreditCards.length,
    })
  }),

  // GET /api/credit-cards/:cardId/transactions — cursor-based pagination with filter support
  http.get('/api/credit-cards/:cardId/transactions', ({ params, request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const search = url.searchParams.get('search') ?? ''
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const txType = url.searchParams.get('txType') ?? 'all'
    const cardId = params.cardId as string

    let allTx = mockCreditCardTransactions.filter((tx) => tx.cardId === cardId)

    // Apply text search filter — match merchantName
    if (search) {
      const q = search.toLowerCase()
      allTx = allTx.filter(
        (tx) => tx.merchantName.toLowerCase().includes(q)
      )
    }

    // Apply date range filter
    if (dateFrom) allTx = allTx.filter((tx) => tx.transactionDate >= dateFrom)
    if (dateTo) allTx = allTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')

    // Credit card transactions are always expenses; txType 'expense' shows all, 'income' shows none
    if (txType === 'income') allTx = []

    const startIndex = cursor
      ? allTx.findIndex((tx) => tx.id === cursor) + 1
      : 0
    const page = allTx.slice(startIndex, startIndex + limit)
    const nextCursor =
      startIndex + limit < allTx.length
        ? (page[page.length - 1]?.id ?? null)
        : null

    return HttpResponse.json({
      data: page,
      nextCursor,
      total: allTx.length,
    })
  }),

  // GET /api/dashboard/stats — aggregates bank + CC transactions, supports dateFrom/dateTo filters
  http.get('/api/dashboard/stats', ({ request }) => {
    const url = new URL(request.url)
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    // Filter bank transactions by date range
    let bankTx = mockTransactions
    if (dateFrom) bankTx = bankTx.filter((tx) => tx.transactionDate >= dateFrom)
    if (dateTo) bankTx = bankTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')

    // Filter CC transactions by date range (include ALL statuses — pending included per CONTEXT.md decision)
    let ccTx = mockCreditCardTransactions
    if (dateFrom) ccTx = ccTx.filter((tx) => tx.transactionDate >= dateFrom)
    if (dateTo) ccTx = ccTx.filter((tx) => tx.transactionDate <= dateTo + 'T23:59:59Z')

    // Bank aggregates — positive amount = income, negative = expense
    const bankIncome = bankTx
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const bankExpense = bankTx
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    // CC aggregates — all CC transactions are expenses (purchases/fees negative, payments/refunds positive)
    // Use abs(amount) for all CC transactions
    const ccExpense = ccTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    // CC has no "income" in the traditional sense; payments reduce outstanding balance not income
    const ccIncome = 0

    const totalIncome = bankIncome + ccIncome
    const totalExpense = bankExpense + ccExpense

    // Category breakdown — combine bank categories and CC categories
    const categoryMap = new Map<string, number>()
    const allExpenses = [
      ...bankTx.filter((tx) => tx.type === 'expense').map((tx) => ({ category: tx.category ?? 'other', amount: Math.abs(tx.amount) })),
      ...ccTx.map((tx) => ({ category: tx.category ?? 'other', amount: Math.abs(tx.amount) })),
    ]
    for (const { category, amount } of allExpenses) {
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount)
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    return HttpResponse.json({
      totalIncome,
      totalExpense,
      bankIncome,
      bankExpense,
      ccIncome,
      ccExpense,
      categoryBreakdown,
      transactionCount: bankTx.length + ccTx.length,
    })
  }),
]
