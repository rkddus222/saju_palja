import { isSupabaseConfigured, supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// --- Auth ---

// 마스터 계정 이메일 (환경변수 또는 하드코딩)
const MASTER_EMAIL = (import.meta.env.VITE_MASTER_EMAIL as string) || 'master@saju.app'

export type AuthUser = User | null

export function isMaster(user: AuthUser): boolean {
  return user?.email === MASTER_EMAIL
}

export async function signUp(email: string, password: string): Promise<{ user: AuthUser; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { user: null, error: '서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.' }
  }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { user: null, error: '서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.' }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.auth.signOut()
}

export async function getUser(): Promise<AuthUser> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function onAuthChange(callback: (user: AuthUser) => void) {
  if (!isSupabaseConfigured) {
    return { unsubscribe() {} }
  }
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
  mbti?: string | null
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
    mbti: string
  }
  savedAt: number
}

// --- 변환 헬퍼 ---

const MBTI_STORAGE_KEY = 'saju-profile-mbti-map'

function normalizeMbti(mbti: string | null | undefined): string {
  return (mbti ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
}

function readMbtiMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(MBTI_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function writeMbtiMap(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MBTI_STORAGE_KEY, JSON.stringify(map))
}

function persistMbti(profileId: string, mbti: string) {
  const map = readMbtiMap()
  if (mbti) map[profileId] = mbti
  else delete map[profileId]
  writeMbtiMap(map)
}

function rowToProfile(row: ProfileRow, localMbtiMap: Record<string, string>): SavedProfile {
  const mbti = normalizeMbti(row.mbti) || localMbtiMap[row.id] || ''
  return {
    id: row.id,
    form: {
      name: row.name,
      year: String(row.year),
      month: String(row.month),
      day: String(row.day),
      hour: row.hour ?? '',
      gender: row.gender,
      mbti,
    },
    savedAt: new Date(row.created_at).getTime(),
  }
}

// --- CRUD ---

/** 전체 프로필 조회 (마스터: 전체, 일반: 내 것만) */
export async function fetchProfiles(): Promise<SavedProfile[]> {
  const user = await getUser()
  if (!user) return []
  const localMbtiMap = readMbtiMap()
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

  return (data as ProfileRow[]).map(row => rowToProfile(row, localMbtiMap))
}

/** 프로필 저장 */
export async function addProfile(form: SavedProfile['form']): Promise<SavedProfile | null> {
  const user = await getUser()
  if (!user) return null
  const normalizedMbti = normalizeMbti(form.mbti)
  const row: Record<string, unknown> = {
    name: form.name,
    year: Number(form.year),
    month: Number(form.month),
    day: Number(form.day),
    hour: form.hour === '' ? null : form.hour,
    gender: form.gender,
  }
  if (normalizedMbti) row.mbti = normalizedMbti
  row.user_id = user.id

  let { data, error } = await supabase
    .from('saju_profiles')
    .insert(row)
    .select()
    .single()

  // 기존 테이블에 mbti 컬럼이 없더라도 앱에서는 MBTI를 유지한다.
  if (error && normalizedMbti && error.message.toLowerCase().includes('mbti')) {
    delete row.mbti
    ;({ data, error } = await supabase
      .from('saju_profiles')
      .insert(row)
      .select()
      .single())
  }

  if (error) {
    console.error('[addProfile]', error.message)
    return null
  }

  const saved = rowToProfile(data as ProfileRow, readMbtiMap())
  persistMbti(saved.id, normalizedMbti)
  return {
    ...saved,
    form: {
      ...saved.form,
      mbti: normalizedMbti,
    },
  }
}

/** 프로필 수정 */
export async function updateProfile(id: string, form: SavedProfile['form']): Promise<SavedProfile | null> {
  const normalizedMbti = normalizeMbti(form.mbti)
  const row: Record<string, unknown> = {
    name: form.name,
    year: Number(form.year),
    month: Number(form.month),
    day: Number(form.day),
    hour: form.hour === '' ? null : form.hour,
    gender: form.gender,
    mbti: normalizedMbti || null,
  }

  let { data, error } = await supabase
    .from('saju_profiles')
    .update(row)
    .eq('id', id)
    .select()
    .single()

  if (error && error.message.toLowerCase().includes('mbti')) {
    delete row.mbti
    ;({ data, error } = await supabase
      .from('saju_profiles')
      .update(row)
      .eq('id', id)
      .select()
      .single())
  }

  if (error) {
    console.error('[updateProfile]', error.message)
    return null
  }

  persistMbti(id, normalizedMbti)
  const saved = rowToProfile(data as ProfileRow, readMbtiMap())
  return {
    ...saved,
    form: {
      ...saved.form,
      mbti: normalizedMbti,
    },
  }
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

  persistMbti(id, '')
  return true
}
