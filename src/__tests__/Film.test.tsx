import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Film from '@/pages/Film'
import type { ContentIdea } from '@/types/content'

const mk = (id: string, title: string, status: string) =>
  ({ id, title, status, body: null, hook: null, hook_first_2s: null, viewer_payoff: 'Payoff ' + id, pillar: 'training', platform: 'both' }) as unknown as ContentIdea

const ideas = vi.hoisted(() => ({ list: [] as unknown[], loading: false, error: null as string | null }))
vi.mock('@/hooks/useIdeas', () => ({ useIdeas: () => ({ ideas: ideas.list, loading: ideas.loading, error: ideas.error }) }))

const store = vi.hoisted(() => ({
  listPackets: vi.fn(), getPacket: vi.fn(), createPacket: vi.fn(), savePacket: vi.fn(),
  readDraft: vi.fn(), writeDraft: vi.fn(), clearDraft: vi.fn(),
}))
vi.mock('@/lib/filmStore', () => store)

beforeEach(() => {
  Object.values(store).forEach(f => f.mockReset())
  store.readDraft.mockReturnValue(null)
  ideas.list = [mk('1', 'Ready one', 'READY'), mk('2', 'Ready two', 'READY'), mk('3', 'Drafty', 'DRAFT')]
  store.listPackets.mockResolvedValue([
    { id: 'p1', content_idea_id: '1', state: 'filming', version: 1, shots: [
      { id: 'a', label: 'A', filmed: true, takes: [] }, { id: 'b', label: 'B', filmed: false, takes: [] }, { id: 'c', label: 'C', filmed: false, takes: [] },
    ] },
  ])
})

const renderAt = (path = '/film') => render(<MemoryRouter initialEntries={[path]}><Film /></MemoryRouter>)

describe('Film page', () => {
  it('lists only READY ideas with progress', async () => {
    renderAt()
    expect(await screen.findByText('Ready one')).toBeTruthy()
    expect(screen.getByText('Ready two')).toBeTruthy()
    expect(screen.queryByText('Drafty')).toBeNull()
    expect(await screen.findByText('1/3 filmed')).toBeTruthy()
    expect(screen.getByText('not started')).toBeTruthy()
  })

  it('says so when nothing is ready', async () => {
    ideas.list = [mk('3', 'Drafty', 'DRAFT')]
    store.listPackets.mockResolvedValue([])
    renderAt()
    expect(await screen.findByText(/No ideas are ready to film/)).toBeTruthy()
  })

  it('still lists ideas when the packet read fails, with progress unknown', async () => {
    store.listPackets.mockRejectedValue(new Error('down'))
    renderAt()
    expect(await screen.findByText('Ready one')).toBeTruthy()
    expect(await screen.findByText(/Progress unavailable/)).toBeTruthy()
  })

  it('opens the card for a chosen idea and returns to the list', async () => {
    store.getPacket.mockResolvedValue({ id: 'p2', content_idea_id: '2', state: 'filming', version: 1, shots: [{ id: 'a', label: 'Only shot', filmed: false, takes: [] }] })
    const user = userEvent.setup()
    renderAt()
    await user.click(await screen.findByText('Ready two'))
    expect(await screen.findByDisplayValue('Only shot')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '← Ideas' }))
    expect(await screen.findByText('Ready two')).toBeTruthy()
  })

  it('does not open a deep-linked idea that is no longer READY', async () => {
    renderAt('/film?idea=3')
    expect(await screen.findByText('Ready one')).toBeTruthy()
    expect(screen.queryByLabelText('Shot label')).toBeNull()
  })
})
