import { supabase } from './supabase'

// --- DB 행 타입 ---

export interface ProfileRow {
  id: string
  name: string
  year: number
  month: number
  day: number
  hour: string | null   // "0"~"22", "unknown", 또는 null
  gender: 'male' | 'female'
  created_at: string
}

// --- 앱에서 쓰는 타입 ---

export interface SavedProfile {
  id: string
  form: {
    name: string
    year: string
    month: string
    day: string
    hour: string
    gender: 'male' | 'female'
  }
  savedAt: number
}

// --- 변환 헬퍼 ---

function rowToProfile(row: ProfileRow): SavedProfile {
  return {
    id: row.id,
    form: {
      name: row.name,
      year: String(row.year),
      month: String(row.month),
      day: String(row.day),
      hour: row.hour ?? '',
      gender: row.gender,
    },
    savedAt: new Date(row.created_at).getTime(),
  }
}

// --- CRUD ---

/** 전체 프로필 조회 (최신순) */
export async function fetchProfiles(): Promise<SavedProfile[]> {
  const { data, error } = await supabase
    .from('saju_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[fetchProfiles]', error.message)
    return []
  }

  return (data as ProfileRow[]).map(rowToProfile)
}

/** 프로필 저장 */
export async function addProfile(form: SavedProfile['form']): Promise<SavedProfile | null> {
  const { data, error } = await supabase
    .from('saju_profiles')
    .insert({
      name: form.name,
      year: Number(form.year),
      month: Number(form.month),
      day: Number(form.day),
      hour: form.hour === '' ? null : form.hour,
      gender: form.gender,
    })
    .select()
    .single()

  if (error) {
    console.error('[addProfile]', error.message)
    return null
  }

  return rowToProfile(data as ProfileRow)
}

/** 프로필 삭제 */
export async function deleteProfile(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('saju_profiles')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteProfile]', error.message)
    return false
  }

  return true
}
