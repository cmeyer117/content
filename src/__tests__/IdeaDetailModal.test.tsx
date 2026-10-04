import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
  content_class: null,
  hook_first_2s: null,
  viewer_payoff: null,
  target_length_seconds: null,
  length_justification: null,
  diary_justification: null,
  notes: 'Original notes',
  scheduled_at: null,
  publish_at: null,
  posted_at: null,
  idea_score: null,
  idea_score_notes: null,
  execution_score: null,
  execution_score_notes: null,
  predicted_score: null,
  predicted_reasoning: null,
  predicted_at: null,
  prediction_version: null,
  source_intel_insight_id: null,
  experiment_id: null,
  series_source_performance_id: null,
  angle: null,
  position: null,
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

  // Fixed 2026-08-19: the Hook-First Brief was previously editable only in
  // IDEA, but the gate (IdeaCard.tsx) now checks these fields at the
  // DRAFT -> READY transition, two stages later -- so a draft needed to be
  // able to still edit them.
  it('shows the Hook-First Brief while in DRAFT, not just IDEA', () => {
    const draftIdea = { ...idea, status: 'DRAFT' as const }
    render(<IdeaDetailModal idea={draftIdea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByText('Hook-First Brief')).toBeTruthy()
  })

  it('hides the Hook-First Brief once past DRAFT', () => {
    const readyIdea = { ...idea, status: 'READY' as const }
    render(<IdeaDetailModal idea={readyIdea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.queryByText('Hook-First Brief')).toBeNull()
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

  it('renders a read-only predicted score block when predicted_score is set', () => {
    const predicted: ContentIdea = {
      ...idea,
      predicted_score: 8,
      predicted_reasoning: 'Matches Carl\'s own top-performing narrative hook pattern',
    }
    render(<IdeaDetailModal idea={predicted} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByText(/Predicted pattern-fit: 8\/10/)).toBeTruthy()
    expect(screen.getByText(/Matches Carl's own top-performing narrative hook pattern/)).toBeTruthy()
  })

  it('renders no predicted score block when predicted_score is null', () => {
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.queryByText(/Predicted pattern-fit/)).toBeNull()
  })

  it('shows no experiment checkbox when there is no active experiment', () => {
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} activeExperiment={null} />)
    expect(screen.queryByText(/Part of experiment/)).toBeNull()
  })

  it('shows a checked checkbox when the idea is already tagged into the active experiment', () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const tagged = { ...idea, experiment_id: 'exp-1' }
    render(<IdeaDetailModal idea={tagged} onClose={() => {}} onSave={async () => {}} activeExperiment={active} />)
    const checkbox = screen.getByLabelText(/Part of experiment: Shorter hooks win/) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('saves experiment_id when the checkbox is checked', async () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} activeExperiment={active} />)

    fireEvent.click(screen.getByLabelText(/Part of experiment: Shorter hooks win/))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({ experiment_id: 'exp-1' }))
  })

  it('saves experiment_id as null when the checkbox is unchecked', async () => {
    const active = { id: 'exp-1', hypothesis: 'Shorter hooks win', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const tagged = { ...idea, experiment_id: 'exp-1' }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={tagged} onClose={() => {}} onSave={onSave} activeExperiment={active} />)

    fireEvent.click(screen.getByLabelText(/Part of experiment: Shorter hooks win/))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({ experiment_id: null }))
  })

  describe('Copy coaching link', () => {
    function stubClipboard(writeText: (text: string) => Promise<void>) {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    }

    it('copies the attributed coaching-landing URL built from the idea', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      stubClipboard(writeText)
      render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)

      fireEvent.click(screen.getByRole('button', { name: /copy coaching link/i }))

      expect(writeText).toHaveBeenCalledWith(
        'https://coaching-landing-nu.vercel.app/?utm_source=tiktok&utm_campaign=training&content_idea_id=idea-1',
      )
      await waitFor(() => expect(screen.getByText(/copied/i)).toBeTruthy())
    })

    it('does not call onSave when copying (no attributed_link_copied_at stamp exists on this schema)', () => {
      stubClipboard(vi.fn().mockResolvedValue(undefined))
      const onSave = vi.fn()
      render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={onSave} />)
      fireEvent.click(screen.getByRole('button', { name: /copy coaching link/i }))
      expect(onSave).not.toHaveBeenCalled()
    })

    it('fails soft when the clipboard write rejects', async () => {
      stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
      render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
      fireEvent.click(screen.getByRole('button', { name: /copy coaching link/i }))
      await waitFor(() => expect(screen.getByText(/copy failed/i)).toBeTruthy())
    })
  })

  it('preserves experiment_id for an idea tagged into a different, non-active experiment on an unrelated save', async () => {
    const active = { id: 'exp-2', hypothesis: 'New hypothesis', status: 'active' as const, verdict: null, created_at: '2026-08-19T00:00:00Z' }
    const taggedElsewhere = { ...idea, experiment_id: 'exp-1' }
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<IdeaDetailModal idea={taggedElsewhere} onClose={() => {}} onSave={onSave} activeExperiment={active} />)

    fireEvent.change(screen.getByDisplayValue('Original title'), { target: { value: 'Fixed typo' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledWith('idea-1', expect.objectContaining({ experiment_id: 'exp-1' }))
  })
})

describe('IdeaDetailModal publish packet', () => {
  const ready: ContentIdea = { ...idea, status: 'READY', body: 'Hit your lifts.' }
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    localStorage.clear()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  const open = (i: ContentIdea, extra: Record<string, unknown> = {}) =>
    render(<IdeaDetailModal idea={i} onClose={() => {}} onSave={async () => {}} {...extra} />)

  it('shows the packet for a READY idea and not for an IDEA', () => {
    open(ready)
    expect(screen.getByText('Publish packet')).toBeTruthy()
    cleanup()
    open(idea)
    expect(screen.queryByText('Publish packet')).toBeNull()
  })

  it('copies caption, link, and caption+link', async () => {
    open(ready)
    fireEvent.click(screen.getByRole('button', { name: 'Copy caption' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Hit your lifts.'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy caption + link' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/^Hit your lifts\.\n\nhttps:\/\/.*content_idea_id=idea-1/)))
  })

  it('a missing caption is called out and the caption copies are disabled', () => {
    open({ ...ready, body: null })
    expect(screen.getByText(/add a caption/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Copy caption' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Mark published calls onMarkPosted with the idea id', async () => {
    const onMarkPosted = vi.fn().mockResolvedValue(undefined)
    open(ready, { onMarkPosted })
    fireEvent.click(screen.getByRole('button', { name: 'Mark published' }))
    await waitFor(() => expect(onMarkPosted).toHaveBeenCalledWith('idea-1'))
  })

  it('a failed Mark published says so and can be retried', async () => {
    const onMarkPosted = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(undefined)
    open(ready, { onMarkPosted })
    fireEvent.click(screen.getByRole('button', { name: 'Mark published' }))
    await waitFor(() => expect(screen.getByText(/failed, retry/i)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Mark published' }))
    await waitFor(() => expect(onMarkPosted).toHaveBeenCalledTimes(2))
  })

  it('a posted idea shows Published with its date and an honest inquiry label, and no Mark published button', () => {
    const posted = { ...ready, status: 'POSTED' as const, posted_at: '2026-10-03T18:00:00Z' }
    open({ ...posted, inquiry_count: null } as ContentIdea)
    expect(screen.getByText(/published/i)).toBeTruthy()
    expect(screen.getByText(/Inquiries: unavailable/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark published' })).toBeNull()
  })
})

describe('IdeaDetailModal save failure and draft recovery', () => {
  beforeEach(() => { localStorage.clear() })

  it('a failed save shows a message, keeps the modal open and the edits intact', async () => {
    const onClose = vi.fn()
    const onSave = vi.fn().mockRejectedValue(new Error('network'))
    render(<IdeaDetailModal idea={idea} onClose={onClose} onSave={onSave} />)
    fireEvent.change(screen.getByDisplayValue('Original body'), { target: { value: 'My edit' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByText(/save failed/i)).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('My edit')).toBeTruthy()
  })

  it('unsaved edits are restored when the modal reopens, and Discard returns to the saved text', () => {
    const first = render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    fireEvent.change(screen.getByDisplayValue('Original body'), { target: { value: 'Unsaved edit' } })
    first.unmount()
    render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    expect(screen.getByDisplayValue('Unsaved edit')).toBeTruthy()
    expect(screen.getByText(/restored unsaved edits/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    expect(screen.getByDisplayValue('Original body')).toBeTruthy()
    expect(screen.queryByText(/restored unsaved edits/i)).toBeNull()
  })

  it('a successful save clears the draft', async () => {
    const first = render(<IdeaDetailModal idea={idea} onClose={() => {}} onSave={async () => {}} />)
    fireEvent.change(screen.getByDisplayValue('Original body'), { target: { value: 'Saved edit' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(localStorage.getItem('content:idea-draft:idea-1')).toBeNull())
    first.unmount()
  })
})
