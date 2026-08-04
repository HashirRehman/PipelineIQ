export interface MatchResult {
  score: number
  matchSkills: string[]
}

export function computeMatchScore(
  skills: string[],
  requirements: string[]
): MatchResult {
  const matchSkills = skills.filter(s =>
    requirements.some(r => r.toLowerCase().includes(s.toLowerCase()))
  )
  const score = Math.min(
    100,
    Math.round((matchSkills.length / Math.max(requirements.length, 1)) * 100) + 15
  )
  return { score, matchSkills }
}
