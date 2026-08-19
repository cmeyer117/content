import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useExperiments } from '@/hooks/useExperiments'

const mockInsertResult = { data: { id: 'new-1', hypothesis: 'Shorter hooks win', status: 'active', verdict: null, created_at: '2026-08-19T00:00:00Z' }, error: null }

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({
          data: [{ id: 'exp-1', hypothesis: 'Old one', status: 'concluded', verdict: 'No difference', created_at: '2026-08-01T00:00:00Z' }],
          error: null,
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(mockInsertResult)),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}))

describe('useExperiments', () => {
  it('loads experiments on mount', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.experiments).toHaveLength(1)
  })

  it('exposes active as null when no experiment is active', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.active).toBeNull()
  })

  it('start() inserts a new active experiment and prepends it', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.start('Shorter hooks win') })
    expect(result.current.experiments[0].hypothesis).toBe('Shorter hooks win')
    expect(result.current.active?.id).toBe('new-1')
  })

  it('conclude() sets status to concluded and stores the verdict', async () => {
    const { result } = renderHook(() => useExperiments())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.start('Shorter hooks win') })
    await act(async () => { await result.current.conclude('new-1', 'Confirmed, cut to under 3s') })
    const concluded = result.current.experiments.find(e => e.id === 'new-1')
    expect(concluded?.status).toBe('concluded')
    expect(concluded?.verdict).toBe('Confirmed, cut to under 3s')
    expect(result.current.active).toBeNull()
  })
})
