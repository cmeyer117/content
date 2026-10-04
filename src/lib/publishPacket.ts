// The publish packet: what Carl needs in hand to post one READY idea, and the honest status of that post.
// Pure -- no I/O. "Copied" is deliberately NOT here: it is transient UI feedback, never a persisted fact,
// so it can't be mistaken for "published".
import { buildCoachingLink, inquiriesChipLabel } from '@/lib/attribution'
import type { ContentIdea } from '@/types/content'

export type PacketCopyKind = 'caption' | 'link' | 'both'

type PacketIdea = Pick<ContentIdea, 'id' | 'platform' | 'pillar' | 'body'>
type StatusIdea = Pick<ContentIdea, 'status' | 'posted_at'> & { inquiry_count?: number | null }

export function packetText(idea: PacketIdea, kind: PacketCopyKind): string {
  const caption = (idea.body ?? '').trim()
  const link = buildCoachingLink(idea)
  if (kind === 'caption') return caption
  if (kind === 'link') return link
  return caption ? `${caption}\n\n${link}` : link
}

// What the post still lacks before it can go out. Media lives in the notes field (no schema for it), so only the
// caption is checkable.
export function packetMissing(idea: PacketIdea): string[] {
  return (idea.body ?? '').trim() ? [] : ['caption']
}

export type PacketStatus = { stage: 'ready' | 'published'; publishedAt: string | null; inquiries: string | null }

// Inquiry text only once published, and it distinguishes unavailable / none yet / a count -- an inquiry is
// attribution evidence, not proof the post caused a sale.
export function packetStatus(idea: StatusIdea): PacketStatus {
  const published = idea.status === 'POSTED' || idea.status === 'TRACKED' || idea.posted_at != null
  if (!published) return { stage: 'ready', publishedAt: null, inquiries: null }
  return { stage: 'published', publishedAt: idea.posted_at, inquiries: inquiriesChipLabel(idea.inquiry_count) }
}
