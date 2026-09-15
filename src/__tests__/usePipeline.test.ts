import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePipeline } from '@/hooks/usePipeline'
import type { ContentIdea } from '@/types/content'

// Fleet Ops audit finding (Critical, 2026-09-14): moving a card to POSTED via
// the generic Pipeline drag-and-drop path (moveStage) never created a
// content_post_performance row, unlike the one-click Publish Queue path
// (markPosted) -- real posts made through the normal board UI were invisible
// to the nightly performance scraper, which only reads that child table.
// Mocking useIdeas directly (not Supabase) tests usePipeline's own branching
// logic without coupling to the Supabase call chain shape.
const updateMock = vi.fn(() => Promise.resolve())
const savePerformanceMock = vi.fn((_id: string, _platform: string, _data: unknown) => Promise.resolve())
let ideas: ContentIdea[] = []

vi.mock('@/hooks/useIdeas', () => ({
  useIdeas: () => ({
    ideas,
    loading: false,
    error: null,
    update: updateMock,
    remove: vi.fn(),
    savePerformance: savePerformanceMock,
  }),
}))

function makeIdea(overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'idea-1',
    status: 'READY',
    platform: 'tiktok',
    posted_at: null,
    scheduled_at: null,
    publish_at: null,
    ...overrides,
  } as ContentIdea
}

beforeEach(() => {
  updateMock.mockClear()
  savePerformanceMock.mockClear()
  ideas = []
})

describe('usePipeline.moveStage -> POSTED', () => {
  it('creates a performance row for a single-platform idea before updating status', async () => {
    ideas = [makeIdea({ platform: 'tiktok' })]
    const { result } = renderHook(() => usePipeline())

    await result.current.moveStage('idea-1', 'POSTED')

    expect(savePerformanceMock).toHaveBeenCalledTimes(1)
    expect(savePerformanceMock).toHaveBeenCalledWith('idea-1', 'tiktok', { posted_at: expect.any(String) })
    expect(updateMock).toHaveBeenCalledWith('idea-1', expect.objectContaining({ status: 'POSTED' }))
  })

  it('creates one performance row per platform for a both-platform idea', async () => {
    ideas = [makeIdea({ platform: 'both' })]
    const { result } = renderHook(() => usePipeline())

    await result.current.moveStage('idea-1', 'POSTED')

    expect(savePerformanceMock).toHaveBeenCalledTimes(2)
    const platforms = savePerformanceMock.mock.calls.map(c => c[1])
    expect(platforms.sort()).toEqual(['instagram', 'tiktok'])
  })

  it('does not create a duplicate performance row when already posted', async () => {
    ideas = [makeIdea({ platform: 'tiktok', posted_at: '2026-09-01T00:00:00.000Z' })]
    const { result } = renderHook(() => usePipeline())

    await result.current.moveStage('idea-1', 'POSTED')

    expect(savePerformanceMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith('idea-1', { status: 'POSTED' })
  })

  it('does not touch performance rows for a non-POSTED move', async () => {
    ideas = [makeIdea({ status: 'READY', platform: 'tiktok' })]
    const { result } = renderHook(() => usePipeline())

    await result.current.moveStage('idea-1', 'SCHEDULED')

    expect(savePerformanceMock).not.toHaveBeenCalled()
  })
})

describe('usePipeline.markPosted', () => {
  it('does the same thing moveStage(id, "POSTED") does -- both paths must create performance rows identically', async () => {
    ideas = [makeIdea({ platform: 'both' })]
    const { result } = renderHook(() => usePipeline())

    await result.current.markPosted('idea-1')

    expect(savePerformanceMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenCalledWith('idea-1', expect.objectContaining({ status: 'POSTED' }))
  })
})
