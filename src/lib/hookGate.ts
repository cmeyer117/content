import type { ContentIdea } from '@/types/content'

export function isReadyForDraft(idea: ContentIdea): { ready: boolean; missing: string[] } {
  const missing: string[] = []
  if (!idea.content_class) missing.push('content class')
  if (!idea.hook_first_2s) missing.push('opening hook')
  if (!idea.viewer_payoff) missing.push('viewer payoff')
  if (!idea.target_length_seconds) missing.push('target length')
  if (idea.target_length_seconds != null && idea.target_length_seconds > 30 && !idea.length_justification) {
    missing.push('length justification (over 30s)')
  }
  if (idea.content_class === 'diary' && !idea.diary_justification) {
    missing.push('diary justification')
  }
  return { ready: missing.length === 0, missing }
}
