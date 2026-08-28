import type { Platform, PostPlatform } from '@/types/content'

// A 'both' idea needs a performance row per platform; a single-platform
// idea needs just the one. Pulled out as its own pure function so the
// mapping is unit-testable without mocking Supabase.
export function platformsToMark(platform: Platform): PostPlatform[] {
  return platform === 'both' ? ['tiktok', 'instagram'] : [platform]
}
