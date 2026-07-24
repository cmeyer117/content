// Reusable, idempotent ingestion of extracted vault insights into the
// content_ideas idea bank. Re-run safely any time — only titles not already
// present get inserted. Run with --dry-run to preview.
// Data path is required (no default) — this replaced the Row-only version
// (scripts/ingest-row-ideas.js), which defaulted to data/row-exercise-ideas.json.
// That file still works as input, just pass its path explicitly.
import { readFileSync } from 'node:fs'
import { filterNewIdeas } from './ingest-content-ideas-logic.js'

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co'
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv'

async function fetchExistingTitles() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas?select=title`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  })
  if (!r.ok) throw new Error(`Failed to fetch existing titles: ${r.status} ${await r.text()}`)
  const rows = await r.json()
  return new Set(rows.map((row) => row.title))
}

async function insertIdea(idea) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      title: idea.title,
      body: idea.body,
      pillar: idea.pillar,
      notes: idea.notes ?? null,
      status: 'IDEA',
    }),
  })
  if (!r.ok) throw new Error(`Failed to insert "${idea.title}": ${r.status} ${await r.text()}`)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const dataPathArg = process.argv.find((a) => a.endsWith('.json'))
  if (!dataPathArg) {
    throw new Error('Usage: node ingest-content-ideas.js <path-to-ideas.json> [--dry-run]')
  }

  const ideas = JSON.parse(readFileSync(dataPathArg, 'utf-8'))
  const existingTitles = await fetchExistingTitles()
  const newIdeas = filterNewIdeas(ideas, existingTitles)

  console.log(`${ideas.length} candidate ideas, ${ideas.length - newIdeas.length} already present, ${newIdeas.length} new.`)
  for (const idea of newIdeas) {
    console.log(`  ${dryRun ? '[dry-run] would insert' : 'inserting'}: ${idea.title}`)
    if (!dryRun) await insertIdea(idea)
  }
  console.log(dryRun ? 'Dry run complete, nothing written.' : `Inserted ${newIdeas.length} ideas.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
