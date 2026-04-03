import { useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeCompatibility,
  analyzeElements,
  analyzeInteractions,
  analyzeJohu,
  analyzeSingang,
  analyzeVoid,
  analyzePeriodInteraction,
  calculateDaeun,
  calculateMonthlyFortunes,
  calculateSeun,
  calculateSaju,
  determineYongshin,
  BRANCH_DESC,
  BRANCH_ELEMENT,
  ELEMENTS_HANJA,
  ELEMENTS_KO,
  STEM_DESC,
  STEM_ELEMENT,
  TEN_GOD_DESC,
  TWELVE_SPIRIT_DESC,
  TWELVE_STAGE_DESC,
  VOID_DESC,
  type CompatibilityResult,
  type Pillar,
  type SajuResult,
  type YongshinResult,
} from '../../saju-calc'
import { getElBg, getElBorder, getElText } from '../../element-theme'
import type { SavedProfile } from '../../profile-store'
import { formatBirthText } from '../../saju-format'
import type { FormState } from '../../saju-types'
import { generateWithVertex } from '../../vertex-client'
import {
  buildSajuInterpretationPrompt,
  SAJU_INTERPRETATION_SYSTEM_INSTRUCTION,
} from '../../vertex-saju'
import {
  DayMasterSection,
  ElementChart,
  InteractionsSection,
  JohuSingangSection,
  SajuSummaryCard,
  VoidSection,
  YongshinSection,
} from './overview-sections'

function ElCard({ element, char, sub, desc, isDayMaster, dark }: {
  element: number
  char: string
  sub: string
  desc: string
  isDayMaster?: boolean
  dark: boolean
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
  const pillars: (Pillar | null)[] = [result.hourPillar, result.dayPillar, result.monthPillar, result.yearPillar]
  const labels = ['시주', '일주', '월주', '년주']
  const sublabels = ['말년운', '장년운', '청년운', '초년운']

  function renderCell(pillar: Pillar | null, idx: number, render: (p: Pillar) => React.ReactNode) {
    if (!pillar) {
      return idx === 0
        ? <div className="pillar-text-cell" style={{ opacity: 0.6 }}>미상</div>
        : null
    }
    return render(pillar)
  }

  const rows: { label: string; render: (p: Pillar, idx: number) => React.ReactNode }[] = [
    { label: '천간 십성', render: p => <div className="pillar-text-cell"><span className="cell-value">{p.tenGodStem}</span><span className="cell-desc">{TEN_GOD_DESC[p.tenGodStem] ?? ''}</span></div> },
    {
      label: '천간',
      render: (p, idx) => {
        const el = STEM_ELEMENT[p.stem]
        const pol = p.stem % 2 === 0 ? '양' : '음'
        return <ElCard element={el} char={p.stemChar} sub={`${p.stemKo}, ${pol}${ELEMENTS_KO[el]}`} desc={STEM_DESC[p.stemKo] ?? ''} isDayMaster={idx === 1} dark={dark} />
      },
    },
    {
      label: '지지',
      render: p => {
        const el = BRANCH_ELEMENT[p.branch]
        const pol = p.branch % 2 === 0 ? '양' : '음'
        return <ElCard element={el} char={p.branchChar} sub={`${p.branchKo}, ${pol}${ELEMENTS_KO[el]}`} desc={BRANCH_DESC[p.branchKo] ?? ''} dark={dark} />
      },
    },
    { label: '지지 십성', render: p => <div className="pillar-text-cell"><span className="cell-value">{p.tenGodBranch}</span><span className="cell-desc">{TEN_GOD_DESC[p.tenGodBranch] ?? ''}</span></div> },
    { label: '지장간', render: p => <div className="pillar-text-cell"><span className="cell-value">{p.hiddenStems}</span></div> },
    { label: '12운성', render: p => <div className="pillar-text-cell"><span className="cell-value">{p.twelveStage}</span><span className="cell-desc">{TWELVE_STAGE_DESC[p.twelveStage] ?? ''}</span></div> },
    { label: '12신살', render: p => <div className="pillar-text-cell"><span className="cell-value">{p.twelveSpirit}</span><span className="cell-desc">{TWELVE_SPIRIT_DESC[p.twelveSpirit] ?? ''}</span></div> },
    { label: '공망', render: p => <div className={`pillar-text-cell ${p.isVoid ? 'pillar-void' : ''}`}><span className="cell-value">{p.isVoid ? '공' : '-'}</span>{p.isVoid && <span className="cell-desc">{VOID_DESC.void}</span>}</div> },
  ]

  return (
    <div className="saju-grid">
      <div className="saju-grid-row saju-grid-header">
        <div className="saju-grid-label" />
        {labels.map((label, i) => (
          <div key={label} className={`saju-grid-col-header ${i === 1 ? 'saju-grid-col-header--day' : ''}`}>
            <div className="pillar-label">{label}</div>
            <div className="pillar-sublabel">{sublabels[i]}</div>
          </div>
        ))}
      </div>
      {rows.map(row => (
        <div key={row.label} className="saju-grid-row">
          <div className="saju-grid-label">{row.label}</div>
          {pillars.map((pillar, i) => (
            <div key={i} className="saju-grid-cell">
              {renderCell(pillar, i, current => row.render(current, i))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function DaeunSection({ result, form, yongshin }: { result: SajuResult; form: FormState; yongshin: YongshinResult }) {
  const birthYear = Number(form.year)
  const birthMonth = Number(form.month)
  const birthDay = Number(form.day)
  const currentAge = new Date().getFullYear() - birthYear
  const periods = calculateDaeun(result.monthPillar.stem, result.monthPillar.branch, form.gender, result.yearPillar.stem, birthYear, birthMonth, birthDay, result.dayPillar.stem)
  const periodAnalyses = periods.map(period => analyzePeriodInteraction(period.stem, period.branch, result, yongshin.yongshin, yongshin.gishin))
  const activeIdx = periods.findIndex(period => currentAge >= period.startAge && currentAge <= period.endAge)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(activeIdx >= 0 ? activeIdx : null)
  const ratingColors: Record<string, string> = { great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626' }
  const ratingLabels: Record<string, string> = { great: '매우 좋음', good: '좋음', neutral: '보통', caution: '주의', warning: '경계' }

  return (
    <div className="result-card">
      <h3 className="section-title">대운 (10년 주기)</h3>
      <div className="daeun-scroll">
        {periods.map((period, i) => {
          const isActive = currentAge >= period.startAge && currentAge <= period.endAge
          const analysis = periodAnalyses[i]
          return (
            <div key={i} className={`daeun-card ${isActive ? 'daeun-card--active' : ''}`} style={{ borderTopColor: ratingColors[analysis.rating], borderTopWidth: 3, borderTopStyle: 'solid', cursor: 'pointer' }} onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}>
              <span className="daeun-age">{period.startAge}~{period.endAge}세</span>
              <span className="daeun-chars">{period.stemChar}{period.branchChar}</span>
              <span className="daeun-ko">{period.stemKo}{period.branchKo}</span>
              <span className="daeun-info">{period.tenGod} · {period.twelveStage}</span>
              <span className="daeun-rating" style={{ color: ratingColors[analysis.rating] }}>{ratingLabels[analysis.rating]}</span>
            </div>
          )
        })}
      </div>
      {expandedIdx !== null && (
        <div className="daeun-detail">
          <div className="daeun-detail-header">
            <strong>{periods[expandedIdx].stemChar}{periods[expandedIdx].branchChar} 대운</strong>
            <span>({periods[expandedIdx].startAge}~{periods[expandedIdx].endAge}세)</span>
            <span className="daeun-detail-rating" style={{ color: ratingColors[periodAnalyses[expandedIdx].rating] }}>{ratingLabels[periodAnalyses[expandedIdx].rating]}</span>
          </div>
          {periodAnalyses[expandedIdx].interactions.length > 0 && <InteractionTags interactions={periodAnalyses[expandedIdx].interactions} />}
          {periodAnalyses[expandedIdx].bringsYongshin && <span className="daeun-ys-tag daeun-ys-tag--good">용신 {ELEMENTS_HANJA[yongshin.yongshin]} 유입</span>}
          {periodAnalyses[expandedIdx].bringsGishin && <span className="daeun-ys-tag daeun-ys-tag--bad">기신 {ELEMENTS_HANJA[yongshin.gishin]} 유입</span>}
          <p className="daeun-narrative">{periodAnalyses[expandedIdx].narrative}</p>
        </div>
      )}
    </div>
  )
}

function SeunSection({ result, yongshin }: { result: SajuResult; yongshin: YongshinResult }) {
  const currentYear = new Date().getFullYear()
  const seun = calculateSeun(currentYear, result.dayPillar.stem, result.yearPillar.branch)
  const seunAnalysis = analyzePeriodInteraction(seun.stem, seun.branch, result, yongshin.yongshin, yongshin.gishin)
  const ratingColors: Record<string, string> = { great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626' }
  const ratingLabels: Record<string, string> = { great: '매우 좋음', good: '좋음', neutral: '보통', caution: '주의', warning: '경계' }

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
              <span className="seun-tag" style={{ color: ratingColors[seunAnalysis.rating], fontWeight: 700 }}>{ratingLabels[seunAnalysis.rating]}</span>
            </div>
          </div>
        </div>
        <p className="seun-summary">{seun.summary}</p>
        {seunAnalysis.interactions.length > 0 && <InteractionTags interactions={seunAnalysis.interactions} style={{ marginTop: 10 }} />}
        <p className="daeun-narrative" style={{ marginTop: 8 }}>{seunAnalysis.narrative}</p>
      </div>
    </div>
  )
}

function MonthlyFortuneSection({ result, yongshin }: { result: SajuResult; yongshin: YongshinResult }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const fortunes = calculateMonthlyFortunes(currentYear, result.dayPillar.stem)
  const monthAnalyses = fortunes.map(fortune => analyzePeriodInteraction(fortune.stem, fortune.branch, result, yongshin.yongshin, yongshin.gishin))
  const ratingColors: Record<string, string> = { great: '#16a34a', good: '#3b82f6', neutral: 'var(--text-muted)', caution: '#d97706', warning: '#dc2626' }
  const ratingDots: Record<string, string> = { great: '🟢', good: '🔵', neutral: '⚪', caution: '🟡', warning: '🔴' }
  const [expandedMonth, setExpandedMonth] = useState<number | null>(currentMonth - 1)

  return (
    <div className="result-card">
      <h3 className="section-title">{currentYear}년 월운</h3>
      <div className="monthly-grid">
        {fortunes.map((fortune, i) => {
          const analysis = monthAnalyses[i]
          const isCurrent = fortune.month === currentMonth
          const isExpanded = expandedMonth === i
          return (
            <div key={i}>
              <div className={`monthly-card ${isCurrent ? 'monthly-card--current' : ''} ${isExpanded ? 'monthly-card--expanded' : ''}`} onClick={() => setExpandedMonth(isExpanded ? null : i)} style={{ borderLeftColor: ratingColors[analysis.rating], borderLeftWidth: 3, borderLeftStyle: 'solid' }}>
                <div className="monthly-month">{fortune.month}월</div>
                <div className="monthly-chars">{fortune.stemChar}{fortune.branchChar}</div>
                <div className="monthly-info">{fortune.tenGod} · {fortune.twelveStage}</div>
                <div className="monthly-rating">{ratingDots[analysis.rating]}</div>
              </div>
              {isExpanded && (
                <div className="monthly-detail">
                  <div className="monthly-detail-header"><strong>{fortune.month}월</strong> {fortune.stemKo}{fortune.branchKo} ({fortune.elementHanja}{fortune.elementName})</div>
                  {analysis.interactions.length > 0 && <InteractionTags interactions={analysis.interactions} />}
                  {analysis.bringsYongshin && <span className="daeun-ys-tag daeun-ys-tag--good">용신 {ELEMENTS_HANJA[yongshin.yongshin]} 유입</span>}
                  {analysis.bringsGishin && <span className="daeun-ys-tag daeun-ys-tag--bad">기신 {ELEMENTS_HANJA[yongshin.gishin]} 유입</span>}
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

function InteractionTags({ interactions, style }: { interactions: Array<{ type: string; name: string; pillar: string }>; style?: React.CSSProperties }) {
  return (
    <div className="daeun-interactions" style={style}>
      {interactions.map((interaction, index) => (
        <span key={index} className={`daeun-int-tag daeun-int-tag--${interaction.type === '충' ? 'chung' : interaction.type === '형' ? 'hyung' : 'hap'}`}>
          {interaction.type === '합' ? '🤝' : interaction.type === '충' ? '⚡' : '⚠️'} {interaction.name} ({interaction.pillar})
        </span>
      ))}
    </div>
  )
}

type AiInterpretationState = 'idle' | 'loading' | 'success' | 'error'

async function requestAiInterpretation(prompt: string) {
  const response = await generateWithVertex({
    systemInstruction: SAJU_INTERPRETATION_SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.45,
    maxOutputTokens: 4096,
    thinkingBudget: 0,
  })

  return response.text.trim()
}

function AiInterpretationCard({
  open,
  status,
  text,
  error,
  onClose,
  onOpen,
  onRetry,
}: {
  open: boolean
  status: AiInterpretationState
  text: string
  error: string | null
  onClose: () => void
  onOpen: () => void
  onRetry: () => void
}) {
  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, open])

  if (!open) {
    return (
      <button type="button" className="ai-open-btn" onClick={onOpen}>
        <span className="ai-open-btn-badge">AI</span>
        <span>분석</span>
      </button>
    )
  }

  return (
    <div className="guide-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="guide-modal ai-analysis-modal">
        <div className="guide-modal-header">
          <div>
            <h2 className="guide-modal-title">AI 분석</h2>
            <p className="ai-interpretation-caption">Vertex AI 기반 보조 해석입니다. 버튼을 눌렀을 때만 전체 분석을 생성합니다.</p>
          </div>
          <div className="ai-modal-actions">
            <button
              type="button"
              className="ai-refresh-btn"
              onClick={onRetry}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? '생성 중...' : '다시 생성'}
            </button>
            <button className="guide-modal-close" onClick={onClose} aria-label="닫기">&times;</button>
          </div>
        </div>
        <div className="ai-analysis-scroll">
          {status === 'loading' && (
            <div className="ai-interpretation-body ai-interpretation-loading">
              <div className="loading-spinner ai-loading-spinner" />
              <div>
                <p className="loading-title ai-loading-title">AI 분석을 생성하고 있습니다</p>
                <p className="loading-text ai-loading-text">사주 결과를 바탕으로 전체 해석을 정리하는 중입니다.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="ai-interpretation-body ai-interpretation-body--error">
              <p className="ai-interpretation-error">{error ?? 'AI 해석을 불러오지 못했습니다.'}</p>
              <p className="ai-interpretation-help">API 서버 실행 상태와 Vertex 인증 설정을 확인해주세요.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="ai-interpretation-body ai-interpretation-body--modal">
              <div className="ai-interpretation-text">{text}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GunghapSection({ profiles, currentForm, currentResult }: { profiles: SavedProfile[]; currentForm: FormState; currentResult: SajuResult }) {
  const [targetId, setTargetId] = useState('')
  const otherProfiles = profiles.filter(profile => !(profile.form.name === currentForm.name && profile.form.year === currentForm.year && profile.form.month === currentForm.month && profile.form.day === currentForm.day && profile.form.hour === currentForm.hour && profile.form.gender === currentForm.gender))
  const compResult = useMemo<CompatibilityResult | null>(() => {
    if (!targetId) return null
    const target = profiles.find(profile => profile.id === targetId)
    if (!target) return null
    const y = Number(target.form.year)
    const m = Number(target.form.month)
    const d = Number(target.form.day)
    const h = target.form.hour === '' || target.form.hour === 'unknown' ? null : Number(target.form.hour)
    if (!y || !m || !d) return null
    return analyzeCompatibility(currentResult, calculateSaju(y, m, d, h))
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
            <select className="gunghap-person-select" value={targetId} onChange={e => setTargetId(e.target.value)}>
              <option value="">상대 선택</option>
              {otherProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.form.name.trim() || '의뢰인'} ({formatBirthText(profile.form)})</option>)}
            </select>
          </div>
          {compResult && (
            <div className="gunghap-detail">
              <div className="gunghap-score"><div className="gunghap-score-number">{compResult.score}</div><div className="gunghap-score-label">궁합 점수</div></div>
              <div className="gunghap-relation">
                <div className="gunghap-rel-box"><div className="gunghap-rel-label">{currentName} → 상대</div><div className="gunghap-rel-value">{compResult.relation1to2}</div></div>
                <div className="gunghap-rel-box"><div className="gunghap-rel-label">상대 → {currentName}</div><div className="gunghap-rel-value">{compResult.relation2to1}</div></div>
              </div>
              <table className="gunghap-element-table">
                <thead><tr><th>오행</th><th>{currentName}</th><th>상대</th><th>합계</th></tr></thead>
                <tbody>
                  {compResult.elementBalance.map(element => (
                    <tr key={element.element}>
                      <td style={{ fontWeight: 600 }}>{element.hanja} {element.name}</td>
                      <td>{element.countA}</td>
                      <td>{element.countB}</td>
                      <td style={{ fontWeight: 600 }}>{element.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {compResult.haps.length > 0 && (
                <div className="gunghap-haps">
                  <h4 className="gunghap-haps-title">합(合) 분석</h4>
                  {compResult.haps.map((hap, index) => (
                    <div key={index} className={`gunghap-hap-item gunghap-hap-item--${hap.rating}`}>
                      <div className="gunghap-hap-header">
                        <span className={`gunghap-hap-badge gunghap-hap-badge--${hap.rating}`}>{hap.type}</span>
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

export function ResultSection({
  result,
  name,
  birthText,
  genderText,
  form,
  profiles,
  onSave,
  onMbtiChange,
  saveLabel,
  alreadySaved,
  isSaving,
  dark,
}: {
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
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState<'basic' | 'gunghap'>('basic')
  const cachedSingang = useMemo(() => analyzeSingang(result), [result])
  const cachedJohu = useMemo(() => analyzeJohu(result), [result])
  const cachedYongshin = useMemo(() => determineYongshin(result, cachedSingang, cachedJohu), [result, cachedSingang, cachedJohu])
  const aiPrompt = useMemo(() => buildSajuInterpretationPrompt({
    form,
    birthText,
    genderText,
    result,
    singang: cachedSingang,
    johu: cachedJohu,
    yongshin: cachedYongshin,
  }), [birthText, cachedJohu, cachedSingang, cachedYongshin, form, genderText, result])
  const aiRequestKey = useMemo(() => JSON.stringify({
    name: form.name,
    year: form.year,
    month: form.month,
    day: form.day,
    hour: form.hour,
    gender: form.gender,
    mbti: form.mbti,
    dayPillar: `${result.dayPillar.stem}${result.dayPillar.branch}`,
    monthPillar: `${result.monthPillar.stem}${result.monthPillar.branch}`,
    yearPillar: `${result.yearPillar.stem}${result.yearPillar.branch}`,
    hourPillar: result.hourPillar ? `${result.hourPillar.stem}${result.hourPillar.branch}` : null,
    elements: analyzeElements(result).map(item => item.count),
    interactions: analyzeInteractions(result).map(item => `${item.type}:${item.name}`),
    void: analyzeVoid(result).affectedPillars.map(item => item.pillar),
  }), [form, result])
  const dayStemEl = STEM_ELEMENT[result.dayPillar.stem]
  const dayPolarity = result.dayPillar.stem % 2 === 0 ? '양' : '음'
  const dayMasterDesc = `${ELEMENTS_HANJA[dayStemEl]}(${ELEMENTS_KO[dayStemEl]}) - ${dayPolarity}${ELEMENTS_KO[dayStemEl]}`
  const [aiStatus, setAiStatus] = useState<AiInterpretationState>('idle')
  const [aiText, setAiText] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiLoadedKey, setAiLoadedKey] = useState<string | null>(null)

  const handleLoadAi = async (force = false) => {
    if (aiStatus === 'loading') return
    if (!force && aiLoadedKey === aiRequestKey && aiText) return

    setAiStatus('loading')
    setAiError(null)

    try {
      const text = await requestAiInterpretation(aiPrompt)
      setAiText(text)
      setAiStatus('success')
      setAiLoadedKey(aiRequestKey)
    } catch (error) {
      setAiText('')
      setAiError(error instanceof Error ? error.message : 'AI 해석 요청에 실패했습니다.')
      setAiStatus('error')
    }
  }

  const handleRetryAi = async () => {
    await handleLoadAi(true)
  }

  const handleOpenAiModal = () => {
    setAiModalOpen(true)
    if (!(aiLoadedKey === aiRequestKey && aiText)) {
      setAiStatus('loading')
    }
    void handleLoadAi(false)
  }

  const handleExport = async () => {
    const target = resultRef.current
    if (!target || exporting) return
    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(target, { backgroundColor: dark ? '#1a1a1a' : '#faf9f7', scale: 2, useCORS: true })
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

  return (
    <div className="result-section" ref={resultRef}>
      <SajuSummaryCard result={result} name={name} dark={dark} singang={cachedSingang} johu={cachedJohu} yongshin={cachedYongshin} />
      <div className="result-card">
        <div className="result-header">
          <h2 className="section-title" style={{ margin: 0 }}>사주원국</h2>
          <div className="result-header-actions">
            <AiInterpretationCard
              open={aiModalOpen}
              status={aiStatus}
              text={aiText}
              error={aiError}
              onOpen={handleOpenAiModal}
              onClose={() => setAiModalOpen(false)}
              onRetry={() => { void handleRetryAi() }}
            />
            <button className="export-btn" onClick={handleExport} disabled={exporting}>{exporting ? '저장 중...' : '이미지 저장'}</button>
            <button className={`save-btn ${alreadySaved ? 'save-btn--saved' : ''}`} onClick={onSave} disabled={alreadySaved || isSaving}>{saveLabel}</button>
          </div>
        </div>
        <div className="result-info">
          <span>{name}</span><span className="info-sep">|</span><span>{birthText}</span><span className="info-sep">|</span><span>{genderText}</span>
          {form.mbti && <><span className="info-sep">|</span><span>MBTI {form.mbti}</span></>}
        </div>
        {form.hour === 'unknown' && (
          <p className="analysis-detail" style={{ marginTop: 12, marginBottom: 0 }}>
            시주를 모름으로 계산해 시주는 제외하고 연주·월주·일주 기준으로 해석했어요.
          </p>
        )}
        <div className="result-mbti-row">
          <label className="label result-mbti-label" htmlFor="result-mbti">MBTI</label>
          <input id="result-mbti" className="result-mbti-input" type="text" inputMode="text" placeholder="예: INFP" maxLength={4} value={form.mbti} onChange={e => onMbtiChange(e.target.value)} />
          <span className="result-mbti-help">영문 4자리까지 저장됩니다.</span>
        </div>
        <div className="day-master-badge">일간(日干): <strong>{result.dayPillar.stemChar} {result.dayPillar.stemKo}</strong> — {dayMasterDesc}</div>
        <SajuTable result={result} dark={dark} />
        <p className="disclaimer">절기 경계는 근사치(양력 기준)를 사용합니다. 정밀한 사주 분석은 전문가 상담을 권장합니다.</p>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'basic' ? 'tab-btn--active' : ''}`} onClick={() => setTab('basic')}>상세 분석</button>
        <button className={`tab-btn ${tab === 'gunghap' ? 'tab-btn--active' : ''}`} onClick={() => setTab('gunghap')}>궁합 비교</button>
      </div>
      {tab === 'basic' && (
        <>
          <DayMasterSection result={result} />
          <JohuSingangSection singang={cachedSingang} johu={cachedJohu} />
          <YongshinSection yongshin={cachedYongshin} />
          <InteractionsSection result={result} />
          <VoidSection result={result} />
          <div className="result-card"><ElementChart result={result} dark={dark} /></div>
          <DaeunSection result={result} form={form} yongshin={cachedYongshin} />
          <SeunSection result={result} yongshin={cachedYongshin} />
          <MonthlyFortuneSection result={result} yongshin={cachedYongshin} />
        </>
      )}
      {tab === 'gunghap' && <GunghapSection profiles={profiles} currentForm={form} currentResult={result} />}
    </div>
  )
}
