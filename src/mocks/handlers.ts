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

  // GET /api/accounts/:accountId/transactions — cursor-based pagination
  // CRITICAL: query params go in request.url, NOT in the path pattern
  http.get('/api/accounts/:accountId/transactions', ({ params, request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const accountId = params.accountId as string

    const allTx = mockTransactions.filter((tx) => tx.accountId === accountId)
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

  // GET /api/credit-cards/:cardId/transactions — cursor-based pagination
  http.get('/api/credit-cards/:cardId/transactions', ({ params, request }) => {
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const cardId = params.cardId as string

    const allTx = mockCreditCardTransactions.filter((tx) => tx.cardId === cardId)
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
