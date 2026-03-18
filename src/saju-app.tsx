import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  calculateSaju,
  analyzeElements,
  analyzeJohu,
  analyzeSingang,
  analyzeInteractions,
  determineYongshin,
  analyzeVoid,
  analyzePeriodInteraction,
  calculateDaeun,
  calculateSeun,
  calculateMonthlyFortunes,
  analyzeCompatibility,
  DAY_MASTER_PROFILES,
  ELEMENTS_KO,
  ELEMENTS_HANJA,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  TEN_GOD_DESC,
  STEM_DESC,
  BRANCH_DESC,
  TWELVE_STAGE_DESC,
  TWELVE_SPIRIT_DESC,
  VOID_DESC,
  type SajuResult,
  type Pillar,
  type CompatibilityResult,
  type SingangResult,
  type JohuResult,
  type YongshinResult,
} from './saju-calc'
import { DAY_PILLAR_PROFILES } from './day-pillar-profiles'
import {
  CHEONGAN_GUIDE,
  JIJI_GUIDE,
  SIPSUNG_GUIDE,
  TWELVE_STAGE_GUIDE,
  TWELVE_SPIRIT_GUIDE,
  JOHU_GUIDE,
  SINGANG_GUIDE,
  HYUNGCHUNG_GUIDE,
  type GuideCategory,
} from './guide-data'
import {
  fetchProfiles,
  addProfile,
  updateProfile,
  deleteProfile,
  signUp,
  signIn,
  signOut,
  getUser,
  onAuthChange,
  isMaster,
  type SavedProfile,
  type AuthUser,
} from './profile-store'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import html2canvas from 'html2canvas'

type Gender = 'male' | 'female'

interface FormState {
  name: string
  year: string
  month: string
  day: string
  hour: string
  gender: Gender
  mbti: string
}

const HOUR_OPTIONS = [
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

function getHourLabel(hour: string): string {
  if (!hour || hour === 'unknown') return ''
  const directMatch = HOUR_OPTIONS.find(option => option.value === hour)
  if (directMatch) return directMatch.label.split(' ')[0]

  // 구버전 저장값(0,2,4,...,22) 호환
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

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function formatBirthText(form: FormState): string {
  const hourLabel = getHourLabel(form.hour)
  const hourPart = hourLabel ? ` ${hourLabel}` : ''
  return `${form.year}.${form.month}.${form.day}${hourPart}`
}

function normalizeMbtiInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
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

// 오행별 색상 (木, 火, 土, 金, 水)
const EL_BG = ['#dcfce7', '#fee2e2', '#fef9c3', '#f4f4f5', '#dbeafe']
const EL_TEXT = ['#166534', '#991b1b', '#854d0e', '#3f3f46', '#1e3a8a']
const EL_BORDER = ['#86efac', '#fca5a5', '#fde047', '#a1a1aa', '#93c5fd']
const EL_BAR = ['#22c55e', '#ef4444', '#eab308', '#a1a1aa', '#3b82f6']

// 다크모드용 오행 색상
const EL_BG_DARK = ['#14532d', '#450a0a', '#422006', '#27272a', '#172554']
const EL_TEXT_DARK = ['#86efac', '#fca5a5', '#fde047', '#d4d4d8', '#93c5fd']
const EL_BORDER_DARK = ['#166534', '#991b1b', '#854d0e', '#3f3f46', '#1e3a8a']

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

function getElBg(el: number, dark: boolean) { return dark ? EL_BG_DARK[el] : EL_BG[el] }
function getElText(el: number, dark: boolean) { return dark ? EL_TEXT_DARK[el] : EL_TEXT[el] }
function getElBorder(el: number, dark: boolean) { return dark ? EL_BORDER_DARK[el] : EL_BORDER[el] }

// --- 가이드 모달 ---

function GuideModal({ guide, onClose }: { guide: GuideCategory; onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleToggle = (i: number) => {
    const next = expanded === i ? null : i
    setExpanded(next)
    if (next !== null) {
      setTimeout(() => {
        itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }

  return (
    <div className="guide-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="guide-modal">
        <div className="guide-modal-header">
          <h2 className="guide-modal-title">{guide.title}</h2>
          <button className="guide-modal-close" onClick={onClose} aria-label="닫기">&times;</button>
        </div>
        <p className="guide-modal-desc">{guide.description}</p>
        <div className="guide-list">
          {guide.items.map((item, i) => (
            <div
              key={i}
              ref={el => { itemRefs.current[i] = el }}
              className={`guide-item ${expanded === i ? 'guide-item--open' : ''}`}
            >
              <button
                className="guide-item-header"
                onClick={() => handleToggle(i)}
              >
                <div className="guide-item-left">
                  <span className="guide-item-name">
                    {item.name}
                    {item.hanja && <span className="guide-item-hanja"> {item.hanja}</span>}
                  </span>
                  {(item.yinYang || item.element) && (
                    <span className="guide-item-tags">
                      {item.yinYang && <span className={`guide-tag guide-tag--${item.yinYang === '양' ? 'yang' : 'yin'}`}>{item.yinYang}</span>}
                      {item.element && <span className="guide-tag guide-tag--element">{item.element}</span>}
                    </span>
                  )}
                </div>
                <span className="guide-item-arrow">{expanded === i ? '\u25B2' : '\u25BC'}</span>
              </button>
              <div className="guide-item-summary">{item.summary}</div>
              {expanded === i && (
                <div className="guide-item-detail">{item.detail}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- 프로필 드롭다운 ---

function ProfileDropdown({ profiles, activeProfileId, onLoad, onDelete }: {
  profiles: SavedProfile[]
  activeProfileId: string | null
  onLoad: (p: SavedProfile) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = profiles.find(p => p.id === activeProfileId)
  const activeLabel = active
    ? `${active.form.name.trim() || '의뢰인'} · ${formatBirthText(active.form)}`
    : '저장된 사주 선택'

  return (
    <div className="dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? 'dropdown-trigger--open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="dropdown-trigger-label">{activeLabel}</span>
        <span className="dropdown-trigger-badge">{profiles.length}</span>
        <span className={`dropdown-arrow ${open ? 'dropdown-arrow--open' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          {profiles.map(p => {
            const name = p.form.name.trim() || '의뢰인'
            const birth = formatBirthText(p.form)
            const gender = p.form.gender === 'female' ? '여' : '남'
            const mbti = normalizeMbtiInput(p.form.mbti)
            const year = Number(p.form.year)
            const month = Number(p.form.month)
            const day = Number(p.form.day)
            const hourVal = p.form.hour === '' || p.form.hour === 'unknown' ? null : Number(p.form.hour)
            let preview = ''
            if (year && month && day) {
              const r = calculateSaju(year, month, day, hourVal)
              preview = `${r.dayPillar.stemChar}${r.dayPillar.branchChar}`
            }

            return (
              <div
                key={p.id}
                className={`dropdown-item ${p.id === activeProfileId ? 'dropdown-item--active' : ''}`}
                onClick={() => { onLoad(p); setOpen(false) }}
              >
                {confirmDeleteId === p.id ? (
                  <div className="dropdown-confirm" onClick={e => e.stopPropagation()}>
                    <span className="dropdown-confirm-text">삭제할까요?</span>
                    <button className="dropdown-confirm-yes" onClick={() => { onDelete(p.id); setConfirmDeleteId(null) }}>삭제</button>
                    <button className="dropdown-confirm-no" onClick={() => setConfirmDeleteId(null)}>취소</button>
                  </div>
                ) : (
                  <>
                    <div className="dropdown-item-body">
                      <span className="dropdown-item-name">{name}</span>
                      <span className="dropdown-item-meta">
                        {birth} · {gender}
                        {mbti && <span className="dropdown-item-preview"> · {mbti}</span>}
                        {preview && <span className="dropdown-item-preview"> · {preview}</span>}
                      </span>
                    </div>
                    <button
                      className="dropdown-item-delete"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                      title="삭제"
                      aria-label="삭제"
                    >
                      &times;
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- 사주 테이블 (행 제목 좌측 1회, 4주 값 우측 그리드) ---

function ElCard({ element, char, sub, desc, isDayMaster, dark }: {
  element: number; char: string; sub: string; desc: string; isDayMaster?: boolean; dark: boolean
}) {
  return (
    <div
      className="pillar-card"
      style={{
        background: getElBg(element, dark),
        color: getElText(element, dark),
        border: isDayMaster
          ? `2.5px solid ${dark ? '#d97706' : '#b45309'}`
          : `1.5px solid ${getElBorder(element, dark)}`,
        boxShadow: isDayMaster ? '0 0 0 2px #fbbf2440' : undefined,
      }}
    >
      <span className="pillar-card-main">{char}</span>
      <span className="pillar-card-sub">{sub}</span>
      <span className="pillar-card-desc">{desc}</span>
    </div>
  )
}

function SajuTable({ result, dark }: { result: SajuResult; dark: boolean }) {
  // 시주·일주·월주·년주 순서
  const pillars: (Pillar | null)[] = [result.hourPillar, result.dayPillar, result.monthPillar, result.yearPillar]
  const labels = ['시주', '일주', '월주', '년주']
  const sublabels = ['말년운', '장년운', '청년운', '초년운']
  function renderCell(pillar: Pillar | null, idx: number, render: (p: Pillar) => React.ReactNode) {
    if (!pillar) {
      return idx === 0
        ? <div className="pillar-text-cell" style={{ opacity: 0.4 }}>-</div>
        : null
    }
    return render(pillar)
  }

  const rows: { label: string; render: (p: Pillar, idx: number) => React.ReactNode }[] = [
    {
      label: '천간 십성',
      render: (p) => (
        <div className="pillar-text-cell">
          <span className="cell-value">{p.tenGodStem}</span>
          <span className="cell-desc">{TEN_GOD_DESC[p.tenGodStem] ?? ''}</span>
        </div>
      ),
    },
    {
      label: '천간',
      render: (p, idx) => {
        const el = STEM_ELEMENT[p.stem]
        const pol = p.stem % 2 === 0 ? '양' : '음'
        const sub = `${p.stemKo}, ${pol}${ELEMENTS_KO[el]}`
        return (
          <ElCard
            element={el}
            char={p.stemChar}
            sub={sub}
            desc={STEM_DESC[p.stemKo] ?? ''}
            isDayMaster={idx === 1}
            dark={dark}
          />
        )
      },
    },
    {
      label: '지지',
      render: (p) => {
        const el = BRANCH_ELEMENT[p.branch]
        const pol = p.branch % 2 === 0 ? '양' : '음'
        const sub = `${p.branchKo}, ${pol}${ELEMENTS_KO[el]}`
        return (
          <ElCard
            element={el}
            char={p.branchChar}
            sub={sub}
            desc={BRANCH_DESC[p.branchKo] ?? ''}
            dark={dark}
          />
        )
      },
    },
    {
      label: '지지 십성',
      render: (p) => (
        <div className="pillar-text-cell">
          <span className="cell-value">{p.tenGodBranch}</span>
          <span className="cell-desc">{TEN_GOD_DESC[p.tenGodBranch] ?? ''}</span>
        </div>
      ),
    },
    {
      label: '지장간',
      render: (p) => (
        <div className="pillar-text-cell">
          <span className="cell-value">{p.hiddenStems}</span>
        </div>
      ),
    },
    {
      label: '12운성',
      render: (p) => (
        <div className="pillar-text-cell">
          <span className="cell-value">{p.twelveStage}</span>
          <span className="cell-desc">{TWELVE_STAGE_DESC[p.twelveStage] ?? ''}</span>
        </div>
      ),
    },
    {
      label: '12신살',
      render: (p) => (
        <div className="pillar-text-cell">
          <span className="cell-value">{p.twelveSpirit}</span>
          <span className="cell-desc">{TWELVE_SPIRIT_DESC[p.twelveSpirit] ?? ''}</span>
        </div>
      ),
    },
    {
      label: '공망',
      render: (p) => (
        <div className={`pillar-text-cell ${p.isVoid ? 'pillar-void' : ''}`}>
          <span className="cell-value">{p.isVoid ? '공' : '-'}</span>
          {p.isVoid && <span className="cell-desc">{VOID_DESC.void}</span>}
        </div>
      ),
    },
  ]

  return (
    <div className="saju-grid">
      {/* 헤더 행: 빈칸 + 시주 일주 월주 년주 */}
      <div className="saju-grid-row saju-grid-header">
        <div className="saju-grid-label" />
        {labels.map((l, i) => (
          <div key={l} className={`saju-grid-col-header ${i === 1 ? 'saju-grid-col-header--day' : ''}`}>
            <div className="pillar-label">{l}</div>
            <div className="pillar-sublabel">{sublabels[i]}</div>
          </div>
        ))}
      </div>

      {/* 데이터 행들 */}
      {rows.map(row => (
        <div key={row.label} className="saju-grid-row">
          <div className="saju-grid-label">{row.label}</div>
          {pillars.map((p, i) => (
            <div key={i} className="saju-grid-cell">
              {renderCell(p, i, (pillar) => row.render(pillar, i))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// --- 일주 성격 해설 (60갑자) ---

function getSexagenary(stem: number, branch: number): number {
  // stem(0~9)과 branch(0~11)로 60갑자 번호 복원
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === branch) return i
  }
  return 0
}

function DayMasterSection({ result }: { result: SajuResult }) {
  const sex = getSexagenary(result.dayPillar.stem, result.dayPillar.branch)
  const pillarProfile = DAY_PILLAR_PROFILES[sex]
  // 기존 일간 프로필 폴백
  const stemKo = result.dayPillar.stemKo
  const fallback = DAY_MASTER_PROFILES[stemKo]

  const profile = pillarProfile
  if (!profile && !fallback) return null

  if (profile) {
    return (
      <div className="result-card">
        <h3 className="section-title">일주 성격 해설</h3>
        <div className="day-master-profile">
          <div className="day-master-title">{profile.title}</div>
          <div className="profile-block">
            <span className="profile-block-label">이미지</span>
            <p className="profile-block-text">{profile.image}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">성격</span>
            <p className="profile-block-text">{profile.personality}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">장점</span>
            <p className="profile-block-text">{profile.strengths}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">약점</span>
            <p className="profile-block-text">{profile.weaknesses}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">연애·관계</span>
            <p className="profile-block-text">{profile.relationships}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">적성·직업</span>
            <p className="profile-block-text">{profile.career}</p>
          </div>
          <div className="profile-block">
            <span className="profile-block-label">조언</span>
            <p className="profile-block-text">{profile.advice}</p>
          </div>
        </div>
      </div>
    )
  }

  // 폴백: 기존 10간 기반
  return (
    <div className="result-card">
      <h3 className="section-title">일간 성격 해설</h3>
      <div className="day-master-profile">
        <div className="day-master-title">{fallback!.title}</div>
        <div className="profile-block">
          <span className="profile-block-label">성격</span>
          <p className="profile-block-text">{fallback!.personality}</p>
        </div>
        <div className="profile-block">
          <span className="profile-block-label">장점</span>
          <p className="profile-block-text">{fallback!.strengths}</p>
        </div>
        <div className="profile-block">
          <span className="profile-block-label">약점</span>
          <p className="profile-block-text">{fallback!.weaknesses}</p>
        </div>
        <div className="profile-block">
          <span className="profile-block-label">조언</span>
          <p className="profile-block-text">{fallback!.advice}</p>
        </div>
      </div>
    </div>
  )
}

// --- 조후 & 신강/신약 분석 ---

function JohuSingangSection({ singang, johu }: { singang: SingangResult; johu: JohuResult }) {

  // 신강 게이지 색상
  const gaugeColor = singang.score >= 58 ? '#ef4444'
                   : singang.score >= 42 ? '#eab308'
                   : '#3b82f6'

  // 조후 온도 아이콘
  const tempIcon = johu.season === '여름' ? '\u2600\uFE0F'
                 : johu.season === '겨울' ? '\u2744\uFE0F'
                 : johu.season === '봄' ? '\uD83C\uDF38'
                 : '\uD83C\uDF42'

  return (
    <div className="result-card">
      <h3 className="section-title">조후 & 신강/신약 분석</h3>

      <div className="analysis-block">
        <div className="analysis-label">
          <span className="analysis-icon">{tempIcon}</span>
          조후 (온도·습도)
        </div>
        <div className="analysis-tags">
          <span className="analysis-tag">{johu.season}</span>
          <span className="analysis-tag">{johu.temperature}</span>
          <span className="analysis-tag">{johu.humidity}</span>
          <span className={`analysis-tag ${johu.hasNeeded ? 'analysis-tag--good' : 'analysis-tag--warn'}`}>
            {johu.neededHanja}({johu.neededElement}) {johu.hasNeeded ? `${johu.neededCount}개 있음` : '없음'}
          </span>
        </div>
        <p className="analysis-summary">{johu.summary}</p>
        <p className="analysis-detail">{johu.detail}</p>
      </div>

      <div className="analysis-divider" />

      <div className="analysis-block">
        <div className="analysis-label">
          <span className="analysis-icon">{'\u2699\uFE0F'}</span>
          신강/신약 (엔진 크기)
        </div>
        <div className="singang-gauge-wrap">
          <div className="singang-gauge-bar">
            <div
              className="singang-gauge-fill"
              style={{ width: `${singang.score}%`, background: gaugeColor }}
            />
            <div className="singang-gauge-center" />
          </div>
          <div className="singang-gauge-labels">
            <span>신약</span>
            <span>중화</span>
            <span>신강</span>
          </div>
        </div>
        <div className="singang-result">
          <span className="singang-badge" style={{ background: gaugeColor }}>{singang.label}</span>
          <span className="singang-score">내 편 {singang.score}% : 상대 {100 - singang.score}%</span>
        </div>
        <p className="analysis-summary">{singang.summary}</p>
        <p className="analysis-detail">{singang.detail}</p>
      </div>
    </div>
  )
}

// --- 형충파해 분석 ---

function InteractionsSection({ result }: { result: SajuResult }) {
  const interactions = analyzeInteractions(result)
  if (interactions.length === 0) return (
    <div className="result-card">
      <h3 className="section-title">형충파해 분석</h3>
      <p className="analysis-detail" style={{ textAlign: 'center', padding: 16 }}>
        사주 내 지지간 충돌이 없어요. 안정적인 구조예요!
      </p>
    </div>
  )

  return (
    <div className="result-card">
      <h3 className="section-title">형충파해 분석</h3>
      <div className="interactions-list">
        {interactions.map((it, i) => (
          <div key={i} className={`interaction-item interaction-item--${it.severity}`}>
            <div className="interaction-header">
              <span className={`interaction-badge interaction-badge--${it.severity}`}>{it.typeName}</span>
              <span className="interaction-name">{it.name}</span>
              <span className="interaction-pillars">{it.pillars[0]} — {it.pillars[1]}</span>
            </div>
            <p className="interaction-desc">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- 용신 분석 ---

function YongshinSection({ yongshin: ys }: { yongshin: YongshinResult }) {
  const elBg = EL_BG[ys.yongshin]
  const elText = EL_TEXT[ys.yongshin]
  const elBorder = EL_BORDER[ys.yongshin]

  return (
    <div className="result-card">
      <h3 className="section-title">용신 (유리한 오행)</h3>

      <div className="yongshin-main" style={{ background: elBg, borderColor: elBorder, color: elText }}>
        <div className="yongshin-element">{ELEMENTS_HANJA[ys.yongshin]}</div>
        <div className="yongshin-name">{ys.yongshinName}</div>
      </div>

      <p className="analysis-summary">{ys.summary}</p>
      <p className="analysis-detail">{ys.detail}</p>

      <div className="yongshin-tips">
        <div className="yongshin-tip">
          <span className="yongshin-tip-label">유리한 색상</span>
          <span className="yongshin-tip-value">{ys.colors}</span>
        </div>
        <div className="yongshin-tip">
          <span className="yongshin-tip-label">유리한 방위</span>
          <span className="yongshin-tip-value">{ys.direction}</span>
        </div>
        <div className="yongshin-tip">
          <span className="yongshin-tip-label">유리한 계절</span>
          <span className="yongshin-tip-value">{ys.season}</span>
        </div>
        <div className="yongshin-tip">
          <span className="yongshin-tip-label">추천 업종</span>
          <span className="yongshin-tip-value">{ys.careers.join(', ')}</span>
        </div>
        <div className="yongshin-tip">
          <span className="yongshin-tip-label">피해야 할 오행</span>
          <span className="yongshin-tip-value">{ys.gishinName}</span>
        </div>
      </div>
    </div>
  )
}

// --- 공망 상세 해석 ---

function VoidSection({ result }: { result: SajuResult }) {
  const va = analyzeVoid(result)

  return (
    <div className="result-card">
      <h3 className="section-title">공망 (空亡) 분석</h3>
      <div className="void-header">
        <span className="void-label">공망 지지:</span>
        <span className="void-chars">{va.voidHanja[0]}({va.voidBranches[0]}) · {va.voidHanja[1]}({va.voidBranches[1]})</span>
      </div>
      {va.affectedPillars.length > 0 ? (
        <div className="void-affected">
          {va.affectedPillars.map((ap, i) => (
            <div key={i} className="void-item">
              <span className="void-item-badge">{ap.pillar} 공망</span>
              <p className="void-item-desc">{ap.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="analysis-detail" style={{ textAlign: 'center', padding: 12 }}>
          원국에 공망이 걸린 기둥이 없어요!
        </p>
      )}
      <p className="analysis-summary" style={{ marginTop: 8 }}>{va.summary}</p>
    </div>
  )
}

// --- 사주 요약 카드 ---

function SajuSummaryCard({ result, name, dark, singang, johu, yongshin: ys }: { result: SajuResult; name: string; dark: boolean; singang: SingangResult; johu: JohuResult; yongshin: YongshinResult }) {
  const interactions = analyzeInteractions(result)
  const sex = getSexagenary(result.dayPillar.stem, result.dayPillar.branch)
  const pillarProfile = DAY_PILLAR_PROFILES[sex]

  const dayStemEl = STEM_ELEMENT[result.dayPillar.stem]
  const elBg = dark ? EL_BG_DARK[dayStemEl] : EL_BG[dayStemEl]
  const elText = dark ? EL_TEXT_DARK[dayStemEl] : EL_TEXT[dayStemEl]
  const elBorder = dark ? EL_BORDER_DARK[dayStemEl] : EL_BORDER[dayStemEl]

  const chungCount = interactions.filter(i => i.type === '충').length
  const hapCount = interactions.filter(i => i.type !== '충' && i.type !== '형').length

  return (
    <div className="summary-card" style={{ borderColor: elBorder, background: elBg }}>
      <div className="summary-top">
        <div className="summary-ilju" style={{ color: elText }}>
          <span className="summary-ilju-chars">{result.dayPillar.stemChar}{result.dayPillar.branchChar}</span>
          <span className="summary-ilju-ko">{result.dayPillar.stemKo}{result.dayPillar.branchKo}일주</span>
        </div>
        <div className="summary-name" style={{ color: elText }}>{name}</div>
      </div>
      {pillarProfile && (
        <p className="summary-title" style={{ color: elText }}>{pillarProfile.title.split('—')[1]?.trim() || ''}</p>
      )}
      <div className="summary-tags">
        <span className="summary-tag">{singang.label}</span>
        <span className="summary-tag">{johu.season} · {johu.temperature}</span>
        <span className="summary-tag">용신: {ELEMENTS_HANJA[ys.yongshin]}({ELEMENTS_KO[ys.yongshin]})</span>
        {chungCount > 0 && <span className="summary-tag summary-tag--warn">충 {chungCount}개</span>}
        {hapCount > 0 && <span className="summary-tag summary-tag--good">합 {hapCount}개</span>}
      </div>
    </div>
  )
}

// --- 오행 차트 (recharts Radar) ---

function ElementChart({ result, dark }: { result: SajuResult; dark: boolean }) {
  const analysis = analyzeElements(result)
  const maxCount = Math.max(...analysis.map(a => a.count), 1)

  const radarData = analysis.map(a => ({
    subject: `${a.hanja} ${a.name}`,
    value: a.count,
  }))

  return (
    <div className="element-chart">
      <h3 className="section-title">오행 분석</h3>

      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={dark ? '#404040' : '#e7e5e4'} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: dark ? '#a3a3a3' : '#78716c', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, Math.max(maxCount, 2)]}
            tick={{ fill: dark ? '#737373' : '#a8a29e', fontSize: 10 }}
          />
          <Radar
            name="오행"
            dataKey="value"
            stroke="#d97706"
            fill="#d97706"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="element-bars">
        {analysis.map((a) => (
          <div key={a.element} className="element-bar-row">
            <span className="element-label" style={{ color: dark ? EL_TEXT_DARK[a.element] : EL_TEXT[a.element] }}>
              {a.hanja} {a.name}
            </span>
            <div className="element-bar-track">
              <div
                className="element-bar-fill"
                style={{
                  width: `${(a.count / maxCount) * 100}%`,
                  background: EL_BAR[a.element],
                }}
              />
            </div>
            <span className="element-count">{a.count}</span>
          </div>
        ))}
      </div>
      {(() => {
        const missing = analysis.filter(a => a.count === 0)
        if (missing.length === 0) return null
        return (
          <p className="element-note">
            부족한 오행: {missing.map(m => `${m.hanja}(${m.name})`).join(', ')}
          </p>
        )
      })()}
    </div>
  )
}

// --- 대운 ---

function DaeunSection({ result, form, yongshin: ys }: { result: SajuResult; form: FormState; yongshin: YongshinResult }) {
  const birthYear = Number(form.year)
  const birthMonth = Number(form.month)
  const birthDay = Number(form.day)
  const currentAge = new Date().getFullYear() - birthYear

  const periods = calculateDaeun(
    result.monthPillar.stem,
    result.monthPillar.branch,
    form.gender,
    result.yearPillar.stem,
    birthYear, birthMonth, birthDay,
    result.dayPillar.stem,
  )

  const periodAnalyses = periods.map(p =>
    analyzePeriodInteraction(p.stem, p.branch, result, ys.yongshin, ys.gishin)
  )

  const activeIdx = periods.findIndex(p => currentAge >= p.startAge && currentAge <= p.endAge)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(activeIdx >= 0 ? activeIdx : null)

  const ratingColors: Record<string, string> = {
    great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626',
  }
  const ratingLabels: Record<string, string> = {
    great: '매우 좋음', good: '좋음', neutral: '보통', caution: '주의', warning: '경계',
  }

  return (
    <div className="result-card">
      <h3 className="section-title">대운 (10년 주기)</h3>
      <div className="daeun-scroll">
        {periods.map((p, i) => {
          const isActive = currentAge >= p.startAge && currentAge <= p.endAge
          const analysis = periodAnalyses[i]
          return (
            <div
              key={i}
              className={`daeun-card ${isActive ? 'daeun-card--active' : ''}`}
              style={{ borderTopColor: ratingColors[analysis.rating], borderTopWidth: 3, borderTopStyle: 'solid', cursor: 'pointer' }}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <span className="daeun-age">{p.startAge}~{p.endAge}세</span>
              <span className="daeun-chars">{p.stemChar}{p.branchChar}</span>
              <span className="daeun-ko">{p.stemKo}{p.branchKo}</span>
              <span className="daeun-info">{p.tenGod} · {p.twelveStage}</span>
              <span className="daeun-rating" style={{ color: ratingColors[analysis.rating] }}>
                {ratingLabels[analysis.rating]}
              </span>
            </div>
          )
        })}
      </div>
      {expandedIdx !== null && (
        <div className="daeun-detail">
          <div className="daeun-detail-header">
            <strong>{periods[expandedIdx].stemChar}{periods[expandedIdx].branchChar} 대운</strong>
            <span>({periods[expandedIdx].startAge}~{periods[expandedIdx].endAge}세)</span>
            <span className="daeun-detail-rating" style={{ color: ratingColors[periodAnalyses[expandedIdx].rating] }}>
              {ratingLabels[periodAnalyses[expandedIdx].rating]}
            </span>
          </div>
          {periodAnalyses[expandedIdx].interactions.length > 0 && (
            <div className="daeun-interactions">
              {periodAnalyses[expandedIdx].interactions.map((it, j) => (
                <span key={j} className={`daeun-int-tag daeun-int-tag--${it.type === '충' ? 'chung' : it.type === '형' ? 'hyung' : 'hap'}`}>
                  {it.type === '합' ? '\u{1F91D}' : it.type === '충' ? '\u{26A1}' : '\u{26A0}\uFE0F'} {it.name} ({it.pillar})
                </span>
              ))}
            </div>
          )}
          {periodAnalyses[expandedIdx].bringsYongshin && (
            <span className="daeun-ys-tag daeun-ys-tag--good">용신 {ELEMENTS_HANJA[ys.yongshin]} 유입</span>
          )}
          {periodAnalyses[expandedIdx].bringsGishin && (
            <span className="daeun-ys-tag daeun-ys-tag--bad">기신 {ELEMENTS_HANJA[ys.gishin]} 유입</span>
          )}
          <p className="daeun-narrative">{periodAnalyses[expandedIdx].narrative}</p>
        </div>
      )}
    </div>
  )
}

// --- 세운 ---

function SeunSection({ result, yongshin: ys }: { result: SajuResult; yongshin: YongshinResult }) {
  const currentYear = new Date().getFullYear()
  const seun = calculateSeun(currentYear, result.dayPillar.stem, result.yearPillar.branch)
  const seunAnalysis = analyzePeriodInteraction(seun.stem, seun.branch, result, ys.yongshin, ys.gishin)

  const ratingColors: Record<string, string> = {
    great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626',
  }
  const ratingLabels: Record<string, string> = {
    great: '매우 좋음', good: '좋음', neutral: '보통', caution: '주의', warning: '경계',
  }

  return (
    <div className="result-card">
      <h3 className="section-title">{currentYear}년 세운</h3>
      <div className="seun-box">
        <div className="seun-header">
          <span className="seun-chars">{seun.stemChar}{seun.branchChar}</span>
          <div className="seun-meta">
            <span className="seun-year">{seun.stemKo}{seun.branchKo}년</span>
            <div className="seun-tags">
              <span className="seun-tag">{seun.tenGodStem}</span>
              <span className="seun-tag">{seun.tenGodBranch}</span>
              <span className="seun-tag">{seun.twelveStage}</span>
              <span className="seun-tag">{seun.twelveSpirit}</span>
              <span className="seun-tag" style={{ color: ratingColors[seunAnalysis.rating], fontWeight: 700 }}>
                {ratingLabels[seunAnalysis.rating]}
              </span>
            </div>
          </div>
        </div>
        <p className="seun-summary">{seun.summary}</p>

        {seunAnalysis.interactions.length > 0 && (
          <div className="daeun-interactions" style={{ marginTop: 10 }}>
            {seunAnalysis.interactions.map((it, j) => (
              <span key={j} className={`daeun-int-tag daeun-int-tag--${it.type === '충' ? 'chung' : it.type === '형' ? 'hyung' : 'hap'}`}>
                {it.type === '합' ? '\u{1F91D}' : it.type === '충' ? '\u{26A1}' : '\u{26A0}\uFE0F'} {it.name} ({it.pillar})
              </span>
            ))}
          </div>
        )}
        <p className="daeun-narrative" style={{ marginTop: 8 }}>{seunAnalysis.narrative}</p>
      </div>
    </div>
  )
}

// --- 월운 ---

function MonthlyFortuneSection({ result, yongshin: ys }: { result: SajuResult; yongshin: YongshinResult }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const fortunes = calculateMonthlyFortunes(currentYear, result.dayPillar.stem)

  const monthAnalyses = fortunes.map(f =>
    analyzePeriodInteraction(f.stem, f.branch, result, ys.yongshin, ys.gishin)
  )

  const ratingColors: Record<string, string> = {
    great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626',
  }
  const ratingDots: Record<string, string> = {
    great: '\u{1F7E2}', good: '\u{1F535}', neutral: '\u26AA', caution: '\u{1F7E1}', warning: '\u{1F534}',
  }

  const [expandedMonth, setExpandedMonth] = useState<number | null>(currentMonth - 1)

  return (
    <div className="result-card">
      <h3 className="section-title">{currentYear}년 월운</h3>
      <div className="monthly-grid">
        {fortunes.map((f, i) => {
          const analysis = monthAnalyses[i]
          const isCurrent = f.month === currentMonth
          const isExpanded = expandedMonth === i
          return (
            <div key={i}>
              <div
                className={`monthly-card ${isCurrent ? 'monthly-card--current' : ''} ${isExpanded ? 'monthly-card--expanded' : ''}`}
                onClick={() => setExpandedMonth(isExpanded ? null : i)}
                style={{ borderLeftColor: ratingColors[analysis.rating], borderLeftWidth: 3, borderLeftStyle: 'solid' }}
              >
                <div className="monthly-month">{f.month}월</div>
                <div className="monthly-chars">{f.stemChar}{f.branchChar}</div>
                <div className="monthly-info">{f.tenGod} · {f.twelveStage}</div>
                <div className="monthly-rating">{ratingDots[analysis.rating]}</div>
              </div>
              {isExpanded && (
                <div className="monthly-detail">
                  <div className="monthly-detail-header">
                    <strong>{f.month}월</strong> {f.stemKo}{f.branchKo} ({f.elementHanja}{f.elementName})
                  </div>
                  {analysis.interactions.length > 0 && (
                    <div className="daeun-interactions">
                      {analysis.interactions.map((it, j) => (
                        <span key={j} className={`daeun-int-tag daeun-int-tag--${it.type === '충' ? 'chung' : it.type === '형' ? 'hyung' : 'hap'}`}>
                          {it.type === '합' ? '\u{1F91D}' : it.type === '충' ? '\u{26A1}' : '\u{26A0}\uFE0F'} {it.name} ({it.pillar})
                        </span>
                      ))}
                    </div>
                  )}
                  {analysis.bringsYongshin && (
                    <span className="daeun-ys-tag daeun-ys-tag--good">용신 {ELEMENTS_HANJA[ys.yongshin]} 유입</span>
                  )}
                  {analysis.bringsGishin && (
                    <span className="daeun-ys-tag daeun-ys-tag--bad">기신 {ELEMENTS_HANJA[ys.gishin]} 유입</span>
                  )}
                  <p className="daeun-narrative">{analysis.narrative}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- 궁합 ---

function GunghapSection({ profiles, currentForm, currentResult }: {
  profiles: SavedProfile[]
  currentForm: FormState
  currentResult: SajuResult
}) {
  const [targetId, setTargetId] = useState<string>('')
  const [compResult, setCompResult] = useState<CompatibilityResult | null>(null)

  const otherProfiles = profiles.filter(p =>
    !(p.form.name === currentForm.name &&
      p.form.year === currentForm.year &&
      p.form.month === currentForm.month &&
      p.form.day === currentForm.day &&
      p.form.hour === currentForm.hour &&
      p.form.gender === currentForm.gender)
  )

  useEffect(() => {
    if (!targetId) { setCompResult(null); return }
    const target = profiles.find(p => p.id === targetId)
    if (!target) return

    const y = Number(target.form.year)
    const m = Number(target.form.month)
    const d = Number(target.form.day)
    const h = target.form.hour === '' || target.form.hour === 'unknown' ? null : Number(target.form.hour)
    if (!y || !m || !d) return

    const targetResult = calculateSaju(y, m, d, h)
    setCompResult(analyzeCompatibility(currentResult, targetResult))
  }, [targetId, profiles, currentResult])

  const currentName = currentForm.name.trim() || '의뢰인'

  return (
    <div className="result-card">
      <h3 className="section-title">궁합 비교</h3>

      {otherProfiles.length === 0 ? (
        <p className="loading-text">비교할 저장된 프로필이 없습니다. 먼저 다른 사주를 저장해주세요.</p>
      ) : (
        <>
          <div className="gunghap-select">
            <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{currentName}</div>
            <span className="gunghap-vs">VS</span>
            <select
              className="gunghap-person-select"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
            >
              <option value="">상대 선택</option>
              {otherProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.form.name.trim() || '의뢰인'} ({formatBirthText(p.form)})
                </option>
              ))}
            </select>
          </div>

          {compResult && (
            <div className="gunghap-detail">
              <div className="gunghap-score">
                <div className="gunghap-score-number">{compResult.score}</div>
                <div className="gunghap-score-label">궁합 점수</div>
              </div>

              <div className="gunghap-relation">
                <div className="gunghap-rel-box">
                  <div className="gunghap-rel-label">{currentName} → 상대</div>
                  <div className="gunghap-rel-value">{compResult.relation1to2}</div>
                </div>
                <div className="gunghap-rel-box">
                  <div className="gunghap-rel-label">상대 → {currentName}</div>
                  <div className="gunghap-rel-value">{compResult.relation2to1}</div>
                </div>
              </div>

              <table className="gunghap-element-table">
                <thead>
                  <tr>
                    <th>오행</th>
                    <th>{currentName}</th>
                    <th>상대</th>
                    <th>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {compResult.elementBalance.map(e => (
                    <tr key={e.element}>
                      <td style={{ fontWeight: 600 }}>{e.hanja} {e.name}</td>
                      <td>{e.countA}</td>
                      <td>{e.countB}</td>
                      <td style={{ fontWeight: 600 }}>{e.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {compResult.haps.length > 0 && (
                <div className="gunghap-haps">
                  <h4 className="gunghap-haps-title">합(合) 분석</h4>
                  {compResult.haps.map((hap, i) => (
                    <div key={i} className={`gunghap-hap-item gunghap-hap-item--${hap.rating}`}>
                      <div className="gunghap-hap-header">
                        <span className={`gunghap-hap-badge gunghap-hap-badge--${hap.rating}`}>
                          {hap.type}
                        </span>
                        <span className="gunghap-hap-name">{hap.name}</span>
                      </div>
                      <p className="gunghap-hap-desc">{hap.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="gunghap-summary">{compResult.summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- 결과 섹션 ---

function ResultSection({ result, name, birthText, genderText, form, profiles, onSave, onMbtiChange, saveLabel, alreadySaved, isSaving, dark }: {
  result: SajuResult
  name: string
  birthText: string
  genderText: string
  form: FormState
  profiles: SavedProfile[]
  onSave: () => void
  onMbtiChange: (value: string) => void
  saveLabel: string
  alreadySaved: boolean
  isSaving: boolean
  dark: boolean
}) {
  const resultRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  // 공통 분석 결과를 1번만 계산
  const cachedSingang = React.useMemo(() => analyzeSingang(result), [result])
  const cachedJohu = React.useMemo(() => analyzeJohu(result), [result])
  const cachedYongshin = React.useMemo(() => determineYongshin(result, cachedSingang, cachedJohu), [result, cachedSingang, cachedJohu])

  const dayStemEl = STEM_ELEMENT[result.dayPillar.stem]
  const dayPolarity = result.dayPillar.stem % 2 === 0 ? '양' : '음'
  const dayMasterDesc = `${ELEMENTS_HANJA[dayStemEl]}(${ELEMENTS_KO[dayStemEl]}) - ${dayPolarity}${ELEMENTS_KO[dayStemEl]}`

  const handleExport = async () => {
    const target = resultRef.current
    if (!target || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: dark ? '#1a1a1a' : '#faf9f7',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `사주_${name}_${form.year}${form.month}${form.day}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('이미지 저장 실패:', err)
      alert('이미지 저장에 실패했습니다. 다시 시도해주세요.')
    }
    setExporting(false)
  }

  // 탭: 기본 | 궁합
  const [tab, setTab] = useState<'basic' | 'gunghap'>('basic')

  return (
    <div className="result-section" ref={resultRef}>
      <div ref={exportRef}>
        <SajuSummaryCard result={result} name={name} dark={dark} singang={cachedSingang} johu={cachedJohu} yongshin={cachedYongshin} />

        <div className="result-card">
          <div className="result-header">
            <h2 className="section-title" style={{ margin: 0 }}>사주원국</h2>
            <div className="result-header-actions">
              <button
                className="export-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? '저장 중...' : '이미지 저장'}
              </button>
              <button
                className={`save-btn ${alreadySaved ? 'save-btn--saved' : ''}`}
                onClick={onSave}
                disabled={alreadySaved || isSaving}
              >
                {saveLabel}
              </button>
            </div>
          </div>

          <div className="result-info">
            <span>{name}</span>
            <span className="info-sep">|</span>
            <span>{birthText}</span>
            <span className="info-sep">|</span>
            <span>{genderText}</span>
            {form.mbti && (
              <>
                <span className="info-sep">|</span>
                <span>MBTI {form.mbti}</span>
              </>
            )}
          </div>

          <div className="result-mbti-row">
            <label className="label result-mbti-label" htmlFor="result-mbti">MBTI</label>
            <input
              id="result-mbti"
              className="result-mbti-input"
              type="text"
              inputMode="text"
              placeholder="예: INFP"
              maxLength={4}
              value={form.mbti}
              onChange={e => onMbtiChange(e.target.value)}
            />
            <span className="result-mbti-help">영문 4자리까지 저장됩니다.</span>
          </div>

          <div className="day-master-badge">
            일간(日干): <strong>{result.dayPillar.stemChar} {result.dayPillar.stemKo}</strong> — {dayMasterDesc}
          </div>

          <SajuTable result={result} dark={dark} />

          <p className="disclaimer">
            절기 경계는 근사치(양력 기준)를 사용합니다. 정밀한 사주 분석은 전문가 상담을 권장합니다.
          </p>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'basic' ? 'tab-btn--active' : ''}`} onClick={() => setTab('basic')}>
          상세 분석
        </button>
        <button className={`tab-btn ${tab === 'gunghap' ? 'tab-btn--active' : ''}`} onClick={() => setTab('gunghap')}>
          궁합 비교
        </button>
      </div>

      {tab === 'basic' && (
        <>
          <DayMasterSection result={result} />
          <JohuSingangSection singang={cachedSingang} johu={cachedJohu} />
          <YongshinSection yongshin={cachedYongshin} />
          <InteractionsSection result={result} />
          <VoidSection result={result} />

          <div className="result-card">
            <ElementChart result={result} dark={dark} />
          </div>

          <DaeunSection result={result} form={form} yongshin={cachedYongshin} />
          <SeunSection result={result} yongshin={cachedYongshin} />
          <MonthlyFortuneSection result={result} yongshin={cachedYongshin} />
        </>
      )}

      {tab === 'gunghap' && (
        <GunghapSection
          profiles={profiles}
          currentForm={form}
          currentResult={result}
        />
      )}
    </div>
  )
}

// --- 메인 앱 ---

type View = 'form' | 'loading' | 'result'

// --- 로그인 폼 (홈화면 인라인) ---

function LoginForm({ onAuth, onSignupClick }: { onAuth: (user: AuthUser) => void; onSignupClick: () => void }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !pw.trim()) { setAuthError('아이디와 비밀번호를 입력하세요.'); return }

    const email = id.includes('@') ? id.trim() : `${id.trim()}@saju.app`
    setAuthLoading(true)
    setAuthError(null)

    const { user, error } = await signIn(email, pw)
    if (error) { setAuthError('아이디 또는 비밀번호가 틀렸습니다.'); setAuthLoading(false); return }
    onAuth(user)
    setAuthLoading(false)
  }

  return (
    <div className="auth-modal auth-modal--inline">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="label" htmlFor="login-id">아이디</label>
          <input id="login-id" type="text" placeholder="아이디 입력" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="login-pw">비밀번호</label>
          <input id="login-pw" type="password" placeholder="비밀번호 입력" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        </div>
        {authError && <p className="auth-error">{authError}</p>}
        <button className="auth-submit" type="submit" disabled={authLoading}>
          {authLoading ? '로그인 중...' : '로그인'}
        </button>
        <button type="button" className="auth-switch" onClick={onSignupClick}>
          계정이 없으신가요? <strong>회원가입</strong>
        </button>
      </form>
    </div>
  )
}

// --- 회원가입 모달 ---

function SignupModal({ onClose, signingUpRef }: { onClose: (success: boolean) => void; signingUpRef: React.MutableRefObject<boolean> }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !pw.trim()) { setAuthError('아이디와 비밀번호를 입력하세요.'); return }
    if (pw.length < 6) { setAuthError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (pw !== pwConfirm) { setAuthError('비밀번호가 일치하지 않습니다.'); return }

    const email = id.includes('@') ? id.trim() : `${id.trim()}@saju.app`
    setAuthLoading(true)
    setAuthError(null)

    signingUpRef.current = true
    const { error } = await signUp(email, pw)
    if (error) { setAuthError(error); setAuthLoading(false); signingUpRef.current = false; return }

    // 가입 후 바로 로그아웃 (자동 로그인 방지)
    await signOut()
    signingUpRef.current = false
    setAuthLoading(false)
    onClose(true)
  }

  return (
    <div className="guide-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(false) }}>
      <div className="auth-modal">
        <div className="guide-modal-header">
          <h2 className="guide-modal-title">회원가입</h2>
          <button className="guide-modal-close" onClick={() => onClose(false)} aria-label="닫기">&times;</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="label" htmlFor="signup-id">아이디</label>
            <input id="signup-id" type="text" placeholder="사용할 아이디" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="signup-pw">비밀번호</label>
            <input id="signup-pw" type="password" placeholder="6자 이상" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="signup-pw2">비밀번호 확인</label>
            <input id="signup-pw2" type="password" placeholder="비밀번호 다시 입력" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {authError && <p className="auth-error">{authError}</p>}
          <button className="auth-submit" type="submit" disabled={authLoading}>
            {authLoading ? '가입 중...' : '가입하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [guideOpen, setGuideOpen] = useState<GuideCategory | null>(null)

  // Auth
  const [user, setUser] = useState<AuthUser>(null)
  const signingUp = useRef(false) // 회원가입 중 자동로그인 방지 플래그

  useEffect(() => {
    getUser().then(u => {
      if (!signingUp.current) setUser(u)
    })
    const sub = onAuthChange(u => {
      if (!signingUp.current) setUser(u)
    })
    return () => sub.unsubscribe()
  }, [])

  // 프로필: 유저 변경 시 다시 로드
  useEffect(() => {
    setLoading(true)
    fetchProfiles()
      .then(data => setProfiles(data))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false))
  }, [user])

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
    setTimeout(() => {
      setResult(sajuResult)
      setView('result')
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
  const birthText = `${form.year}년 ${form.month}월 ${form.day}일${
    getHourLabel(form.hour)
      ? ` ${getHourLabel(form.hour)}`
      : ''
  }`
  const genderText = form.gender === 'female' ? '여성' : '남성'

  const [signupOpen, setSignupOpen] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    setSignupSuccess(false)
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
        <button className="guide-btn" onClick={() => setGuideOpen(CHEONGAN_GUIDE)}>천간</button>
        <button className="guide-btn" onClick={() => setGuideOpen(JIJI_GUIDE)}>지지</button>
        <button className="guide-btn" onClick={() => setGuideOpen(SIPSUNG_GUIDE)}>십성</button>
        <button className="guide-btn" onClick={() => setGuideOpen(TWELVE_STAGE_GUIDE)}>12운성</button>
        <button className="guide-btn" onClick={() => setGuideOpen(TWELVE_SPIRIT_GUIDE)}>12신살</button>
        <button className="guide-btn" onClick={() => setGuideOpen(JOHU_GUIDE)}>조후</button>
        <button className="guide-btn" onClick={() => setGuideOpen(SINGANG_GUIDE)}>신강/신약</button>
        <button className="guide-btn" onClick={() => setGuideOpen(HYUNGCHUNG_GUIDE)}>형충파해</button>
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
