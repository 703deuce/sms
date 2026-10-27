/** Match worker `clips_worker.picker.grades.letter_grade` for 0–10 final scores. */
export function letterGradeFromFinal(score0to10: number): string {
  const s = score0to10 * 10
  if (s >= 93) return 'A+'
  if (s >= 87) return 'A'
  if (s >= 83) return 'A-'
  if (s >= 77) return 'B+'
  if (s >= 73) return 'B'
  if (s >= 67) return 'B-'
  if (s >= 63) return 'C+'
  if (s >= 57) return 'C'
  if (s >= 50) return 'D'
  return 'D'
}

/** Overall clip score may be stored as 0–10 or 0–100. */
export function overallClipLetterGrade(score: number): string {
  const onTen = score <= 10 ? score : score / 10
  return letterGradeFromFinal(onTen)
}
