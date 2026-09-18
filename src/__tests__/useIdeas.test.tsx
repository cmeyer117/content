import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useIdeas, IdeasProvider } from '@/hooks/useIdeas'

const realtimeHandlers: Array<() => void> = []
const deferredResolvers: Array<(v: { data: unknown[]; error: null }) => void> = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(function (this: unknown, _event: string, _filter: unknown, cb: () => void) {
        realtimeHandlers.push(cb)
        return this
      }),
      subscribe: vi.fn(function (this: unknown) { return this }),
    })),
    removeChannel: vi.fn(),
  },
}))

describe('useIdeas', () => {
  it('initializes with empty array', async () => {
    const { result } = renderHook(() => useIdeas(), {
      wrapper: ({ children }) => <IdeasProvider>{children}</IdeasProvider>,
    })
    expect(result.current.ideas).toEqual([])
  })

  // Regression: a realtime postgres_changes event used to call load() the
  // same way the initial mount does, flipping `loading` true and unmounting
  // whatever was reading it (e.g. a page gating an open edit modal behind
  // `if (loading) return ...`) mid-edit. Background refreshes from realtime
  // must not toggle `loading`.
  it('does not set loading while refetching from a realtime event', async () => {
    realtimeHandlers.length = 0
    const { supabase } = await import('@/lib/supabase')
    const { result } = renderHook(() => useIdeas(), {
      wrapper: ({ children }) => <IdeasProvider>{children}</IdeasProvider>,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Stall the next fetch (both parallel `from()` calls) so we can observe
    // `loading` mid-flight.
    deferredResolvers.length = 0
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => new Promise(resolve => { deferredResolvers.push(resolve) })),
      })),
    } as unknown as ReturnType<typeof supabase.from>)

    act(() => { realtimeHandlers[0]() })
    expect(result.current.loading).toBe(false)

    deferredResolvers.forEach(resolve => resolve({ data: [], error: null }))
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
