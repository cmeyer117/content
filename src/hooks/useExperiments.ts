import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Experiment } from '@/types/content'

export function useExperiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('experiments').select('*').order('created_at', { ascending: false })
    setExperiments((data as Experiment[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const start = async (hypothesis: string) => {
    const { data, error } = await supabase
      .from('experiments')
      .insert({ hypothesis, status: 'active' })
      .select()
      .single()
    if (error) throw error
    setExperiments(prev => [data as Experiment, ...prev])
    return data as Experiment
  }

  const conclude = async (id: string, verdict: string) => {
    const { error } = await supabase.from('experiments').update({ status: 'concluded', verdict }).eq('id', id)
    if (error) throw error
    setExperiments(prev => prev.map(e => e.id === id ? { ...e, status: 'concluded', verdict } : e))
  }

  const active = experiments.find(e => e.status === 'active') ?? null

  return { experiments, active, loading, start, conclude }
}
