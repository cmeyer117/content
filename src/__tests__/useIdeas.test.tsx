import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIdeas, IdeasProvider } from '@/hooks/useIdeas'

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
  },
}))

describe('useIdeas', () => {
  it('initializes with empty array', async () => {
    const { result } = renderHook(() => useIdeas(), {
      wrapper: ({ children }) => <IdeasProvider>{children}</IdeasProvider>,
    })
    expect(result.current.ideas).toEqual([])
  })
})
