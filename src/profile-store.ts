import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// --- Auth ---

// 마스터 계정 이메일 (환경변수 또는 하드코딩)
const MASTER_EMAIL = (import.meta.env.VITE_MASTER_EMAIL as string) || 'master@saju.app'

export type AuthUser = User | null

export function isMaster(user: AuthUser): boolean {
  return user?.email === MASTER_EMAIL
}

export async function signUp(email: string, password: string): Promise<{ user: AuthUser; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getUser(): Promise<AuthUser> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function onAuthChange(callback: (user: AuthUser) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return data.subscription
}

// --- DB 행 타입 ---

export interface ProfileRow {
  id: string
  user_id?: string
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

/** 전체 프로필 조회 (마스터: 전체, 일반: 내 것만) */
export async function fetchProfiles(): Promise<SavedProfile[]> {
  const user = await getUser()
  let query = supabase
    .from('saju_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 마스터는 전체 열람, 일반 유저는 자기 것만
  if (user && !isMaster(user)) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error('[fetchProfiles]', error.message)
    return []
  }

  return (data as ProfileRow[]).map(rowToProfile)
}

/** 프로필 저장 */
export async function addProfile(form: SavedProfile['form']): Promise<SavedProfile | null> {
  const user = await getUser()
  const row: Record<string, unknown> = {
    name: form.name,
    year: Number(form.year),
    month: Number(form.month),
    day: Number(form.day),
    hour: form.hour === '' ? null : form.hour,
    gender: form.gender,
  }
  if (user) row.user_id = user.id

  const { data, error } = await supabase
    .from('saju_profiles')
    .insert(row)
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
