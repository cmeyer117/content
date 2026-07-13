import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaDetailModal from '@/components/IdeaDetailModal'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1',
  title: 'Original title',
  body: 'Original body',
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: 'Original hook',
  notes: 'Original notes',
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('IdeaDetailModal', () => {
  it('renders the idea\'s current field values', () => {
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByDisplayValue('Original title')).toBeTruthy()
    expect(screen.getByDisplayValue('Original hook')).toBeTruthy()
    expect(screen.getByDisplayValue('Original body')).toBeTruthy()
    expect(screen.getByDisplayValue('Original notes')).toBeTruthy()
  })

  it('calls onSave with edited fields when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('Original body'), {
      target: { value: 'Revised body' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({
      title: 'Original title',
      hook: 'Original hook',
      body: 'Revised body',
      notes: 'Original notes',
      pillar: 'training',
      platform: 'tiktok',
    }))
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<IdeaDetailModal idea={idea} onClose={onClose} onSave={async () => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
