export interface BirthFormLike {
  year: string
  month: string
  day: string
  hour: string
}

export const HOUR_OPTIONS = [
  { value: '23', label: '자시 (23:00~23:59, 익일 일주 반영)' },
  { value: '0', label: '자시 (00:00~00:59)' },
  { value: '1', label: '축시 (01:00~02:59)' },
  { value: '3', label: '인시 (03:00~04:59)' },
  { value: '5', label: '묘시 (05:00~06:59)' },
  { value: '7', label: '진시 (07:00~08:59)' },
  { value: '9', label: '사시 (09:00~10:59)' },
  { value: '11', label: '오시 (11:00~12:59)' },
  { value: '13', label: '미시 (13:00~14:59)' },
  { value: '15', label: '신시 (15:00~16:59)' },
  { value: '17', label: '유시 (17:00~18:59)' },
  { value: '19', label: '술시 (19:00~20:59)' },
  { value: '21', label: '해시 (21:00~22:59)' },
] as const

export function getHourLabel(hour: string): string {
  if (!hour || hour === 'unknown') return ''
  const directMatch = HOUR_OPTIONS.find(option => option.value === hour)
  if (directMatch) return directMatch.label.split(' ')[0]

  const legacyMap: Record<string, string> = {
    '2': '축시',
    '4': '인시',
    '6': '묘시',
    '8': '진시',
    '10': '사시',
    '12': '오시',
    '14': '미시',
    '16': '신시',
    '18': '유시',
    '20': '술시',
    '22': '해시',
  }

  return legacyMap[hour] ?? ''
}

export function formatBirthText(form: BirthFormLike): string {
  const hourLabel = getHourLabel(form.hour)
  const hourPart = hourLabel ? ` ${hourLabel}` : ''
  return `${form.year}.${form.month}.${form.day}${hourPart}`
}

export function normalizeMbtiInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
}
