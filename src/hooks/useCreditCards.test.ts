import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { server } from '@/mocks/server'
import { useCreditCards } from './useCreditCards'
import { http, HttpResponse } from 'msw'

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCreditCards', () => {
  it('fetches all credit cards successfully', async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data?.data)).toBe(true)
    expect(result.current.data!.data.length).toBeGreaterThan(0)
  })

  it('returns correct CreditCard data structure', async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cards = result.current.data!.data
    expect(cards.length).toBeGreaterThan(0)

    const card = cards[0]
    expect(card).toHaveProperty('id')
    expect(card).toHaveProperty('bankName')
    expect(card).toHaveProperty('cardName')
    expect(card).toHaveProperty('cardNumber')
    expect(card).toHaveProperty('cardType')
    expect(card).toHaveProperty('currency', 'VND')
    expect(card).toHaveProperty('creditLimit')
    expect(card).toHaveProperty('currentBalance')
    expect(card).toHaveProperty('statementDate')
    expect(card).toHaveProperty('paymentDueDate')
  })

  it('returns both Visa and Mastercard cards', async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cards = result.current.data!.data
    const cardTypes = cards.map((c) => c.cardType)
    expect(cardTypes).toContain('visa')
    expect(cardTypes).toContain('mastercard')
  })

  it('returns pagination metadata', async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveProperty('nextCursor')
    expect(result.current.data).toHaveProperty('total')
    expect(result.current.data!.total).toBe(result.current.data!.data.length)
  })

  it('starts in loading state before data arrives', () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })
    // Before the async fetch resolves, isPending should be true
    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('handles empty response gracefully', async () => {
    server.use(
      http.get('/api/credit-cards', () => {
        return HttpResponse.json({ data: [], nextCursor: null, total: 0 })
      })
    )

    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.data).toHaveLength(0)
    expect(result.current.data!.total).toBe(0)
  })

  it('handles API error state', async () => {
    server.use(
      http.get('/api/credit-cards', () => {
        return HttpResponse.error()
      })
    )

    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('credit limit and balance are positive integers', async () => {
    const { result } = renderHook(() => useCreditCards(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cards = result.current.data!.data
    cards.forEach((card) => {
      expect(card.creditLimit).toBeGreaterThan(0)
      expect(Number.isInteger(card.creditLimit)).toBe(true)
      expect(Number.isInteger(card.currentBalance)).toBe(true)
    })
  })
})
