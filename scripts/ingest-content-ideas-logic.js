// Pure functions (exported for testing) — no I/O here. Same separation as
// api/posting-cadence-logic.js.

export function filterNewIdeas(ideas, existingTitles) {
  return ideas.filter((idea) => !existingTitles.has(idea.title))
}
