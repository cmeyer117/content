import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIdeas, IdeasProvider } from '@/hooks/useIdeas'

// Per-table responses, swapped per test. coaching_inquiries is read with a
// bare select (no .order), so its mock resolves directly.
let ideasRows: unknown[] = []
let inquiriesResult: () => Promise<unknown> = () => Promise.resolve({ data: [], error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'coaching_inquiries') {
        return { select: vi.fn(() => inquiriesResult()) }
      }
      if (table === 'content_post_performance') {
        return { select: vi.fn(() => Promise.resolve({ data: [], error: null })) }
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: ideasRows, error: null })),
        })),
      }
    }),
    channel: vi.fn(() => ({
      on: vi.fn(function (this: unknown) { return this }),
      subscribe: vi.fn(function (this: unknown) { return this }),
    })),
    removeChannel: vi.fn(),
  },
}))

const ideaRow = (id: string) => ({ id, title: id, pillar: 'training', platform: 'tiktok', status: 'POSTED' })

function renderIdeas() {
  return renderHook(() => useIdeas(), {
    wrapper: ({ children }) => <IdeasProvider>{children}</IdeasProvider>,
  })
}

describe('useIdeas coaching inquiry counts', () => {
  beforeEach(() => {
    ideasRows = [ideaRow('a'), ideaRow('b')]
    inquiriesResult = () => Promise.resolve({ data: [], error: null })
  })

  it('attaches a per-idea inquiry_count grouped by content_idea_id', async () => {
    inquiriesResult = () => Promise.resolve({
      data: [{ content_idea_id: 'a' }, { content_idea_id: 'a' }, { content_idea_id: 'zzz' }],
      error: null,
    })
    const { result } = renderIdeas()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ideas.find(i => i.id === 'a')?.inquiry_count).toBe(2)
    expect(result.current.ideas.find(i => i.id === 'b')?.inquiry_count).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('fails soft to null when the read returns an error (e.g. RLS denies the owner read)', async () => {
    inquiriesResult = () => Promise.resolve({ data: null, error: { message: 'permission denied for table coaching_inquiries' } })
    const { result } = renderIdeas()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ideas).toHaveLength(2)
    expect(result.current.ideas[0].inquiry_count).toBeNull()
    // The ideas page must not surface an inquiries failure as a page error.
    expect(result.current.error).toBeNull()
  })

  it('fails soft to null when the read throws', async () => {
    inquiriesResult = () => Promise.reject(new Error('relation "coaching_inquiries" does not exist'))
    const { result } = renderIdeas()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.ideas).toHaveLength(2)
    expect(result.current.ideas[0].inquiry_count).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
