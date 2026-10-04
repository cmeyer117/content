import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useIdeas, IdeasProvider } from '@/hooks/useIdeas'
import { supabase } from '@/lib/supabase'

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

  it('exposes read failures and clears them after a successful retry', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: () => ({ order: async () => ({ data: null, error: { message: 'database unavailable' } }) }) } as never)
      .mockReturnValueOnce({ select: async () => ({ data: null, error: null }) } as never)
    const { result } = renderHook(() => useIdeas(), {
      wrapper: ({ children }) => <IdeasProvider>{children}</IdeasProvider>,
    })
    await waitFor(() => expect(result.current.error).toBe('database unavailable'))
    await act(async () => { await result.current.refresh() })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
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

  // Codex review (2026-10-04): loads can overlap (initial load vs a Retry click vs a realtime refetch). Only the most
  // recently STARTED load may touch state, so an older response arriving late can neither show a stale error nor
  // overwrite newer data.
  describe('overlapping loads', () => {
    const pending: Array<(v: unknown) => void> = []
    const wrapper = ({ children }: { children: React.ReactNode }) => <IdeasProvider>{children}</IdeasProvider>
    const controlIdeas = () => {
      pending.length = 0
      vi.mocked(supabase.from).mockImplementation(((table: string) => table === 'content_ideas'
        ? { select: () => ({ order: () => new Promise(resolve => { pending.push(resolve) }) }) }
        : { select: async () => ({ data: [], error: null }) }) as never)
    }

    it('a stale failure arriving after a newer success does not show an error', async () => {
      controlIdeas()
      const { result } = renderHook(() => useIdeas(), { wrapper })
      await waitFor(() => expect(pending.length).toBe(1))
      act(() => { void result.current.refresh() })
      await waitFor(() => expect(pending.length).toBe(2))
      await act(async () => { pending[1]!({ data: [{ id: 'new' }], error: null }) })
      await waitFor(() => expect(result.current.ideas.map(i => i.id)).toEqual(['new']))
      await act(async () => { pending[0]!({ data: null, error: { message: 'old failure' } }) })
      expect(result.current.error).toBeNull()
      expect(result.current.ideas.map(i => i.id)).toEqual(['new'])
    })

    it('a stale success arriving after a newer success does not overwrite the newer data', async () => {
      controlIdeas()
      const { result } = renderHook(() => useIdeas(), { wrapper })
      await waitFor(() => expect(pending.length).toBe(1))
      act(() => { void result.current.refresh() })
      await waitFor(() => expect(pending.length).toBe(2))
      await act(async () => { pending[1]!({ data: [{ id: 'new' }], error: null }) })
      await waitFor(() => expect(result.current.ideas.map(i => i.id)).toEqual(['new']))
      await act(async () => { pending[0]!({ data: [{ id: 'old' }], error: null }) })
      expect(result.current.ideas.map(i => i.id)).toEqual(['new'])
    })

    it('loading stays true until the newest load finishes, even if an older one settles first', async () => {
      controlIdeas()
      const { result } = renderHook(() => useIdeas(), { wrapper })
      await waitFor(() => expect(pending.length).toBe(1))
      act(() => { void result.current.refresh() })
      await waitFor(() => expect(pending.length).toBe(2))
      await act(async () => { pending[0]!({ data: [], error: null }) })
      expect(result.current.loading).toBe(true)
      await act(async () => { pending[1]!({ data: [], error: null }) })
      expect(result.current.loading).toBe(false)
    })
  })
})
