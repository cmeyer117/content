import { useState } from 'react'
import { useIdeas } from '@/hooks/useIdeas'
import IdeaCard from '@/components/IdeaCard'
import IdeaDetailModal from '@/components/IdeaDetailModal'
import { PILLARS, PLATFORMS } from '@/lib/constants'
import type { Pillar, Platform, NewContentIdea, ContentIdea } from '@/types/content'

const empty: NewContentIdea = {
  title: '',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  notes: null,
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
}

export default function Ideas() {
  const { ideas, loading, add, update, remove } = useIdeas()
  const [form, setForm] = useState<NewContentIdea>(empty)
  const [saving, setSaving] = useState(false)
  const [filterPillar, setFilterPillar] = useState<Pillar | 'all'>('all')
  const [selectedIdea, setSelectedIdea] = useState<ContentIdea | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await add(form)
      setForm(empty)
    } finally {
      setSaving(false)
    }
  }

  const filtered = ideas.filter(i => filterPillar === 'all' || i.pillar === filterPillar)

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-white">Ideas</h1>

      {/* Capture form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white placeholder-gray-600 text-sm w-full"
          placeholder="What's the idea?"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
        <input
          className="bg-surface border border-border rounded-lg px-4 py-2 text-white placeholder-gray-600 text-sm w-full"
          placeholder="Hook (optional)"
          value={form.hook ?? ''}
          onChange={e => setForm(f => ({ ...f, hook: e.target.value || null }))}
        />
        <div className="flex gap-3">
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={form.pillar}
            onChange={e => setForm(f => ({ ...f, pillar: e.target.value as Pillar }))}
          >
            {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white flex-1"
            value={form.platform}
            onChange={e => setForm(f => ({ ...f, platform: e.target.value as Platform }))}
          >
            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          className="bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add Idea'}
        </button>
      </form>

      {/* Pillar filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterPillar('all')}
          className={`px-3 py-1 rounded-full text-xs ${filterPillar === 'all' ? 'bg-accent text-white' : 'bg-card border border-border text-gray-400'}`}
        >
          All
        </button>
        {PILLARS.map(p => (
          <button
            key={p.value}
            onClick={() => setFilterPillar(p.value)}
            className={`px-3 py-1 rounded-full text-xs ${filterPillar === p.value ? 'bg-accent text-white' : 'bg-card border border-border text-gray-400'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-600 text-sm">Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onMove={(id, status) => void update(id, { status })}
              onDelete={(id) => void remove(id)}
              onOpen={setSelectedIdea}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-gray-600 text-sm">No ideas yet. Add one above.</p>
          )}
        </div>
      )}
      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onSave={update}
        />
      )}
    </div>
  )
}
