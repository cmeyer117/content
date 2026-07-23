import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PillarBadge from '@/components/PillarBadge'
import { PILLARS } from '@/lib/constants'
import type { Pillar } from '@/types/content'

describe('PillarBadge', () => {
  it.each(PILLARS)('renders an icon and label for $value', ({ value, label }) => {
    // The icon is decorative (alt="") — the pillar name is already conveyed
    // by the adjacent label text — so it's exposed with role="presentation",
    // not role="img". Query the DOM directly instead of getByRole('img').
    const { container } = render(<PillarBadge pillar={value as Pillar} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBeTruthy()
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('falls back to plain text with no icon for an unrecognized pillar value', () => {
    const { container } = render(<PillarBadge pillar={'unknown' as Pillar} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('unknown')).toBeTruthy()
  })
})
