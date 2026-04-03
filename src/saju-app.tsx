import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  calculateSaju,
  type SajuResult,
} from './saju-calc'
import type { GuideCategory } from './guide-data'
import { loadGuide, type GuideKey } from './async-content'
import { LoginForm, SignupModal } from './components/auth-forms'
import { GuideModal } from './components/guide-modal'
import { ProfileDropdown } from './components/profile-dropdown'
import { ResultSection } from './components/result/result-section'
import {
  fetchProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  signOut,
  getUser,
  onAuthChange,
  isMaster,
  type SavedProfile,
  type AuthUser,
} from './profile-store'
import { HOUR_OPTIONS, getHourLabel, normalizeMbtiInput } from './saju-format'
import type { FormState } from './saju-types'

const GUIDE_BUTTONS: { key: GuideKey; label: string }[] = [
  { key: 'cheongan', label: '천간' },
  { key: 'jiji', label: '지지' },
  { key: 'sipsung', label: '십성' },
  { key: 'twelveStage', label: '12운성' },
  { key: 'twelveSpirit', label: '12신살' },
  { key: 'johu', label: '조후' },
  { key: 'singang', label: '신강/신약' },
  { key: 'hyungchung', label: '형충파해' },
]


function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isSameProfileBase(a: FormState | SavedProfile['form'], b: FormState | SavedProfile['form']): boolean {
  return (
    a.name === b.name &&
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.gender === b.gender
  )
}

function isSameProfileExact(a: FormState | SavedProfile['form'], b: FormState | SavedProfile['form']): boolean {
  return isSameProfileBase(a, b) && normalizeMbtiInput(a.mbti) === normalizeMbtiInput(b.mbti)
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('saju-theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('saju-theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(v => !v) }
}



// --- 메인 앱 ---

type View = 'form' | 'loading' | 'result'

export const App: React.FC = () => {
  const { dark, toggle: toggleTheme } = useTheme()
  const [view, setView] = useState<View>('form')

  const [form, setForm] = useState<FormState>({
    name: '',
    year: '',
    month: '',
    day: '',
    hour: '',
    gender: 'male',
    mbti: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SajuResult | null>(null)

  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [guideOpen, setGuideOpen] = useState<GuideCategory | null>(null)
  const [guideLoading, setGuideLoading] = useState(false)

  // Auth
  const [user, setUser] = useState<AuthUser>(null)
  const [authReady, setAuthReady] = useState(false)
  const signingUp = useRef(false) // 회원가입 중 자동로그인 방지 플래그
  const loadingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    getUser().then(u => {
      if (!active) return
      if (!signingUp.current) setUser(u)
      if (u) setLoading(true)
      setAuthReady(true)
    })
    const sub = onAuthChange(u => {
      if (!signingUp.current) setUser(u)
      if (u) setLoading(true)
      setAuthReady(true)
    })
    return () => {
      active = false
      sub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current !== null) {
        window.clearTimeout(loadingTimerRef.current)
      }
    }
  }, [])

  // 프로필: 유저 변경 시 다시 로드
  useEffect(() => {
    if (!authReady || !user) return
    fetchProfiles()
      .then(data => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false))
  }, [authReady, user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target
    const value = name === 'mbti' ? normalizeMbtiInput(e.target.value) : e.target.value
    setForm(prev => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const year = Number(form.year)
    const month = Number(form.month)
    const day = Number(form.day)

    if (!year || year < 1900 || year > 2100) {
      setError('출생 연도는 1900~2100 사이로 입력해주세요.')
      return
    }
    if (!month || month < 1 || month > 12) {
      setError('출생 월은 1~12 사이로 입력해주세요.')
      return
    }
    if (!day || day < 1 || day > 31) {
      setError('출생 일은 1~31 사이로 입력해주세요.')
      return
    }
    if (!isValidDateParts(year, month, day)) {
      setError('실제 존재하는 날짜를 입력해주세요.')
      return
    }

    setError(null)
    setActiveProfileId(null)
    setView('loading')
    const hourVal = form.hour === '' || form.hour === 'unknown' ? null : Number(form.hour)
    const sajuResult = calculateSaju(year, month, day, hourVal)

    // 로딩 연출
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current)
    }
    loadingTimerRef.current = window.setTimeout(() => {
      setResult(sajuResult)
      setView('result')
      loadingTimerRef.current = null
    }, 1800)
  }

  const handleSave = useCallback(async () => {
    const activeProfile = activeProfileId ? profiles.find(p => p.id === activeProfileId) : null
    const matchingProfile = activeProfile && isSameProfileBase(activeProfile.form, form)
      ? activeProfile
      : profiles.find(p => isSameProfileBase(p.form, form))
    const exactMatch = matchingProfile ? isSameProfileExact(matchingProfile.form, form) : false

    if (exactMatch || saving) return

    setSaving(true)
    const payload = { ...form, mbti: normalizeMbtiInput(form.mbti) }
    const saved = matchingProfile
      ? await updateProfile(matchingProfile.id, payload)
      : await addProfile(payload)
    setSaving(false)

    if (saved) {
      setForm(saved.form)
      setProfiles(prev => {
        const index = prev.findIndex(p => p.id === saved.id)
        if (index === -1) return [saved, ...prev]
        const next = [...prev]
        next[index] = saved
        return next
      })
      setActiveProfileId(saved.id)
    }
  }, [activeProfileId, form, profiles, saving])

  const handleLoadProfile = useCallback((profile: SavedProfile) => {
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setForm({ ...profile.form })
    setActiveProfileId(profile.id)

    const year = Number(profile.form.year)
    const month = Number(profile.form.month)
    const day = Number(profile.form.day)
    if (year && month && day) {
      const hourVal = profile.form.hour === '' || profile.form.hour === 'unknown' ? null : Number(profile.form.hour)
      setResult(calculateSaju(year, month, day, hourVal))
      setError(null)
      setView('result')
    }
  }, [])

  const handleDeleteProfile = useCallback(async (id: string) => {
    const ok = await deleteProfile(id)
    if (ok) {
      setProfiles(prev => prev.filter(p => p.id !== id))
      if (activeProfileId === id) {
        setActiveProfileId(null)
        setView('form')
      }
    } else {
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    }
  }, [activeProfileId])

  const handleNewSaju = useCallback(() => {
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    setForm({ name: '', year: '', month: '', day: '', hour: '', gender: 'male', mbti: '' })
    setResult(null)
    setActiveProfileId(null)
    setError(null)
    setView('form')
  }, [])

  const matchingProfile = (activeProfileId ? profiles.find(p => p.id === activeProfileId && isSameProfileBase(p.form, form)) : null)
    ?? profiles.find(p => isSameProfileBase(p.form, form))
  const alreadySaved = matchingProfile ? isSameProfileExact(matchingProfile.form, form) : false
  const saveLabel = saving
    ? '저장 중...'
    : alreadySaved
      ? '저장됨'
      : matchingProfile
        ? 'MBTI 저장'
        : '저장하기'

  const displayName = form.name.trim() || '의뢰인'
  const hourLabel = getHourLabel(form.hour)
  const birthText = `${form.year}년 ${form.month}월 ${form.day}일${
    hourLabel
      ? ` ${hourLabel}`
      : form.hour === 'unknown'
        ? ' 시주 미상'
        : ''
  }`
  const genderText = form.gender === 'female' ? '여성' : '남성'

  const [signupOpen, setSignupOpen] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setProfiles([])
    setActiveProfileId(null)
    setUser(null)
    setSignupSuccess(false)
  }

  const handleOpenGuide = useCallback(async (key: GuideKey) => {
    if (guideLoading) return
    setGuideLoading(true)
    try {
      const guide = await loadGuide(key)
      setGuideOpen(guide)
    } finally {
      setGuideLoading(false)
    }
  }, [guideLoading])

  if (!authReady) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p className="loading-title">로그인 상태를 확인하는 중...</p>
          <p className="loading-sub">세션과 저장된 프로필을 준비하고 있습니다</p>
        </div>
      </div>
    )
  }

  // 비로그인 상태: 로그인 화면
  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">사주팔자</h1>
          <p className="app-subtitle">
            생년월일시를 입력하여 사주원국을 확인하세요
          </p>
          <div className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'} aria-label={dark ? '라이트 모드' : '다크 모드'}>
              {dark ? '\u2600' : '\u263E'}
            </button>
          </div>
        </header>

        <div className="login-landing">
          <div className="login-landing-icon">&#x2728;</div>
          <h2 className="login-landing-title">로그인하고 내 사주를 확인하세요</h2>
          {signupSuccess && (
            <p className="auth-success">회원가입이 완료되었습니다! 로그인해주세요.</p>
          )}
          <LoginForm
            onAuth={u => setUser(u)}
            onSignupClick={() => { setSignupOpen(true); setSignupSuccess(false) }}
          />
        </div>

        {signupOpen && (
          <SignupModal
            signingUpRef={signingUp}
            onClose={(success) => {
              setSignupOpen(false)
              if (success) setSignupSuccess(true)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">사주팔자</h1>
        <p className="app-subtitle">
          생년월일시를 입력하여 사주원국을 확인하세요
        </p>
        <div className="header-actions">
          {isMaster(user) && <span className="master-badge">MASTER</span>}
          <button className="auth-btn" onClick={handleLogout}>
            {(user.email?.split('@')[0] ?? '')} 로그아웃
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'} aria-label={dark ? '라이트 모드' : '다크 모드'}>
            {dark ? '\u2600' : '\u263E'}
          </button>
        </div>
      </header>

      <div className="guide-buttons">
        {GUIDE_BUTTONS.map(button => (
          <button
            key={button.key}
            className="guide-btn"
            onClick={() => { void handleOpenGuide(button.key) }}
            disabled={guideLoading}
          >
            {button.label}
          </button>
        ))}
      </div>

      {guideOpen && <GuideModal guide={guideOpen} onClose={() => setGuideOpen(null)} />}

      <main className="main-content">
        {/* 상단 바: 드롭다운 + 새 사주 버튼 (로딩 중에는 숨김) */}
        {view !== 'loading' && (
          <div className="top-bar">
            {loading ? (
              <p className="loading-text">불러오는 중...</p>
            ) : profiles.length > 0 ? (
              <ProfileDropdown
                profiles={profiles}
                activeProfileId={activeProfileId}
                onLoad={handleLoadProfile}
                onDelete={handleDeleteProfile}
              />
            ) : null}

            {view === 'result' && (
              <button
                type="button"
                className="new-saju-btn"
                onClick={handleNewSaju}
              >
                + 새 사주 보기
              </button>
            )}
          </div>
        )}

        {/* 입력 폼 (form 뷰일 때만) */}
        {view === 'form' && (
          <section className="form-card">
            <h2 className="section-title">출생 정보</h2>
            <form className="form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="name">이름</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="홍길동"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row-4">
                <div className="form-group">
                  <label className="label" htmlFor="year">출생 연도</label>
                  <input
                    id="year"
                    type="number"
                    name="year"
                    min={1900}
                    max={2100}
                    placeholder="1995"
                    value={form.year}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="month">월</label>
                  <input
                    id="month"
                    type="number"
                    name="month"
                    min={1}
                    max={12}
                    placeholder="7"
                    value={form.month}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="day">일</label>
                  <input
                    id="day"
                    type="number"
                    name="day"
                    min={1}
                    max={31}
                    placeholder="15"
                    value={form.day}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="hour">시</label>
                  <select
                    id="hour"
                    name="hour"
                    value={form.hour}
                    onChange={handleChange}
                  >
                    <option value="">선택</option>
                    {HOUR_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value="unknown">모름</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <span className="label">성별</span>
                <div className="gender-toggle">
                  <label className={`gender-option ${form.gender === 'male' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={form.gender === 'male'}
                      onChange={handleChange}
                    />
                    <span>남</span>
                  </label>
                  <label className={`gender-option ${form.gender === 'female' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={form.gender === 'female'}
                      onChange={handleChange}
                    />
                    <span>여</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <span className="label">달력</span>
                <div className="calendar-info">양력 (Solar)</div>
              </div>

              <div className="form-group">
                <span className="label">시간 기준</span>
                <div className="calendar-info">23:00~23:59 자시는 익일 일주 기준으로 계산</div>
              </div>

              <button type="submit" className="submit-btn">
                사주 보기
              </button>

              {error && <div className="error-msg">{error}</div>}
            </form>
          </section>
        )}

        {/* 로딩 애니메이션 */}
        {view === 'loading' && (
          <div className="loading-screen">
            <div className="loading-spinner" />
            <p className="loading-title">사주를 분석하고 있어요...</p>
            <p className="loading-sub">천간·지지·오행의 기운을 읽는 중</p>
          </div>
        )}

        {/* 결과 (result 뷰일 때만) */}
        {view === 'result' && result && (
          <ResultSection
            result={result}
            name={displayName}
            birthText={birthText}
            genderText={genderText}
            form={form}
            profiles={profiles}
            onSave={handleSave}
            onMbtiChange={value => setForm(prev => ({ ...prev, mbti: normalizeMbtiInput(value) }))}
            saveLabel={saveLabel}
            alreadySaved={alreadySaved}
            isSaving={saving}
            dark={dark}
          />
        )}
      </main>

      <footer className="app-footer">
        본 서비스는 참고용이며 전문 상담을 대체하지 않습니다.
      </footer>
    </div>
  )
}
