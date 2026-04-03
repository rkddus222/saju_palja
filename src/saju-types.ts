export type Gender = 'male' | 'female'

export interface FormState {
  name: string
  year: string
  month: string
  day: string
  hour: string
  gender: Gender
  mbti: string
}
