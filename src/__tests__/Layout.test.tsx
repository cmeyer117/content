import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '@/components/Layout'

vi.mock('@/components/PushSubscribeButton', () => ({ default: () => <button type="button">Push</button> }))

describe('Layout', () => {
  it('has a Film link and mounts the push button exactly once', () => {
    render(<MemoryRouter><Layout><p>page</p></Layout></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Film' }).getAttribute('href')).toBe('/film')
    expect(screen.getAllByRole('button', { name: 'Push' })).toHaveLength(1)
    expect(screen.getByText('page')).toBeTruthy()
  })

  it('uses one nav that is a scrolling top bar on phones and a sidebar from md up', () => {
    render(<MemoryRouter><Layout><p>page</p></Layout></MemoryRouter>)
    const nav = screen.getByRole('navigation')
    expect(nav.className).toContain('overflow-x-auto')
    expect(nav.className).toContain('md:flex-col')
    expect(nav.className).toContain('md:w-48')
  })
})
