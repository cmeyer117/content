import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaCard from '@/components/IdeaCard'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1',
  title: 'Card title',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  notes: null,
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('IdeaCard', () => {
  it('calls onOpen when the card body is clicked', () => {
    const onOpen = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('Card title'))
    expect(onOpen).toHaveBeenCalledWith(idea)
  })

  it('does not call onOpen when delete is clicked', () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={onDelete} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('✕'))
    expect(onDelete).toHaveBeenCalledWith('idea-1')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
