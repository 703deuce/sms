export const REVISION_SETS: { id: string; label: string; color: string; asterisk: string }[] = [
  { id: 'white', label: 'White', color: '#ffffff', asterisk: '' },
  { id: 'blue', label: 'Blue', color: '#c8e0ff', asterisk: '*' },
  { id: 'pink', label: 'Pink', color: '#ffc8e8', asterisk: '*' },
  { id: 'yellow', label: 'Yellow', color: '#fff6b8', asterisk: '*' },
  { id: 'green', label: 'Green', color: '#c8f0c8', asterisk: '*' },
  { id: 'goldenrod', label: 'Goldenrod', color: '#f0d878', asterisk: '*' },
  { id: 'buff', label: 'Buff', color: '#f5e6c8', asterisk: '*' },
  { id: 'salmon', label: 'Salmon', color: '#ffc8b8', asterisk: '*' },
  { id: 'cherry', label: 'Cherry', color: '#f0a8b8', asterisk: '*' },
  { id: 'tan', label: 'Tan', color: '#e8d8b8', asterisk: '*' },
]

export function revisionSetById(id: string) {
  return REVISION_SETS.find((r) => r.id === id) ?? REVISION_SETS[0]
}
