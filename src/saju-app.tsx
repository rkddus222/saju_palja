import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  calculateSaju,
  analyzeElements,
  calculateDaeun,
  calculateSeun,
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
} from './saju-calc'
import {
  fetchProfiles,
  addProfile,
  deleteProfile,
  type SavedProfile,
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

// --- 프로필 드롭다운 ---

function ProfileDropdown({ profiles, activeProfileId, onLoad, onDelete }: {
  profiles: SavedProfile[]
  activeProfileId: string | null
  onLoad: (p: SavedProfile) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
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
                <div className="dropdown-item-body">
                  <span className="dropdown-item-name">{name}</span>
                  <span className="dropdown-item-meta">
                    {birth} · {gender}
                    {preview && <span className="dropdown-item-preview"> · {preview}</span>}
                  </span>
                </div>
                <button
                  className="dropdown-item-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
                  title="삭제"
                  aria-label="삭제"
                >
                  &times;
                </button>
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

// --- 일간 성격 해설 ---

function DayMasterSection({ result }: { result: SajuResult }) {
  const stemKo = result.dayPillar.stemKo
  const profile = DAY_MASTER_PROFILES[stemKo]
  if (!profile) return null

  return (
    <div className="result-card">
      <h3 className="section-title">일간 성격 해설</h3>
      <div className="day-master-profile">
        <div className="day-master-title">{profile.title}</div>
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
          <span className="profile-block-label">조언</span>
          <p className="profile-block-text">{profile.advice}</p>
        </div>
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

function DaeunSection({ result, form }: { result: SajuResult; form: FormState }) {
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

  return (
    <div className="result-card">
      <h3 className="section-title">대운 (10년 주기)</h3>
      <div className="daeun-scroll">
        {periods.map((p, i) => {
          const isActive = currentAge >= p.startAge && currentAge <= p.endAge
          return (
            <div key={i} className={`daeun-card ${isActive ? 'daeun-card--active' : ''}`}>
              <span className="daeun-age">{p.startAge}~{p.endAge}세</span>
              <span className="daeun-chars">{p.stemChar}{p.branchChar}</span>
              <span className="daeun-ko">{p.stemKo}{p.branchKo}</span>
              <span className="daeun-info">{p.tenGod} · {p.twelveStage}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- 세운 ---

function SeunSection({ result }: { result: SajuResult }) {
  const currentYear = new Date().getFullYear()
  const seun = calculateSeun(currentYear, result.dayPillar.stem, result.yearPillar.branch)

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
            </div>
          </div>
        </div>
        <p className="seun-summary">{seun.summary}</p>
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

              <p className="gunghap-summary">{compResult.summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- 결과 섹션 ---

function ResultSection({ result, name, birthText, genderText, form, profiles, onSave, alreadySaved, isSaving, dark }: {
  result: SajuResult
  name: string
  birthText: string
  genderText: string
  form: FormState
  profiles: SavedProfile[]
  onSave: () => void
  alreadySaved: boolean
  isSaving: boolean
  dark: boolean
}) {
  const resultRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const dayStemEl = STEM_ELEMENT[result.dayPillar.stem]
  const dayPolarity = result.dayPillar.stem % 2 === 0 ? '양' : '음'
  const dayMasterDesc = `${ELEMENTS_HANJA[dayStemEl]}(${ELEMENTS_KO[dayStemEl]}) - ${dayPolarity}${ELEMENTS_KO[dayStemEl]}`

  const handleExport = async () => {
    if (!resultRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(resultRef.current, {
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
    }
    setExporting(false)
  }

  // 탭: 기본 | 궁합
  const [tab, setTab] = useState<'basic' | 'gunghap'>('basic')

  return (
    <div className="result-section" ref={resultRef}>
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
              {isSaving ? '저장 중...' : alreadySaved ? '저장됨' : '저장하기'}
            </button>
          </div>
        </div>

        <div className="result-info">
          <span>{name}</span>
          <span className="info-sep">|</span>
          <span>{birthText}</span>
          <span className="info-sep">|</span>
          <span>{genderText}</span>
        </div>

        <div className="day-master-badge">
          일간(日干): <strong>{result.dayPillar.stemChar} {result.dayPillar.stemKo}</strong> — {dayMasterDesc}
        </div>

        <SajuTable result={result} dark={dark} />

        <p className="disclaimer">
          절기 경계는 근사치(양력 기준)를 사용합니다. 정밀한 사주 분석은 전문가 상담을 권장합니다.
        </p>
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

          <div className="result-card">
            <ElementChart result={result} dark={dark} />
          </div>

          <DaeunSection result={result} form={form} />
          <SeunSection result={result} />
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

type View = 'form' | 'result'

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
  })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SajuResult | null>(null)

  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfiles().then(data => {
      setProfiles(data)
      setLoading(false)
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
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
    const hourVal = form.hour === '' || form.hour === 'unknown' ? null : Number(form.hour)
    setResult(calculateSaju(year, month, day, hourVal))
    setView('result')
  }

  const handleSave = useCallback(async () => {
    const exists = profiles.some(p =>
      p.form.name === form.name &&
      p.form.year === form.year &&
      p.form.month === form.month &&
      p.form.day === form.day &&
      p.form.hour === form.hour &&
      p.form.gender === form.gender
    )
    if (exists || saving) return

    setSaving(true)
    const saved = await addProfile(form)
    setSaving(false)

    if (saved) {
      setProfiles(prev => [saved, ...prev])
      setActiveProfileId(saved.id)
    }
  }, [form, profiles, saving])

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
    }
  }, [activeProfileId])

  const handleNewSaju = useCallback(() => {
    setForm({ name: '', year: '', month: '', day: '', hour: '', gender: 'male' })
    setResult(null)
    setActiveProfileId(null)
    setError(null)
    setView('form')
  }, [])

  const alreadySaved = profiles.some(p =>
    p.form.name === form.name &&
    p.form.year === form.year &&
    p.form.month === form.month &&
    p.form.day === form.day &&
    p.form.hour === form.hour &&
    p.form.gender === form.gender
  )

  const displayName = form.name.trim() || '의뢰인'
  const birthText = `${form.year}년 ${form.month}월 ${form.day}일${
    getHourLabel(form.hour)
      ? ` ${getHourLabel(form.hour)}`
      : ''
  }`
  const genderText = form.gender === 'female' ? '여성' : '남성'

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">사주팔자</h1>
        <p className="app-subtitle">
          생년월일시를 입력하여 사주원국을 확인하세요
        </p>
        <button className="theme-toggle" onClick={toggleTheme} title={dark ? '라이트 모드' : '다크 모드'}>
          {dark ? '\u2600' : '\u263E'}
        </button>
      </header>

      <main className="main-content">
        {/* 상단 바: 드롭다운 + 새 사주 버튼 */}
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
