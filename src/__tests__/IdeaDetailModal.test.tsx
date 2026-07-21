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
  idea_score: null,
  idea_score_notes: null,
  execution_score: null,
  execution_score_notes: null,
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

  it('renders existing score fields', () => {
    const scored: ContentIdea = {
      ...idea,
      idea_score: 8,
      idea_score_notes: 'Strong hook pattern-fit',
      execution_score: 6,
      execution_score_notes: 'Delivery was flat',
    }
    render(<IdeaDetailModal idea={scored} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByDisplayValue('8')).toBeTruthy()
    expect(screen.getByDisplayValue('Strong hook pattern-fit')).toBeTruthy()
    expect(screen.getByDisplayValue('6')).toBeTruthy()
    expect(screen.getByDisplayValue('Delivery was flat')).toBeTruthy()
  })

  it('saves a blank score as null, not 0', async () => {
    const scored: ContentIdea = { ...idea, idea_score: 7 }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={scored} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('7'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({
      idea_score: null,
    }))
  })

  it('clamps an out-of-range score to 10 on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('Idea Score (1-10)'), {
      target: { value: '99' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({
      idea_score: 10,
    }))
  })

  it('clamps a below-range score to 1 on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('Execution Score (1-10)'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({
      execution_score: 1,
    }))
  })
})
