import { Suspense, lazy, useEffect, useState } from 'react'
import {
  analyzeElements,
  analyzeInteractions,
  analyzeVoid,
  DAY_MASTER_PROFILES,
  ELEMENTS_HANJA,
  ELEMENTS_KO,
  STEM_ELEMENT,
  type JohuResult,
  type SingangResult,
  type SajuResult,
  type YongshinResult,
} from '../../saju-calc'
import type { DayPillarProfile } from '../../day-pillar-profiles'
import { loadDayPillarProfile } from '../../async-content'
import {
  EL_BAR,
  EL_BG,
  EL_BG_DARK,
  EL_BORDER,
  EL_BORDER_DARK,
  EL_TEXT,
  EL_TEXT_DARK,
} from '../../element-theme'

const ElementRadarChart = lazy(() => import('../../element-radar-chart'))

function getSexagenary(stem: number, branch: number): number {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === branch) return i
  }
  return 0
}

function useDayPillarProfile(sexagenary: number) {
  const [profile, setProfile] = useState<DayPillarProfile | null>(null)

  useEffect(() => {
    let active = true
    void loadDayPillarProfile(sexagenary).then(data => {
      if (active) setProfile(data)
    })
    return () => {
      active = false
    }
  }, [sexagenary])

  return profile
}

function ProfileBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="profile-block">
      <span className="profile-block-label">{label}</span>
      <p className="profile-block-text">{text}</p>
    </div>
  )
}

function YongshinTip({ label, value }: { label: string; value: string }) {
  return (
    <div className="yongshin-tip">
      <span className="yongshin-tip-label">{label}</span>
      <span className="yongshin-tip-value">{value}</span>
    </div>
  )
}

export function DayMasterSection({ result }: { result: SajuResult }) {
  const sex = getSexagenary(result.dayPillar.stem, result.dayPillar.branch)
  const pillarProfile = useDayPillarProfile(sex)
  const fallback = DAY_MASTER_PROFILES[result.dayPillar.stemKo]

  if (!pillarProfile && !fallback) return null

  if (pillarProfile) {
    return (
      <div className="result-card">
        <h3 className="section-title">일주 성격 해설</h3>
        <div className="day-master-profile">
          <div className="day-master-title">{pillarProfile.title}</div>
          <ProfileBlock label="이미지" text={pillarProfile.image} />
          <ProfileBlock label="성격" text={pillarProfile.personality} />
          <ProfileBlock label="장점" text={pillarProfile.strengths} />
          <ProfileBlock label="약점" text={pillarProfile.weaknesses} />
          <ProfileBlock label="연애·관계" text={pillarProfile.relationships} />
          <ProfileBlock label="적성·직업" text={pillarProfile.career} />
          <ProfileBlock label="조언" text={pillarProfile.advice} />
        </div>
      </div>
    )
  }

  return (
    <div className="result-card">
      <h3 className="section-title">일간 성격 해설</h3>
      <div className="day-master-profile">
        <div className="day-master-title">{fallback!.title}</div>
        <ProfileBlock label="성격" text={fallback!.personality} />
        <ProfileBlock label="장점" text={fallback!.strengths} />
        <ProfileBlock label="약점" text={fallback!.weaknesses} />
        <ProfileBlock label="조언" text={fallback!.advice} />
      </div>
    </div>
  )
}

export function JohuSingangSection({ singang, johu }: { singang: SingangResult; johu: JohuResult }) {
  const gaugeColor = singang.score >= 58 ? '#ef4444'
    : singang.score >= 42 ? '#eab308'
      : '#3b82f6'

  const tempIcon = johu.season === '여름' ? '☀️'
    : johu.season === '겨울' ? '❄️'
      : johu.season === '봄' ? '🌸'
        : '🍂'

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
            필요 오행: {johu.neededHanja} {johu.neededElement}
          </span>
        </div>
        <p className="analysis-summary">{johu.summary}</p>
        <p className="analysis-detail">{johu.detail}</p>
      </div>

      <div className="analysis-divider" />

      <div className="analysis-block">
        <div className="analysis-label">
          <span className="analysis-icon">💪</span>
          신강 / 신약
        </div>
        <div className="singang-gauge">
          <div className="singang-gauge-track">
            <div className="singang-gauge-fill" style={{ width: `${singang.score}%`, background: gaugeColor }} />
          </div>
          <div className="singang-gauge-meta">
            <span>{singang.label}</span>
            <span>{singang.score}점</span>
          </div>
        </div>
        <p className="analysis-summary">{singang.summary}</p>
        <p className="analysis-detail">{singang.detail}</p>
      </div>
    </div>
  )
}

export function InteractionsSection({ result }: { result: SajuResult }) {
  const items = analyzeInteractions(result)

  return (
    <div className="result-card">
      <h3 className="section-title">형충파해 / 합 분석</h3>
      {items.length === 0 ? (
        <p className="analysis-detail" style={{ textAlign: 'center', padding: 12 }}>
          눈에 띄는 형충파해·합이 없습니다.
        </p>
      ) : (
        <div className="interaction-list">
          {items.map((item, index) => (
            <div key={index} className={`interaction-item interaction-item--${item.type === '충' ? 'chung' : item.type === '형' ? 'hyung' : 'hap'}`}>
              <div className="interaction-header">
                <span className="interaction-type">{item.type}</span>
                <span className="interaction-name">{item.name}</span>
              </div>
              <p className="interaction-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function YongshinSection({ yongshin }: { yongshin: YongshinResult }) {
  const elBg = EL_BG[yongshin.yongshin]
  const elText = EL_TEXT[yongshin.yongshin]
  const elBorder = EL_BORDER[yongshin.yongshin]

  return (
    <div className="result-card">
      <h3 className="section-title">용신 (유리한 오행)</h3>
      <div className="yongshin-main" style={{ background: elBg, borderColor: elBorder, color: elText }}>
        <div className="yongshin-element">{ELEMENTS_HANJA[yongshin.yongshin]}</div>
        <div className="yongshin-name">{yongshin.yongshinName}</div>
      </div>
      <p className="analysis-summary">{yongshin.summary}</p>
      <p className="analysis-detail">{yongshin.detail}</p>
      <div className="yongshin-tips">
        <YongshinTip label="유리한 색상" value={yongshin.colors} />
        <YongshinTip label="유리한 방위" value={yongshin.direction} />
        <YongshinTip label="유리한 계절" value={yongshin.season} />
        <YongshinTip label="추천 업종" value={yongshin.careers.join(', ')} />
        <YongshinTip label="피해야 할 오행" value={yongshin.gishinName} />
      </div>
    </div>
  )
}

export function VoidSection({ result }: { result: SajuResult }) {
  const analysis = analyzeVoid(result)

  return (
    <div className="result-card">
      <h3 className="section-title">공망 (空亡) 분석</h3>
      <div className="void-header">
        <span className="void-label">공망 지지:</span>
        <span className="void-chars">{analysis.voidHanja[0]}({analysis.voidBranches[0]}) · {analysis.voidHanja[1]}({analysis.voidBranches[1]})</span>
      </div>
      {analysis.affectedPillars.length > 0 ? (
        <div className="void-affected">
          {analysis.affectedPillars.map((item, index) => (
            <div key={index} className="void-item">
              <span className="void-item-badge">{item.pillar} 공망</span>
              <p className="void-item-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="analysis-detail" style={{ textAlign: 'center', padding: 12 }}>
          원국에 공망이 걸린 기둥이 없어요!
        </p>
      )}
      <p className="analysis-summary" style={{ marginTop: 8 }}>{analysis.summary}</p>
    </div>
  )
}

export function SajuSummaryCard({
  result,
  name,
  dark,
  singang,
  johu,
  yongshin,
}: {
  result: SajuResult
  name: string
  dark: boolean
  singang: SingangResult
  johu: JohuResult
  yongshin: YongshinResult
}) {
  const interactions = analyzeInteractions(result)
  const sex = getSexagenary(result.dayPillar.stem, result.dayPillar.branch)
  const pillarProfile = useDayPillarProfile(sex)

  const dayStemEl = STEM_ELEMENT[result.dayPillar.stem]
  const elBg = dark ? EL_BG_DARK[dayStemEl] : EL_BG[dayStemEl]
  const elText = dark ? EL_TEXT_DARK[dayStemEl] : EL_TEXT[dayStemEl]
  const elBorder = dark ? EL_BORDER_DARK[dayStemEl] : EL_BORDER[dayStemEl]

  const chungCount = interactions.filter(item => item.type === '충').length
  const hapCount = interactions.filter(item => item.type !== '충' && item.type !== '형').length

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
        <span className="summary-tag">용신: {ELEMENTS_HANJA[yongshin.yongshin]}({ELEMENTS_KO[yongshin.yongshin]})</span>
        {chungCount > 0 && <span className="summary-tag summary-tag--warn">충 {chungCount}개</span>}
        {hapCount > 0 && <span className="summary-tag summary-tag--good">합 {hapCount}개</span>}
      </div>
    </div>
  )
}

export function ElementChart({ result, dark }: { result: SajuResult; dark: boolean }) {
  const analysis = analyzeElements(result)
  const maxCount = Math.max(...analysis.map(item => item.count), 1)
  const missing = analysis.filter(item => item.count === 0)

  return (
    <div className="element-chart">
      <h3 className="section-title">오행 분석</h3>
      <Suspense fallback={<div className="loading-text">차트를 불러오는 중...</div>}>
        <ElementRadarChart analysis={analysis} dark={dark} maxCount={maxCount} />
      </Suspense>
      <div className="element-bars">
        {analysis.map(item => (
          <div key={item.element} className="element-bar-row">
            <span className="element-label" style={{ color: dark ? EL_TEXT_DARK[item.element] : EL_TEXT[item.element] }}>
              {item.hanja} {item.name}
            </span>
            <div className="element-bar-track">
              <div
                className="element-bar-fill"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  background: EL_BAR[item.element],
                }}
              />
            </div>
            <span className="element-count">{item.count}</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="element-note">
          부족한 오행: {missing.map(item => `${item.hanja}(${item.name})`).join(', ')}
        </p>
      )}
    </div>
  )
}
