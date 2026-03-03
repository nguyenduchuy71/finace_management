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
]
