import { describe, expect, it } from 'vitest'
import { letterGradeFromFinal, overallClipLetterGrade } from '@/lib/clips/score-grade'

describe('score-grade', () => {
  it('maps 0–10 finals to letter grades', () => {
    expect(letterGradeFromFinal(9.3)).toBe('A+')
    expect(letterGradeFromFinal(7.8)).toBe('B+')
    expect(letterGradeFromFinal(4.9)).toBe('D')
  })

  it('accepts 0–100 overall scores', () => {
    expect(overallClipLetterGrade(87)).toBe('A')
    expect(overallClipLetterGrade(8.7)).toBe('A')
  })
})
