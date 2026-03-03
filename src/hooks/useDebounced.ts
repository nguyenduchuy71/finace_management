import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the value — only updates after delayMs of no changes.
 * Use for search inputs: local state updates immediately, debounced value triggers store update.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
