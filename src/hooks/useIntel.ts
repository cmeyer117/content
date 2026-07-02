import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CreatorInsight, TrackedCreator } from '@/lib/intel'

export function useIntel() {
  const [insights, setInsights] = useState<CreatorInsight[]>([])
  const [creators, setCreators] = useState<TrackedCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [insightsRes, creatorsRes] = await Promise.all([
        supabase.from('creator_insights').select('*').order('week_of', { ascending: false }).limit(30),
        supabase.from('tracked_creators').select('*'),
      ])
      if (insightsRes.error) setError(insightsRes.error.message)
      else setInsights((insightsRes.data as CreatorInsight[]) ?? [])
      if (creatorsRes.data) setCreators(creatorsRes.data as TrackedCreator[])
      setLoading(false)
    })()
  }, [])

  return { insights, creators, loading, error }
}
