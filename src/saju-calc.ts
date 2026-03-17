// ============================================================
// 사주팔자 계산 엔진
// 양력 입력 기반, 절기 근사치 사용
// ============================================================

// 천간 (Heavenly Stems)
export const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const
export const STEM_KO = ['갑','을','병','정','무','기','경','신','임','계'] as const

// 지지 (Earthly Branches)
export const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const
export const BRANCH_KO = ['자','축','인','묘','진','사','오','미','신','유','술','해'] as const

// 오행 (Five Elements): 0=木, 1=火, 2=土, 3=金, 4=水
export const ELEMENTS_KO = ['목','화','토','금','수'] as const
export const ELEMENTS_HANJA = ['木','火','土','金','水'] as const

// 천간별 오행
export const STEM_ELEMENT = [0,0,1,1,2,2,3,3,4,4] as const

// 지지별 오행 (본기 기준)
export const BRANCH_ELEMENT = [4,2,0,0,2,1,1,2,3,3,2,4] as const

// 지장간 (여기→중기→정기, 마지막이 정기/본기)
const JIJANGGAN: number[][] = [
  [9],       // 子: 癸
  [9,7,5],   // 丑: 癸辛己
  [4,2,0],   // 寅: 戊丙甲
  [1],       // 卯: 乙
  [1,9,4],   // 辰: 乙癸戊
  [4,6,2],   // 巳: 戊庚丙
  [5,3],     // 午: 己丁
  [3,1,5],   // 未: 丁乙己
  [4,8,6],   // 申: 戊壬庚
  [7],       // 酉: 辛
  [7,3,4],   // 戌: 辛丁戊
  [0,8],     // 亥: 甲壬
]

// 12운성
const TWELVE_STAGES = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'] as const

// 각 천간의 장생 지지 인덱스
const STAGE_START = [11,6,2,9,2,9,5,0,8,3] as const

interface SolarTermBoundary {
  month: number
  branchIdx: number
  c20: number
  c21: number
  corrections?: Record<number, number>
}

// 12개 절입 기준. 20세기/21세기 보정 상수와 연도별 예외값을 함께 사용한다.
const SOLAR_TERM_BOUNDARIES: SolarTermBoundary[] = [
  { month: 1, branchIdx: 1, c20: 6.11, c21: 5.4055, corrections: { 2019: -1 } },   // 소한 → 축월
  { month: 2, branchIdx: 2, c20: 4.6295, c21: 3.87, corrections: { 2021: 1 } },    // 입춘 → 인월
  { month: 3, branchIdx: 3, c20: 6.3826, c21: 5.63 },                                // 경칩 → 묘월
  { month: 4, branchIdx: 4, c20: 5.59, c21: 4.81 },                                  // 청명 → 진월
  { month: 5, branchIdx: 5, c20: 6.318, c21: 5.52, corrections: { 2008: 1 } },      // 입하 → 사월
  { month: 6, branchIdx: 6, c20: 6.5, c21: 5.678, corrections: { 1902: 1 } },       // 망종 → 오월
  { month: 7, branchIdx: 7, c20: 7.928, c21: 7.108, corrections: { 2016: 1 } },     // 소서 → 미월
  { month: 8, branchIdx: 8, c20: 8.35, c21: 7.5, corrections: { 2002: 1 } },        // 입추 → 신월
  { month: 9, branchIdx: 9, c20: 8.44, c21: 7.646 },                                 // 백로 → 유월
  { month: 10, branchIdx: 10, c20: 9.098, c21: 8.318 },                              // 한로 → 술월
  { month: 11, branchIdx: 11, c20: 8.218, c21: 7.438, corrections: { 2089: 1 } },   // 입동 → 해월
  { month: 12, branchIdx: 0, c20: 7.9, c21: 7.18, corrections: { 1954: 1 } },       // 대설 → 자월
]

// --- 유틸리티 함수 ---

function getJulianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

function shiftDate(year: number, month: number, day: number, offsetDays: number) {
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function getSolarTermBoundaryDay(year: number, term: SolarTermBoundary): number {
  const yearInCentury = year % 100
  const centuryConstant = year >= 2000 ? term.c21 : term.c20
  let day = Math.floor(yearInCentury * 0.2422 + centuryConstant) - Math.floor((yearInCentury - 1) / 4)
  day += term.corrections?.[year] ?? 0
  return day
}

/** 입춘 기준 사주 연도 */
function getSajuYear(year: number, month: number, day: number): number {
  const ipchunDay = getSolarTermBoundaryDay(year, SOLAR_TERM_BOUNDARIES[1])
  if (month < 2 || (month === 2 && day < ipchunDay)) return year - 1
  return year
}

function getSajuMonthBranchForDate(year: number, month: number, day: number): number {
  for (let i = SOLAR_TERM_BOUNDARIES.length - 1; i >= 0; i--) {
    const t = SOLAR_TERM_BOUNDARIES[i]
    const boundaryDay = getSolarTermBoundaryDay(year, t)
    if (month > t.month || (month === t.month && day >= boundaryDay)) {
      return t.branchIdx
    }
  }
  return 0
}

/** 년주 */
function getYearPillar(sajuYear: number) {
  return {
    stem: ((sajuYear - 4) % 10 + 10) % 10,
    branch: ((sajuYear - 4) % 12 + 12) % 12,
  }
}

/** 월주 - 오호둔법(五虎遁法) */
function getMonthPillar(yearStem: number, monthBranch: number) {
  const monthOffset = ((monthBranch - 2) % 12 + 12) % 12 // 인월=0
  const baseStem = ((yearStem % 5) * 2 + 2) % 10
  return {
    stem: (baseStem + monthOffset) % 10,
    branch: monthBranch,
  }
}

/** 일주 - Julian Day 기반 */
function getDayPillar(year: number, month: number, day: number) {
  const jdn = getJulianDayNumber(year, month, day)
  const sexagenary = ((jdn + 49) % 60 + 60) % 60
  return {
    stem: sexagenary % 10,
    branch: sexagenary % 12,
    sexagenary,
  }
}

/** 시주 - 오자둔법(五子遁法) */
function getHourPillar(dayStem: number, hourBranch: number) {
  const baseStem = (dayStem % 5) * 2
  return {
    stem: (baseStem + hourBranch) % 10,
    branch: hourBranch,
  }
}

function normalizeHourInput(hourValue: number | null): { hourBranch: number; dayOffset: 0 | 1 } | null {
  if (hourValue === null) return null
  if (hourValue === 23) return { hourBranch: 0, dayOffset: 1 }
  if (hourValue === 0) return { hourBranch: 0, dayOffset: 0 }
  if (hourValue < 0 || hourValue > 23) return null

  if (hourValue === 1 || hourValue === 2) return { hourBranch: 1, dayOffset: 0 }
  if (hourValue === 3 || hourValue === 4) return { hourBranch: 2, dayOffset: 0 }
  if (hourValue === 5 || hourValue === 6) return { hourBranch: 3, dayOffset: 0 }
  if (hourValue === 7 || hourValue === 8) return { hourBranch: 4, dayOffset: 0 }
  if (hourValue === 9 || hourValue === 10) return { hourBranch: 5, dayOffset: 0 }
  if (hourValue === 11 || hourValue === 12) return { hourBranch: 6, dayOffset: 0 }
  if (hourValue === 13 || hourValue === 14) return { hourBranch: 7, dayOffset: 0 }
  if (hourValue === 15 || hourValue === 16) return { hourBranch: 8, dayOffset: 0 }
  if (hourValue === 17 || hourValue === 18) return { hourBranch: 9, dayOffset: 0 }
  if (hourValue === 19 || hourValue === 20) return { hourBranch: 10, dayOffset: 0 }
  return { hourBranch: 11, dayOffset: 0 }
}

/** 십성 계산 */
export function getTenGod(dayStem: number, targetStem: number): string {
  const dayEl = Math.floor(dayStem / 2)
  const targetEl = Math.floor(targetStem / 2)
  const samePol = dayStem % 2 === targetStem % 2
  const diff = ((targetEl - dayEl) % 5 + 5) % 5

  const table: [string, string][] = [
    ['비견', '겁재'],
    ['식신', '상관'],
    ['편재', '정재'],
    ['편관', '정관'],
    ['편인', '정인'],
  ]
  return samePol ? table[diff][0] : table[diff][1]
}

/** 12운성 계산 */
export function getTwelveStage(dayStem: number, branch: number): string {
  const start = STAGE_START[dayStem]
  const isYang = dayStem % 2 === 0
  const stageIdx = isYang
    ? ((branch - start) % 12 + 12) % 12
    : ((start - branch) % 12 + 12) % 12
  return TWELVE_STAGES[stageIdx]
}

/** 공망 계산 (일주 육갑순 기준) */
export function getVoidBranches(daySexagenary: number): [number, number] {
  const group = Math.floor(daySexagenary / 10)
  return [
    (10 - group * 2 + 12) % 12,
    (11 - group * 2 + 12) % 12,
  ]
}

/** 지장간 문자열 */
export function getHiddenStemsDisplay(branchIdx: number): string {
  return JIJANGGAN[branchIdx].map(s => STEM_KO[s]).join(' ')
}

/** 지장간 정기(본기) 인덱스 */
function getMainHiddenStem(branchIdx: number): number {
  const arr = JIJANGGAN[branchIdx]
  return arr[arr.length - 1]
}

// 12신살 (년지 삼합 기준)
const TWELVE_SPIRITS = ['겁살','재살','천살','지살','년살','월살','망신','장성','반안','역마','육해','화개'] as const

// 년지 → 삼합 그룹: 申子辰=0, 寅午戌=1, 巳酉丑=2, 亥卯未=3
const BRANCH_TO_SAMHAP = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3] as const

// 각 삼합 그룹의 겁살 시작 지지: 申子辰→巳(5), 寅午戌→亥(11), 巳酉丑→寅(2), 亥卯未→申(8)
const SPIRIT_START = [5, 11, 2, 8] as const

/** 12신살 계산 (년지 기준) */
export function getTwelveSpirit(yearBranch: number, targetBranch: number): string {
  const group = BRANCH_TO_SAMHAP[yearBranch]
  const start = SPIRIT_START[group]
  const idx = ((targetBranch - start) % 12 + 12) % 12
  return TWELVE_SPIRITS[idx]
}

// --- 설명 사전 ---

/** 십성 설명 */
export const TEN_GOD_DESC: Record<string, string> = {
  '비견': '자립심, 경쟁심, 형제·동료의 인연',
  '겁재': '승부욕, 추진력, 재물 다툼 주의',
  '식신': '표현력, 재능, 식복과 여유',
  '상관': '창의력, 예술성, 반항과 자유',
  '편재': '유동 재물, 사업운, 아버지 인연',
  '정재': '안정 재물, 근면성, 저축과 성실',
  '편관': '권위, 명예, 외부 압박과 시련',
  '정관': '직장, 책임감, 규율과 명예',
  '편인': '비범한 학문, 특수 재능, 고독',
  '정인': '학문, 어머니 인연, 인덕과 자비',
  '일원': '나 자신, 사주의 중심 기둥',
}

/** 천간 해설 */
export const STEM_DESC: Record<string, string> = {
  '갑': '큰 나무, 우직한 리더십과 개척 정신',
  '을': '풀·덩굴, 유연한 적응력과 처세',
  '병': '태양, 밝고 화려한 에너지와 열정',
  '정': '촛불, 섬세한 따뜻함과 배려',
  '무': '산·대지, 묵직한 신뢰와 포용력',
  '기': '논밭, 실용적 지혜와 섬세함',
  '경': '바위·쇠, 강한 의지와 결단력',
  '신': '보석·칼날, 예리한 감각과 완벽주의',
  '임': '바다·큰 강, 지혜와 포용의 기운',
  '계': '이슬·샘물, 총명함과 내면의 깊이',
}

/** 지지 해설 */
export const BRANCH_DESC: Record<string, string> = {
  '자': '한밤의 물, 지혜와 새로운 시작',
  '축': '겨울 끝 대지, 인내와 축적의 힘',
  '인': '새벽 숲, 진취적 기상과 용맹',
  '묘': '봄 꽃, 부드러운 감성과 예술성',
  '진': '봄비 대지, 변화를 품은 저력',
  '사': '한낮 불꽃, 문명과 지략의 기운',
  '오': '정오의 태양, 열정과 화려함',
  '미': '여름 끝 대지, 포용과 사색',
  '신': '가을 쇠, 결단력과 실행력',
  '유': '저녁 빛, 섬세한 심미안과 예리함',
  '술': '가을 끝 대지, 충직함과 저장',
  '해': '밤바다, 깊은 지혜와 포용력',
}

/** 12운성 설명 */
export const TWELVE_STAGE_DESC: Record<string, string> = {
  '장생': '새 생명의 시작, 희망과 성장의 기운',
  '목욕': '불안정·변화가 많은 시기, 감성적',
  '관대': '성인이 되어 사회에 진출, 활동력 상승',
  '건록': '왕성한 활동기, 독립·녹봉의 시기',
  '제왕': '기운이 절정, 강한 리더십과 자존심',
  '쇠': '기세가 점차 약해짐, 원숙·안정',
  '병': '기운이 기울어 쉬어야 할 때',
  '사': '기운이 소멸 직전, 정신적 깊이',
  '묘': '에너지 저장 단계, 내면 축적',
  '절': '단절·전환, 새로운 가능성의 씨앗',
  '태': '새 생명이 잉태됨, 잠재력 형성',
  '양': '보호받으며 자라는 단계, 준비기',
}

/** 12신살 설명 */
export const TWELVE_SPIRIT_DESC: Record<string, string> = {
  '겁살': '예기치 않은 재난·사고에 주의',
  '재살': '질병·재해의 기운, 건강 관리 필요',
  '천살': '하늘이 내리는 시련, 불가항력적 변화',
  '지살': '땅의 재살, 부동산·이사 관련 변동',
  '년살': '이성 문제·색정 관련 신살',
  '월살': '가정·가족 관련 고민이 생길 수 있음',
  '망신': '체면 손상·실수에 주의, 겸손 필요',
  '장성': '명예·권위를 얻는 길성, 리더십',
  '반안': '안정과 편안함, 귀인의 도움',
  '역마': '이동·변화·해외운, 활동적 에너지',
  '육해': '대인관계 갈등·배신에 주의',
  '화개': '학문·예술·종교적 재능, 고독한 탐구',
}

/** 공망 설명 */
export const VOID_DESC = {
  void: '해당 기운이 비어 있음, 허무·변동 가능',
  none: '',
}

/** 공망 상세 해석 */
export interface VoidAnalysis {
  voidBranches: [string, string]  // 공망 지지 한글명
  voidHanja: [string, string]
  affectedPillars: { pillar: string; branchKo: string; desc: string }[]
  summary: string
}

const VOID_PILLAR_DESC: Record<string, string> = {
  '년지': '조상·어린 시절의 기운이 비어있어. 유년기에 불안정하거나, 조상 덕이 약할 수 있어. 반면 자수성가의 기운이 있어 — 기댈 곳이 없으니 스스로 일어서는 사람이 돼.',
  '월지': '직장·사회활동의 기운이 비어있어. 직장운이 불안정하거나 이직이 잦을 수 있어. 하지만 조직에 매이지 않는 자유로운 활동이 오히려 잘 맞을 수 있어.',
  '일지': '배우자·가정의 기운이 비어있어. 배우자와의 인연이 특이하거나, 결혼 생활에 변동이 있을 수 있어. 하지만 정신적으로 깊은 내면 세계를 가지게 돼.',
  '시지': '자녀·말년의 기운이 비어있어. 자녀와의 인연이 늦거나 특이할 수 있어. 노후에 물질보다는 정신적 풍요를 추구하게 되는 경우가 많아.',
}

export function analyzeVoid(result: SajuResult): VoidAnalysis {
  const vb = result.voidBranches
  const voidKo: [string, string] = [BRANCH_KO[vb[0]], BRANCH_KO[vb[1]]]
  const voidHanja: [string, string] = [BRANCHES[vb[0]], BRANCHES[vb[1]]]

  const pillars: { pillar: string; branch: number }[] = [
    { pillar: '년지', branch: result.yearPillar.branch },
    { pillar: '월지', branch: result.monthPillar.branch },
    { pillar: '일지', branch: result.dayPillar.branch },
  ]
  if (result.hourPillar) pillars.push({ pillar: '시지', branch: result.hourPillar.branch })

  const affected = pillars
    .filter(p => vb.includes(p.branch))
    .map(p => ({
      pillar: p.pillar,
      branchKo: BRANCH_KO[p.branch],
      desc: VOID_PILLAR_DESC[p.pillar] ?? '',
    }))

  let summary: string
  if (affected.length === 0) {
    summary = `공망은 ${voidHanja[0]}(${voidKo[0]})·${voidHanja[1]}(${voidKo[1]})이지만, 사주 원국의 어느 기둥에도 해당하지 않아요. 공망의 영향이 거의 없는 안정적인 구조예요.`
  } else {
    const names = affected.map(a => `${a.pillar}(${a.branchKo})`).join(', ')
    summary = `공망 ${voidHanja[0]}(${voidKo[0]})·${voidHanja[1]}(${voidKo[1]})이 ${names}에 걸려 있어요. 해당 기둥의 기운이 비어있지만, 이는 "집착을 내려놓는" 기운이기도 해요. 세속적 욕심보다 정신적 깊이로 승화하면 오히려 큰 자유를 얻을 수 있어요.`
  }

  return { voidBranches: voidKo, voidHanja, affectedPillars: affected, summary }
}

// --- 메인 인터페이스 & 함수 ---

export interface Pillar {
  stem: number
  branch: number
  stemChar: string
  stemKo: string
  branchChar: string
  branchKo: string
  stemElement: number
  branchElement: number
  tenGodStem: string
  tenGodBranch: string
  hiddenStems: string
  twelveStage: string
  twelveSpirit: string
  isVoid: boolean
}

export interface SajuResult {
  yearPillar: Pillar
  monthPillar: Pillar
  dayPillar: Pillar
  hourPillar: Pillar | null
  voidBranches: [number, number]
  sajuYear: number
}

export function calculateSaju(
  year: number,
  month: number,
  day: number,
  hourValue: number | null, // 23,0,1,3,...,21 또는 구버전 0,2,4,...,22
): SajuResult {
  const sajuYear = getSajuYear(year, month, day)
  const yearP = getYearPillar(sajuYear)
  const monthBranch = getSajuMonthBranchForDate(year, month, day)
  const monthP = getMonthPillar(yearP.stem, monthBranch)
  const normalizedHour = normalizeHourInput(hourValue)
  const adjustedDate = normalizedHour?.dayOffset ? shiftDate(year, month, day, 1) : { year, month, day }
  const dayP = getDayPillar(adjustedDate.year, adjustedDate.month, adjustedDate.day)
  const voidBr = getVoidBranches(dayP.sexagenary)
  const dayStem = dayP.stem

  const yearBranch = yearP.branch

  function makePillar(stem: number, branch: number, isDayMaster: boolean): Pillar {
    const mainHidden = getMainHiddenStem(branch)
    return {
      stem,
      branch,
      stemChar: STEMS[stem],
      stemKo: STEM_KO[stem],
      branchChar: BRANCHES[branch],
      branchKo: BRANCH_KO[branch],
      stemElement: STEM_ELEMENT[stem],
      branchElement: BRANCH_ELEMENT[branch],
      tenGodStem: isDayMaster ? '일원' : getTenGod(dayStem, stem),
      tenGodBranch: getTenGod(dayStem, mainHidden),
      hiddenStems: getHiddenStemsDisplay(branch),
      twelveStage: getTwelveStage(dayStem, branch),
      twelveSpirit: getTwelveSpirit(yearBranch, branch),
      isVoid: voidBr.includes(branch),
    }
  }

  let hourPillar: Pillar | null = null
  if (normalizedHour) {
    const hourBranch = normalizedHour.hourBranch
    const hourP = getHourPillar(dayStem, hourBranch)
    hourPillar = makePillar(hourP.stem, hourP.branch, false)
  }

  return {
    yearPillar: makePillar(yearP.stem, yearP.branch, false),
    monthPillar: makePillar(monthP.stem, monthBranch, false),
    dayPillar: makePillar(dayP.stem, dayP.branch, true),
    hourPillar,
    voidBranches: voidBr,
    sajuYear,
  }
}

/** 오행 분석: 사주 내 각 오행의 천간/지지 개수 */
export function analyzeElements(result: SajuResult): { element: number; name: string; hanja: string; count: number }[] {
  const counts = [0, 0, 0, 0, 0]
  const pillars = [result.yearPillar, result.monthPillar, result.dayPillar]
  if (result.hourPillar) pillars.push(result.hourPillar)

  for (const p of pillars) {
    counts[p.stemElement]++
    counts[p.branchElement]++
  }

  return counts.map((count, i) => ({
    element: i,
    name: ELEMENTS_KO[i],
    hanja: ELEMENTS_HANJA[i],
    count,
  }))
}

// ============================================================
// 조후 분석 (온도·습도)
// ============================================================

export interface JohuResult {
  season: string          // 봄 / 여름 / 가을 / 겨울
  monthBranch: number     // 월지 인덱스
  temperature: string     // 뜨거움 / 따뜻함 / 서늘함 / 차가움
  humidity: string        // 습함 / 보통 / 건조함
  neededElement: string   // 필요한 오행
  neededHanja: string
  hasNeeded: boolean      // 사주에 필요한 오행이 있는지
  neededCount: number     // 필요 오행 개수
  summary: string         // 요약 설명
  detail: string          // 상세 설명
}

const SEASON_MAP: Record<number, { season: string; temp: string; humid: string; need: number; needName: string; needHanja: string }> = {
  // 인월(2), 묘월(3), 진월(4) = 봄
  2:  { season: '봄', temp: '따뜻함', humid: '습함', need: 1, needName: '화', needHanja: '火' },
  3:  { season: '봄', temp: '따뜻함', humid: '보통', need: 3, needName: '금', needHanja: '金' },
  4:  { season: '봄', temp: '따뜻함', humid: '습함', need: 4, needName: '수', needHanja: '水' },
  // 사월(5), 오월(6), 미월(7) = 여름
  5:  { season: '여름', temp: '뜨거움', humid: '건조함', need: 4, needName: '수', needHanja: '水' },
  6:  { season: '여름', temp: '뜨거움', humid: '건조함', need: 4, needName: '수', needHanja: '水' },
  7:  { season: '여름', temp: '뜨거움', humid: '습함', need: 4, needName: '수', needHanja: '水' },
  // 신월(8), 유월(9), 술월(10) = 가을
  8:  { season: '가을', temp: '서늘함', humid: '건조함', need: 1, needName: '화', needHanja: '火' },
  9:  { season: '가을', temp: '서늘함', humid: '건조함', need: 1, needName: '화', needHanja: '火' },
  10: { season: '가을', temp: '서늘함', humid: '건조함', need: 4, needName: '수', needHanja: '水' },
  // 해월(11), 자월(0), 축월(1) = 겨울
  11: { season: '겨울', temp: '차가움', humid: '습함', need: 1, needName: '화', needHanja: '火' },
  0:  { season: '겨울', temp: '차가움', humid: '습함', need: 1, needName: '화', needHanja: '火' },
  1:  { season: '겨울', temp: '차가움', humid: '습함', need: 1, needName: '화', needHanja: '火' },
}

export function analyzeJohu(result: SajuResult): JohuResult {
  const mb = result.monthPillar.branch
  const info = SEASON_MAP[mb]
  const elements = analyzeElements(result)
  const neededCount = elements[info.need].count
  const hasNeeded = neededCount > 0

  const dayStemKo = result.dayPillar.stemKo
  const dayStemEl = ELEMENTS_KO[STEM_ELEMENT[result.dayPillar.stem]]

  let summary: string
  let detail: string

  if (info.season === '여름') {
    if (hasNeeded) {
      summary = `여름 태생으로 뜨겁지만, 사주에 水(수)가 ${neededCount}개 있어 열기를 식혀주고 있어요.`
      detail = `${dayStemKo}(${dayStemEl}) 일간이 한여름에 태어났어요. 뜨거운 계절이지만 다행히 수(水) 기운이 ${neededCount}개 있어서 조후가 어느 정도 맞아요. 열정에 지혜가 더해져 균형 잡힌 에너지를 발휘할 수 있어요.`
    } else {
      summary = `여름 태생으로 뜨겁고, 사주에 水(수)가 없어서 열기를 식힐 장치가 부족해요.`
      detail = `${dayStemKo}(${dayStemEl}) 일간이 한여름에 태어났는데 수(水) 기운이 전혀 없어요. 사막에 물이 없는 상태와 같아서, 급한 성격이나 에너지 소진이 걱정돼요. 수(水)와 관련된 활동(수영, 명상, 차분한 시간)이 도움이 될 수 있어요.`
    }
  } else if (info.season === '겨울') {
    if (hasNeeded) {
      summary = `겨울 태생으로 차갑지만, 사주에 火(화)가 ${neededCount}개 있어 따뜻하게 녹여주고 있어요.`
      detail = `${dayStemKo}(${dayStemEl}) 일간이 한겨울에 태어났어요. 차가운 계절이지만 화(火) 기운이 ${neededCount}개 있어서 얼음을 녹여줘요. 차분한 지혜에 따뜻한 열정이 더해져 좋은 균형이에요.`
    } else {
      summary = `겨울 태생으로 차갑고, 사주에 火(화)가 없어서 온기가 부족해요.`
      detail = `${dayStemKo}(${dayStemEl}) 일간이 한겨울에 태어났는데 화(火) 기운이 전혀 없어요. 꽁꽁 얼어붙은 상태라 행동력이 약하고 소극적일 수 있어요. 운동이나 활동적인 취미, 따뜻한 환경이 조후를 보완해줄 수 있어요.`
    }
  } else if (info.season === '봄') {
    if (mb === 2) {
      summary = hasNeeded
        ? `초봄 태생으로 아직 찬기가 남아있지만, 火(화)가 ${neededCount}개 있어 따뜻하게 도와줘요.`
        : `초봄 태생으로 겨울 한기가 남아있는데, 火(화)가 없어 아직 쌀쌀한 상태예요.`
      detail = hasNeeded
        ? `${dayStemKo}(${dayStemEl}) 일간이 초봄에 태어났어요. 봄이 시작되었지만 겨울 추위가 남아 있어 화(火)의 따뜻함이 필요해요. 다행히 ${neededCount}개의 화 기운이 있어서 성장 에너지를 잘 받고 있어요.`
        : `${dayStemKo}(${dayStemEl}) 일간이 초봄에 태어났는데 화(火) 기운이 없어요. 봄이지만 아직 추위가 남아있어 시작의 에너지가 약할 수 있어요. 활동적인 환경이 도움이 돼요.`
    } else if (mb === 3) {
      summary = hasNeeded
        ? `한봄 태생으로 목(木)이 왕성한데, 金(금)이 ${neededCount}개 있어 적절히 다듬어줘요.`
        : `한봄 태생으로 목(木) 기운이 넘치는데, 金(금)이 없어 가지치기가 필요해요.`
      detail = hasNeeded
        ? `${dayStemKo}(${dayStemEl}) 일간이 봄 한가운데 태어났어요. 나무 기운이 왕성한 계절인데 금(金)이 ${neededCount}개 있어서 과한 성장을 적절히 조절해줘요. 균형 잡힌 조후예요.`
        : `${dayStemKo}(${dayStemEl}) 일간이 봄 한가운데 태어났는데 금(金) 기운이 없어요. 나무가 무성하기만 하고 가지치기가 안 되는 상태라, 방향성 없이 에너지가 분산될 수 있어요.`
    } else {
      summary = hasNeeded
        ? `늦봄 태생으로 습해지는 시기인데, 水(수)가 ${neededCount}개 있어 촉촉함을 유지해줘요.`
        : `늦봄 태생으로 점점 더워지는데, 水(수)가 없어 건조해지고 있어요.`
      detail = hasNeeded
        ? `${dayStemKo}(${dayStemEl}) 일간이 늦봄에 태어났어요. 여름으로 가는 길목인데 수(水)가 ${neededCount}개 있어서 수분을 유지해주고 있어요. 적절한 조후 상태예요.`
        : `${dayStemKo}(${dayStemEl}) 일간이 늦봄에 태어났는데 수(水)가 없어요. 점점 더워지는 시기에 수분 공급이 안 되는 상태라, 감정 조절에 신경 쓰면 좋아요.`
    }
  } else {
    // 가을
    if (mb === 10) {
      summary = hasNeeded
        ? `늦가을 태생으로 추워지고 있는데, 水(수)가 ${neededCount}개 있어 금(金)을 윤택하게 해줘요.`
        : `늦가을 태생으로 차가워지는데, 水(수)가 없어 건조하고 메마른 상태예요.`
      detail = hasNeeded
        ? `${dayStemKo}(${dayStemEl}) 일간이 늦가을에 태어났어요. 수(水)가 ${neededCount}개 있어서 금의 기운을 부드럽게 다듬어줘요.`
        : `${dayStemKo}(${dayStemEl}) 일간이 늦가을에 태어났는데 수(水)가 없어요. 금속이 건조한 상태라 날카롭기만 하고 윤기가 부족할 수 있어요.`
    } else {
      summary = hasNeeded
        ? `가을 태생으로 서늘한데, 火(화)가 ${neededCount}개 있어 금(金)을 제련해줘요.`
        : `가을 태생으로 서늘한데, 火(화)가 없어 차갑고 날카롭기만 한 상태예요.`
      detail = hasNeeded
        ? `${dayStemKo}(${dayStemEl}) 일간이 가을에 태어났어요. 화(火)가 ${neededCount}개 있어서 서늘한 금속을 따뜻하게 제련해줘요. 대장장이의 불처럼 강한 추진력에 따뜻함까지 갖춰요.`
        : `${dayStemKo}(${dayStemEl}) 일간이 가을에 태어났는데 화(火)가 없어요. 금속이 차갑기만 해서 날카로움만 있고 따뜻함이 부족할 수 있어요. 열정적인 활동이 보완해줄 수 있어요.`
    }
  }

  return {
    season: info.season,
    monthBranch: mb,
    temperature: info.temp,
    humidity: info.humid,
    neededElement: info.needName,
    neededHanja: info.needHanja,
    hasNeeded,
    neededCount,
    summary,
    detail,
  }
}

// ============================================================
// 신강/신약 분석 (일간 강약)
// ============================================================

export interface SingangResult {
  score: number          // 내 편 점수 (0~100)
  level: string          // 극신강 / 신강 / 중화 / 신약 / 극신약
  label: string          // 표시 라벨
  summary: string
  detail: string
  myScore: number        // 내 편 점수 (원점수)
  otherScore: number     // 상대 점수
}

// 지장간 가중치: 정기 1.0, 중기 0.5, 여기 0.3
function getJijangganScores(branchIdx: number): { stem: number; weight: number }[] {
  const arr = JIJANGGAN[branchIdx]
  if (arr.length === 1) return [{ stem: arr[0], weight: 1.0 }]
  if (arr.length === 2) return [
    { stem: arr[0], weight: 0.3 },
    { stem: arr[1], weight: 1.0 },
  ]
  return [
    { stem: arr[0], weight: 0.3 },
    { stem: arr[1], weight: 0.5 },
    { stem: arr[2], weight: 1.0 },
  ]
}

export function analyzeSingang(result: SajuResult): SingangResult {
  const dayStem = result.dayPillar.stem
  const dayEl = Math.floor(dayStem / 2) // 일간의 오행 (0=목 1=화 2=토 3=금 4=수)

  // 나를 생해주는 오행 (인성)
  const parentEl = ((dayEl - 1) % 5 + 5) % 5

  // 점수 계산: 월지 가중치 1.5, 일지 1.2, 나머지 1.0
  let myScore = 0
  let otherScore = 0

  function addScore(stemOrEl: number, weight: number, isStemElement: boolean) {
    const el = isStemElement ? stemOrEl : Math.floor(stemOrEl / 2)
    if (el === dayEl || el === parentEl) {
      myScore += weight
    } else {
      otherScore += weight
    }
  }

  // 천간 점수 (일간 자신 제외)
  const pillars = [result.yearPillar, result.monthPillar, result.dayPillar]
  if (result.hourPillar) pillars.push(result.hourPillar)

  for (const p of pillars) {
    // 천간 (일간 자신은 제외)
    if (p !== result.dayPillar) {
      addScore(p.stem, 1.0, false)
    }
  }

  // 지지 점수 (지장간 기반, 월지 1.5배, 일지 1.2배)
  for (const p of pillars) {
    const multiplier = p === result.monthPillar ? 1.5
                     : p === result.dayPillar ? 1.2
                     : 1.0
    const jjg = getJijangganScores(p.branch)
    for (const { stem, weight } of jjg) {
      addScore(stem, weight * multiplier, false)
    }
  }

  // 월령 득령 보너스: 월지 본기가 나와 같은 오행이거나 인성이면 +1.5
  const monthMainHidden = getMainHiddenStem(result.monthPillar.branch)
  const monthMainEl = Math.floor(monthMainHidden / 2)
  if (monthMainEl === dayEl || monthMainEl === parentEl) {
    myScore += 1.5
  }

  const total = myScore + otherScore
  const pct = total > 0 ? Math.round((myScore / total) * 100) : 50

  let level: string
  let label: string
  if (pct >= 75) { level = '극신강'; label = '극신강 (매우 강함)' }
  else if (pct >= 58) { level = '신강'; label = '신강 (강함)' }
  else if (pct >= 42) { level = '중화'; label = '중화 (균형)' }
  else if (pct >= 25) { level = '신약'; label = '신약 (약함)' }
  else { level = '극신약'; label = '극신약 (매우 약함)' }

  const dayStemKo = result.dayPillar.stemKo
  const dayStemElName = ELEMENTS_KO[STEM_ELEMENT[dayStem]]

  let summary: string
  let detail: string

  if (level === '극신강') {
    summary = `일간 ${dayStemKo}(${dayStemElName})의 기운이 매우 강해요. 넘치는 에너지를 분출할 출구가 필요해요.`
    detail = `내 편(비겁+인성) ${pct}% vs 상대(식상+재성+관성) ${100 - pct}%로, 일간의 힘이 압도적이에요. 마치 5000cc 엔진에 짐이 없는 레이싱카 같아요. 이렇게 강할 때는 식상(표현·재능)이나 재성(재물·목표)으로 에너지를 쏟아야 해요. 비겁·인성이 더 오면 오히려 힘만 넘치고 쓸 곳이 없어 충돌이 생길 수 있어요.`
  } else if (level === '신강') {
    summary = `일간 ${dayStemKo}(${dayStemElName})의 기운이 강한 편이에요. 자립심이 강하고 추진력이 있어요.`
    detail = `내 편 ${pct}% vs 상대 ${100 - pct}%로, 일간에 힘이 실려 있어요. 큰 목표를 향해 돌진할 수 있는 에너지가 있어요. 재성(재물)이나 관성(직장·명예)을 감당할 힘이 충분해서, 도전적인 목표를 세우면 좋아요. 자수성가형이 많은 구조예요.`
  } else if (level === '중화') {
    summary = `일간 ${dayStemKo}(${dayStemElName})의 기운이 균형 잡혀 있어요. 가장 이상적인 상태예요!`
    detail = `내 편 ${pct}% vs 상대 ${100 - pct}%로, 거의 균형이 맞아요. 엔진 크기와 짐의 무게가 적당한 상태라, 어떤 환경에서든 무난하게 적응할 수 있어요. 특별히 보완할 것 없이 자기 길을 꾸준히 가면 좋은 결과를 얻을 수 있는 구조예요.`
  } else if (level === '신약') {
    summary = `일간 ${dayStemKo}(${dayStemElName})의 기운이 약한 편이에요. 주변의 도움이 힘이 돼요.`
    detail = `내 편 ${pct}% vs 상대 ${100 - pct}%로, 일간의 힘이 다소 부족해요. 경차에 짐이 좀 많은 상태예요. 인성(학문·도움)이나 비겁(동료·형제)의 지원이 있으면 힘을 발휘할 수 있어요. 귀인을 잘 만나고, 배움과 자기개발에 투자하면 좋아요.`
  } else {
    summary = `일간 ${dayStemKo}(${dayStemElName})의 기운이 매우 약해요. 환경에 몸을 맡기는 지혜가 필요해요.`
    detail = `내 편 ${pct}% vs 상대 ${100 - pct}%로, 일간의 힘이 많이 부족해요. 작은 돛단배 같은 상태라 바람(환경)에 몸을 맡기는 게 오히려 유리해요. 극신약의 경우 오히려 식상·재성·관성이 좋게 작용할 수 있어요. 무리하게 자기 힘으로 하려 하기보다 흐름을 타는 전략이 필요해요.`
  }

  return { score: pct, level, label, summary, detail, myScore, otherScore }
}

// ============================================================
// 형충파해 (지지 상호작용)
// ============================================================

export interface BranchInteraction {
  type: '충' | '형' | '파' | '해' | '원진'
  typeName: string
  branches: [number, number]
  pillars: [string, string]  // 예: ['년지', '일지']
  name: string
  desc: string
  severity: 'high' | 'medium' | 'low'
}

// 충 (Clash): 정반대 위치의 지지 — 6쌍
const CHUNG_PAIRS: [number, number, string, string][] = [
  [0, 6, '자오충', '자(水)와 오(火)의 충돌이야. 물과 불의 정면충돌로, 감정과 이성 사이의 갈등을 나타내. 심리적 불안이나 이사·이직 등 큰 변화가 생길 수 있어.'],
  [1, 7, '축미충', '축(土)과 미(土)의 충돌이야. 같은 토끼리의 충이라 격렬하진 않지만, 고민과 갈등이 내면에서 일어나. 재산이나 부동산 관련 변동이 생길 수 있어.'],
  [2, 8, '인신충', '인(木)과 신(金)의 충돌이야. 나무와 쇠의 부딪힘으로 매우 강렬해. 교통사고나 수술, 직장 변동 등 큰 충격이 올 수 있어. 하지만 변화 속에 성장의 기회도 있어.'],
  [3, 9, '묘유충', '묘(木)와 유(金)의 충돌이야. 인신충보다는 약하지만 날카로운 충이야. 인간관계 갈등, 특히 연인이나 부부 사이 충돌이 일어날 수 있어.'],
  [4, 10, '진술충', '진(土)과 술(土)의 충돌이야. "화개충"이라고도 해. 창고(묘고)끼리 부딪혀 열리는 충이라, 재물이 풀리거나 학문적 전환이 생길 수 있어.'],
  [5, 11, '사해충', '사(火)와 해(水)의 충돌이야. 역마성이 있어서 이동·출장·해외 관련 변동이 크게 일어날 수 있어. 여행과 변화의 충이야.'],
]

// 형 (Punishment) — 삼형살 + 자형
const HYUNG_PAIRS: [number, number, string, string][] = [
  [2, 5, '인사형(무은지형)', '은혜를 원수로 갚는 형이야. 도와줬는데 배신당하거나, 믿었던 사람에게 상처받을 수 있어. 인간관계에서 기대를 줄이는 게 좋아.'],
  [5, 8, '사신형(무은지형)', '사(巳)와 신(申)의 형벌이야. 지략과 실행력이 충돌해서 판단 착오가 생길 수 있어. 문서나 계약 관련 실수에 주의해야 해.'],
  [2, 8, '인신형(무은지형)', '인(寅)과 신(申)의 형벌(충과 겹침)이야. 가장 강렬한 형 중 하나로, 직업적 변동이나 건강 문제에 주의가 필요해.'],
  [1, 10, '축술형(무례지형)', '예의 없는 형이야. 축(丑)과 술(戌)이 부딪혀 고집과 고집이 충돌해. 가족간 갈등이나 재산 분쟁이 생길 수 있어.'],
  [10, 7, '술미형(무례지형)', '술(戌)과 미(未)의 형벌이야. 두 토(土)가 부딪혀 답답함이 극대화돼. 우유부단함이나 결정장애로 기회를 놓칠 수 있어.'],
  [1, 7, '축미형(무례지형)', '축(丑)과 미(未)의 형벌(충과 겹침)이야. 내면의 갈등과 걱정이 깊어질 수 있어.'],
  [0, 3, '자묘형(무례지형)', '자(子)와 묘(卯)의 형벌이야. 예절을 어기는 형으로, 이성 문제나 예상치 못한 스캔들에 주의해야 해.'],
]

// 파 (Destruction)
const PA_PAIRS: [number, number, string, string][] = [
  [0, 9, '자유파', '계획이 깨지거나 기대가 무너지는 기운이야. 약속 파기나 사업 실패에 주의해.'],
  [1, 4, '축진파', '느리지만 확실한 파괴야. 서서히 균열이 생겨 결국 깨지는 형태야.'],
  [2, 11, '인해파', '도움을 주려다 오히려 관계가 파탄나는 기운이야. 선의가 오해를 부를 수 있어.'],
  [3, 6, '묘오파', '감정적 충돌로 관계가 깨지는 기운이야. 말실수나 오해에 주의해.'],
  [5, 8, '사신파', '지혜와 실행의 충돌이야. 전략이 꼬이거나 뜻대로 안 될 수 있어.'],
  [7, 10, '미술파', '고집과 고집의 충돌이야. 양보 없는 대립이 생길 수 있어.'],
]

// 해 (Harm)
const HAE_PAIRS: [number, number, string, string][] = [
  [0, 7, '자미해', '보이지 않는 곳에서 손해가 생기는 기운이야. 뒤에서 험담이나 모략에 주의해.'],
  [1, 6, '축오해', '가까운 사람과의 관계에서 상처받을 수 있어. 기대와 실망의 반복에 주의.'],
  [2, 5, '인사해', '열정이 공회전하는 기운이야. 노력 대비 결과가 안 나올 수 있어.'],
  [3, 4, '묘진해', '작은 오해가 큰 갈등으로 번질 수 있어. 소통에 신경 써야 해.'],
  [8, 11, '신해해', '건강 관련 문제에 주의해야 해. 과로나 스트레스 관리가 중요해.'],
  [9, 10, '유술해', '자존심 싸움이 관계를 망칠 수 있어. 양보와 타협이 필요한 기운이야.'],
]

export function analyzeInteractions(result: SajuResult): BranchInteraction[] {
  const branches: { branch: number; name: string }[] = [
    { branch: result.yearPillar.branch, name: '년지' },
    { branch: result.monthPillar.branch, name: '월지' },
    { branch: result.dayPillar.branch, name: '일지' },
  ]
  if (result.hourPillar) branches.push({ branch: result.hourPillar.branch, name: '시지' })

  const interactions: BranchInteraction[] = []

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i], b = branches[j]

      // 충
      for (const [b1, b2, name, desc] of CHUNG_PAIRS) {
        if ((a.branch === b1 && b.branch === b2) || (a.branch === b2 && b.branch === b1)) {
          interactions.push({ type: '충', typeName: '충(冲)', branches: [a.branch, b.branch], pillars: [a.name, b.name], name, desc, severity: 'high' })
        }
      }

      // 형
      for (const [b1, b2, name, desc] of HYUNG_PAIRS) {
        if ((a.branch === b1 && b.branch === b2) || (a.branch === b2 && b.branch === b1)) {
          interactions.push({ type: '형', typeName: '형(刑)', branches: [a.branch, b.branch], pillars: [a.name, b.name], name, desc, severity: 'medium' })
        }
      }

      // 파
      for (const [b1, b2, name, desc] of PA_PAIRS) {
        if ((a.branch === b1 && b.branch === b2) || (a.branch === b2 && b.branch === b1)) {
          interactions.push({ type: '파', typeName: '파(破)', branches: [a.branch, b.branch], pillars: [a.name, b.name], name, desc, severity: 'low' })
        }
      }

      // 해
      for (const [b1, b2, name, desc] of HAE_PAIRS) {
        if ((a.branch === b1 && b.branch === b2) || (a.branch === b2 && b.branch === b1)) {
          interactions.push({ type: '해', typeName: '해(害)', branches: [a.branch, b.branch], pillars: [a.name, b.name], name, desc, severity: 'medium' })
        }
      }
    }
  }

  return interactions
}

// ============================================================
// 용신 (Yongshin — 유리한 오행)
// ============================================================

const ELEMENT_COLORS: Record<number, string> = { 0: '초록색/청색', 1: '빨간색/보라색', 2: '노란색/갈색', 3: '흰색/은색', 4: '검은색/파란색' }
const ELEMENT_DIRECTIONS: Record<number, string> = { 0: '동쪽', 1: '남쪽', 2: '중앙', 3: '서쪽', 4: '북쪽' }
const ELEMENT_SEASONS: Record<number, string> = { 0: '봄', 1: '여름', 2: '환절기', 3: '가을', 4: '겨울' }
const ELEMENT_CAREERS: Record<number, string[]> = {
  0: ['교육', '출판', '의류', '목재', '농업', '환경'],
  1: ['IT', '전자', '에너지', '요식업', '엔터테인먼트', '마케팅'],
  2: ['부동산', '건축', '농업', '중개', '요식업', '공무원'],
  3: ['금융', '법률', '자동차', '기계', '의료기기', '보석'],
  4: ['무역', '물류', '수산', '관광', '미디어', '주류'],
}

export interface YongshinResult {
  yongshin: number      // 용신 오행 인덱스
  yongshinName: string  // 예: '수(水)'
  gishin: number        // 기신 오행 인덱스
  gishinName: string
  colors: string
  direction: string
  season: string
  careers: string[]
  summary: string
  detail: string
}

export function determineYongshin(result: SajuResult, singang: SingangResult, johu: JohuResult): YongshinResult {
  const dayStem = result.dayPillar.stem
  const dayEl = Math.floor(dayStem / 2)

  // 오행 관계: 나를 생하는(인성), 나와 같은(비겁), 내가 생하는(식상), 내가 극하는(재성), 나를 극하는(관성)
  const parentEl = ((dayEl - 1) % 5 + 5) % 5   // 인성
  const childEl = (dayEl + 1) % 5               // 식상
  const wealthEl = (dayEl + 2) % 5              // 재성
  const officerEl = ((dayEl - 2) % 5 + 5) % 5   // 관성

  let ys: number  // 용신
  let gs: number  // 기신

  if (singang.level === '극신강') {
    // 극신강: 식상 > 재성 > 관성 순으로 좋음
    ys = childEl
    gs = parentEl
  } else if (singang.level === '신강') {
    // 신강: 재성 > 관성 > 식상 순으로 좋음 (에너지 분출)
    ys = wealthEl
    gs = parentEl
  } else if (singang.level === '중화') {
    // 중화: 조후 용신 우선
    const johuEl = ELEMENTS_KO.indexOf(johu.neededElement as typeof ELEMENTS_KO[number])
    ys = johuEl >= 0 ? johuEl : dayEl
    gs = -1
  } else if (singang.level === '신약') {
    // 신약: 인성 > 비겁 순으로 좋음 (힘을 키움)
    ys = parentEl
    gs = officerEl
  } else {
    // 극신약: 재성 > 관성 > 식상 (종격, 역용)
    ys = wealthEl
    gs = parentEl
  }

  // 조후와 교차 검증: 조후가 급할 때 조후 용신 우선
  const johuElIdx = ELEMENTS_KO.indexOf(johu.neededElement as typeof ELEMENTS_KO[number])
  if (!johu.hasNeeded && johuElIdx >= 0 && singang.level !== '극신강' && singang.level !== '극신약') {
    ys = johuElIdx
  }

  if (gs < 0) {
    // 중화에서 기신: 가장 과한 오행
    const elCounts = analyzeElements(result)
    gs = elCounts.reduce((max, e) => e.count > (elCounts[max]?.count ?? 0) ? e.element : max, 0)
    if (gs === ys) gs = (gs + 1) % 5
  }

  const ysName = `${ELEMENTS_KO[ys]}(${ELEMENTS_HANJA[ys]})`
  const gsName = `${ELEMENTS_KO[gs]}(${ELEMENTS_HANJA[gs]})`

  const summary = `당신의 용신(가장 유리한 오행)은 ${ysName}이에요!`
  const detail = `${singang.level === '중화' ? '균형 잡힌 사주라' : singang.level.includes('신강') ? '기운이 강한 사주라 에너지를 분출할 출구가 필요해서' : '기운이 약한 사주라 힘을 키워줄 에너지가 필요해서'} ${ysName}이 용신이에요.${!johu.hasNeeded && johuElIdx >= 0 ? ` 특히 ${johu.season}에 태어나 ${ELEMENTS_HANJA[johuElIdx]}(${ELEMENTS_KO[johuElIdx]})의 조후 보완이 급해서 이를 우선했어요.` : ''} 반대로 기신(피해야 할 오행)은 ${gsName}이에요.`

  return {
    yongshin: ys,
    yongshinName: ysName,
    gishin: gs,
    gishinName: gsName,
    colors: ELEMENT_COLORS[ys],
    direction: ELEMENT_DIRECTIONS[ys],
    season: ELEMENT_SEASONS[ys],
    careers: ELEMENT_CAREERS[ys],
    summary,
    detail,
  }
}

// ============================================================
// 대운 (10년 주기 대운)
// ============================================================

export interface DaeunPeriod {
  stem: number
  branch: number
  stemChar: string
  stemKo: string
  branchChar: string
  branchKo: string
  startAge: number
  endAge: number
  tenGod: string
  twelveStage: string
}

/** 대운 계산 */
export function calculateDaeun(
  monthStem: number,
  monthBranch: number,
  gender: 'male' | 'female',
  yearStem: number,
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  dayStem: number,
): DaeunPeriod[] {
  // 순행/역행 결정: 양남음여 = 순행, 음남양녀 = 역행
  const isYangYear = yearStem % 2 === 0
  const isMale = gender === 'male'
  const forward = (isYangYear && isMale) || (!isYangYear && !isMale)

  // 대운 시작 나이 계산: 생일~다음(또는 이전) 절기까지 일수 / 3
  const birthJdn = getJulianDayNumber(birthYear, birthMonth, birthDay)

  // 절기 목록을 날짜 순서로 펼침 (해당 년도 ± 1년)
  const termDates: { jdn: number }[] = []
  for (let y = birthYear - 1; y <= birthYear + 1; y++) {
    for (const t of SOLAR_TERM_BOUNDARIES) {
      termDates.push({ jdn: getJulianDayNumber(y, t.month, getSolarTermBoundaryDay(y, t)) })
    }
  }
  termDates.sort((a, b) => a.jdn - b.jdn)

  let dayDiff = 30 // 기본값
  if (forward) {
    const next = termDates.find(t => t.jdn > birthJdn)
    if (next) dayDiff = next.jdn - birthJdn
  } else {
    const prev = [...termDates].reverse().find(t => t.jdn < birthJdn)
    if (prev) dayDiff = birthJdn - prev.jdn
  }

  const startAge = Math.max(1, Math.round(dayDiff / 3))

  // 월주의 60갑자 번호 계산
  const monthSexagenary = ((36 * monthStem + 25 * monthBranch) % 60 + 60) % 60

  const periods: DaeunPeriod[] = []
  for (let i = 1; i <= 8; i++) {
    const sex = forward
      ? (monthSexagenary + i) % 60
      : ((monthSexagenary - i) % 60 + 60) % 60
    const stem = sex % 10
    const branch = sex % 12
    periods.push({
      stem,
      branch,
      stemChar: STEMS[stem],
      stemKo: STEM_KO[stem],
      branchChar: BRANCHES[branch],
      branchKo: BRANCH_KO[branch],
      startAge: startAge + (i - 1) * 10,
      endAge: startAge + i * 10 - 1,
      tenGod: getTenGod(dayStem, stem),
      twelveStage: getTwelveStage(dayStem, branch),
    })
  }

  return periods
}

// ============================================================
// 세운 (올해 운세)
// ============================================================

export interface SeunResult {
  year: number
  stem: number
  branch: number
  stemChar: string
  stemKo: string
  branchChar: string
  branchKo: string
  tenGodStem: string
  tenGodBranch: string
  twelveStage: string
  twelveSpirit: string
  summary: string
}

export function calculateSeun(currentYear: number, dayStem: number, yearBranch: number): SeunResult {
  const p = getYearPillar(currentYear)
  const mainHidden = getMainHiddenStem(p.branch)
  const tenGodStem = getTenGod(dayStem, p.stem)
  const tenGodBranch = getTenGod(dayStem, mainHidden)
  const twelveStage = getTwelveStage(dayStem, p.branch)
  const twelveSpirit = getTwelveSpirit(yearBranch, p.branch)

  // 간단한 요약 생성
  const stemEl = ELEMENTS_HANJA[STEM_ELEMENT[p.stem]]
  const branchEl = ELEMENTS_HANJA[BRANCH_ELEMENT[p.branch]]
  const summary = `${currentYear}년은 ${STEMS[p.stem]}${BRANCHES[p.branch]}(${STEM_KO[p.stem]}${BRANCH_KO[p.branch]})년으로, ${stemEl}·${branchEl}의 기운이 흐르는 해입니다. 일간 기준 ${tenGodStem}과 ${tenGodBranch}의 영향을 받으며, ${TWELVE_STAGE_DESC[twelveStage] ?? ''}.`

  return {
    year: currentYear,
    stem: p.stem,
    branch: p.branch,
    stemChar: STEMS[p.stem],
    stemKo: STEM_KO[p.stem],
    branchChar: BRANCHES[p.branch],
    branchKo: BRANCH_KO[p.branch],
    tenGodStem,
    tenGodBranch,
    twelveStage,
    twelveSpirit,
    summary,
  }
}

// ============================================================
// 월운 (올해 12개월 운세)
// ============================================================

export interface MonthlyFortune {
  month: number        // 1~12 (양력 월)
  stem: number
  branch: number
  stemChar: string
  stemKo: string
  branchChar: string
  branchKo: string
  tenGod: string
  twelveStage: string
  elementName: string
  elementHanja: string
}

export function calculateMonthlyFortunes(
  currentYear: number,
  dayStem: number,
): MonthlyFortune[] {
  const results: MonthlyFortune[] = []

  for (let m = 1; m <= 12; m++) {
    // 해당 월의 절기 기준 월지 판단
    // 절입일 이후를 기준으로 하되, 간략하게 월 중순으로 추정
    const sajuYearForMonth = getSajuYear(currentYear, m, 15)
    const yearP = getYearPillar(sajuYearForMonth)
    const monthBranch = getSajuMonthBranchForDate(currentYear, m, 15)
    const monthP = getMonthPillar(yearP.stem, monthBranch)

    const mainHidden = getMainHiddenStem(monthP.branch)
    const tenGod = getTenGod(dayStem, mainHidden)
    const twelveStage = getTwelveStage(dayStem, monthP.branch)
    const el = BRANCH_ELEMENT[monthP.branch]

    results.push({
      month: m,
      stem: monthP.stem,
      branch: monthP.branch,
      stemChar: STEMS[monthP.stem],
      stemKo: STEM_KO[monthP.stem],
      branchChar: BRANCHES[monthP.branch],
      branchKo: BRANCH_KO[monthP.branch],
      tenGod,
      twelveStage,
      elementName: ELEMENTS_KO[el],
      elementHanja: ELEMENTS_HANJA[el],
    })
  }

  return results
}

// ============================================================
// 대운/세운 원국 상호작용 분석
// ============================================================

export interface PeriodInteraction {
  type: '합' | '충' | '형'
  name: string
  pillar: string  // 예: '일지', '년지'
  brief: string   // 짧은 설명
}

export interface PeriodAnalysis {
  interactions: PeriodInteraction[]
  bringsYongshin: boolean
  bringsGishin: boolean
  rating: 'great' | 'good' | 'neutral' | 'caution' | 'warning'
  narrative: string
}

// 지지육합 간단 버전 (궁합용 데이터 재사용)
const YUKHAP_SIMPLE: [number, number, string][] = [
  [0, 1, '자축합'], [2, 11, '인해합'], [3, 10, '묘술합'],
  [4, 9, '진유합'], [5, 8, '사신합'], [6, 7, '오미합'],
]

function findBranchInteractions(incomingBranch: number, natalBranches: { branch: number; name: string }[]): PeriodInteraction[] {
  const result: PeriodInteraction[] = []

  for (const nb of natalBranches) {
    // 충
    for (const [b1, b2, name] of CHUNG_PAIRS) {
      if ((incomingBranch === b1 && nb.branch === b2) || (incomingBranch === b2 && nb.branch === b1)) {
        result.push({ type: '충', name, pillar: nb.name, brief: `${nb.name}과 ${name}으로 큰 변화가 예상돼요` })
      }
    }
    // 합
    for (const [b1, b2, name] of YUKHAP_SIMPLE) {
      if ((incomingBranch === b1 && nb.branch === b2) || (incomingBranch === b2 && nb.branch === b1)) {
        result.push({ type: '합', name, pillar: nb.name, brief: `${nb.name}과 ${name}으로 좋은 인연·기회가 생겨요` })
      }
    }
    // 형 (주요한 것만)
    for (const [b1, b2, name] of HYUNG_PAIRS) {
      if ((incomingBranch === b1 && nb.branch === b2) || (incomingBranch === b2 && nb.branch === b1)) {
        result.push({ type: '형', name, pillar: nb.name, brief: `${nb.name}과 ${name}으로 시련·갈등에 주의해요` })
      }
    }
  }

  return result
}

export function analyzePeriodInteraction(
  incomingStem: number,
  incomingBranch: number,
  result: SajuResult,
  yongshin: number,
  gishin: number,
): PeriodAnalysis {
  const natalBranches = [
    { branch: result.yearPillar.branch, name: '년지' },
    { branch: result.monthPillar.branch, name: '월지' },
    { branch: result.dayPillar.branch, name: '일지' },
  ]
  if (result.hourPillar) natalBranches.push({ branch: result.hourPillar.branch, name: '시지' })

  const interactions = findBranchInteractions(incomingBranch, natalBranches)

  // 천간합 체크 (일간과)
  for (const [s1, s2, name] of CHEONGAN_HAP) {
    if ((result.dayPillar.stem === s1 && incomingStem === s2) || (result.dayPillar.stem === s2 && incomingStem === s1)) {
      interactions.unshift({ type: '합', name: name.split('(')[0], pillar: '일간', brief: `일간과 ${name}! 강한 인연의 시기예요` })
    }
  }

  // 용신/기신 체크
  const incomingEl = STEM_ELEMENT[incomingStem]
  const incomingBranchEl = BRANCH_ELEMENT[incomingBranch]
  const bringsYongshin = incomingEl === yongshin || incomingBranchEl === yongshin
  const bringsGishin = incomingEl === gishin || incomingBranchEl === gishin

  // 등급 판정
  const hasChung = interactions.some(i => i.type === '충')
  const hasHap = interactions.some(i => i.type === '합')
  const hasHyung = interactions.some(i => i.type === '형')

  let rating: PeriodAnalysis['rating']
  if (bringsYongshin && hasHap && !hasChung) rating = 'great'
  else if (bringsYongshin && !hasChung) rating = 'good'
  else if (hasChung && bringsGishin) rating = 'warning'
  else if (hasChung || hasHyung) rating = 'caution'
  else if (hasHap) rating = 'good'
  else rating = 'neutral'

  // 내러티브
  const parts: string[] = []
  if (bringsYongshin) parts.push(`용신인 ${ELEMENTS_HANJA[yongshin]}(${ELEMENTS_KO[yongshin]})이 들어와 힘이 되는 시기예요`)
  if (bringsGishin) parts.push(`기신인 ${ELEMENTS_HANJA[gishin]}(${ELEMENTS_KO[gishin]})이 들어와 주의가 필요해요`)
  for (const it of interactions) {
    parts.push(it.brief)
  }
  if (parts.length === 0) parts.push('특별한 충돌이나 합 없이 평탄한 흐름이에요')

  return {
    interactions,
    bringsYongshin,
    bringsGishin,
    rating,
    narrative: parts.join('. ') + '.',
  }
}

// ============================================================
// 궁합 비교
// ============================================================

export interface HapInfo {
  type: string       // '천간합' | '지지육합' | '지지삼합' | '지지방합' | '특수합'
  name: string       // 예: '갑기합(토)', '자축합(토)'
  desc: string       // 설명
  rating: 'great' | 'good' | 'neutral'
}

export interface CompatibilityResult {
  relation1to2: string  // A의 일간에서 본 B
  relation2to1: string  // B의 일간에서 본 A
  elementBalance: { element: number; name: string; hanja: string; countA: number; countB: number; total: number }[]
  missingElements: string[]
  haps: HapInfo[]       // 합 목록
  score: number         // 0~100
  summary: string
}

// --- 천간합 ---
// 갑기합(토), 을경합(금), 병신합(수), 정임합(목), 무계합(화)
const CHEONGAN_HAP: [number, number, string, string][] = [
  [0, 5, '갑기합(토)', '甲과 己가 만나 토(土)로 변하는 합이야. 리더(갑)와 관리자(기)가 만나 안정적인 땅의 기운을 만들어. 서로 부족한 부분을 채워주는 보완적 관계로, 실용적이고 안정적인 궁합이야.'],
  [1, 6, '을경합(금)', '乙과 庚이 만나 금(金)으로 변하는 합이야. 부드러운 꽃(을)과 강한 쇠(경)의 만남으로, "인의지합(仁義之合)"이라 불려. 서로 다른 매력에 끌리는 강렬한 인연이야.'],
  [2, 7, '병신합(수)', '丙과 辛이 만나 수(水)로 변하는 합이야. 태양(병)이 보석(신)을 비추면 찬란하게 빛나듯, 서로를 빛나게 해주는 합이야. 위엄과 아름다움의 조화로 "위제지합(威制之合)"이라 해.'],
  [3, 8, '정임합(목)', '丁과 壬이 만나 목(木)으로 변하는 합이야. 촛불(정)과 바다(임)의 만남으로, "음란지합(淫亂之合)"이라는 강렬한 별명이 있어. 서로에 대한 끌림이 매우 강하고 감정적으로 깊은 관계야.'],
  [4, 9, '무계합(화)', '戊와 癸가 만나 화(火)로 변하는 합이야. 산(무)에 이슬비(계)가 내리면 무지개가 피듯, "무정지합(無情之合)"이라고도 하지만 실은 묵묵하고 따뜻한 합이야.'],
]

// --- 지지육합 ---
// 자축합(토), 인해합(목), 묘술합(화), 진유합(금), 사신합(수), 오미합(화/토)
const JIJI_YUKHAP: [number, number, string, string][] = [
  [0, 1, '자축합(토)', '子와 丑이 만나 토(土)로 합해. 깊은 밤의 물(자)이 겨울 땅(축)과 만나 안정되는 합이야. 차분하고 내밀한 관계를 만들어.'],
  [2, 11, '인해합(목)', '寅과 亥가 만나 목(木)으로 합해. 호랑이(인)와 돼지(해)가 만나 나무의 기운을 만드는 합이야. 서로의 성장을 돕는 생산적인 관계야.'],
  [3, 10, '묘술합(화)', '卯와 戌이 만나 화(火)로 합해. 토끼(묘)와 개(술)의 만남으로 따뜻한 불의 기운이 생겨. 가정적이고 온화한 인연이야.'],
  [4, 9, '진유합(금)', '辰과 酉가 만나 금(金)으로 합해. 용(진)과 닭(유)의 만남으로 세련된 금의 기운이 만들어져. 서로를 다듬어주는 관계야.'],
  [5, 8, '사신합(수)', '巳와 申이 만나 수(水)로 합해. 뱀(사)과 원숭이(신)의 만남으로 지혜로운 물의 기운이 생겨. 영리한 조합이야.'],
  [6, 7, '오미합(화)', '午와 未가 만나 화(火)/토(土)로 합해. 말(오)과 양(미)의 만남으로 뜨겁고 정 깊은 관계야. 서로에 대한 애정이 깊어.'],
]

// --- 지지삼합 ---
const JIJI_SAMHAP: [number[], string, string][] = [
  [[2, 6, 10], '인오술 삼합(화)', '寅·午·戌이 모이면 화(火)의 삼합이야. 열정과 행동력이 합쳐져 강력한 추진력을 만들어.'],
  [[5, 9, 1], '사유축 삼합(금)', '巳·酉·丑이 모이면 금(金)의 삼합이야. 날카로운 판단력과 실행력이 합쳐져 결과를 만들어내는 조합이야.'],
  [[8, 0, 4], '신자진 삼합(수)', '申·子·辰이 모이면 수(水)의 삼합이야. 지혜와 유연함이 합쳐져 어떤 난관도 돌파하는 조합이야.'],
  [[11, 3, 7], '해묘미 삼합(목)', '亥·卯·未가 모이면 목(木)의 삼합이야. 성장과 인자함이 합쳐져 모두를 감싸는 따뜻한 조합이야.'],
]

// --- 특수합/궁합 ---
function findSpecialHaps(a: SajuResult, b: SajuResult): HapInfo[] {
  const specials: HapInfo[] = []
  const aStem = a.dayPillar.stem
  const bStem = b.dayPillar.stem

  // 등라계갑 (藤蘿繫甲): 을목 일간이 갑목을 만남 (넝쿨이 큰 나무를 감싸는 형상)
  if ((aStem === 1 && bStem === 0) || (aStem === 0 && bStem === 1)) {
    specials.push({
      type: '특수합',
      name: '등라계갑(藤蘿繫甲)',
      desc: '을목(넝쿨)이 갑목(큰 나무)을 감싸고 올라가는 형상이야. 부드러운 쪽이 강한 쪽에 의지하면서 함께 성장하는 아름다운 인연이야. 서로 같은 나무(木) 오행이라 통하는 게 많고, 을이 갑의 든든한 지지대가 되어주고 갑이 을을 높은 곳으로 데려가 줘.',
      rating: 'great',
    })
  }

  // 간여지동 (干與支同): 일주가 완전히 동일
  if (a.dayPillar.stem === b.dayPillar.stem && a.dayPillar.branch === b.dayPillar.branch) {
    specials.push({
      type: '특수합',
      name: '간여지동(干與支同)',
      desc: '두 사람의 일주(천간+지지)가 완전히 같아! 마치 쌍둥이처럼 생각과 행동 패턴이 비슷해서, 말 안 해도 통하는 경우가 많아. 다만 너무 비슷하면 부딪힐 수도 있어.',
      rating: 'good',
    })
  }

  // 천을귀인 (天乙貴人): 일간 기준 귀인 지지가 상대에게 있는지
  // 갑무→축미, 을기→자신, 병정→해유, 경신→인오, 임계→묘사
  const GUIIN: Record<number, number[]> = {
    0: [1, 7], 4: [1, 7],   // 갑, 무 → 축, 미
    1: [0, 8], 5: [0, 8],   // 을, 기 → 자, 신
    2: [11, 9], 3: [11, 9], // 병, 정 → 해, 유
    6: [2, 6], 7: [2, 6],   // 경, 신 → 인, 오
    8: [3, 5], 9: [3, 5],   // 임, 계 → 묘, 사
  }

  const aGuiin = GUIIN[aStem] ?? []
  const bGuiin = GUIIN[bStem] ?? []
  const bBranches = [b.yearPillar.branch, b.monthPillar.branch, b.dayPillar.branch]
  if (b.hourPillar) bBranches.push(b.hourPillar.branch)
  const aBranches = [a.yearPillar.branch, a.monthPillar.branch, a.dayPillar.branch]
  if (a.hourPillar) aBranches.push(a.hourPillar.branch)

  const aHasGuiin = aGuiin.some(g => bBranches.includes(g))
  const bHasGuiin = bGuiin.some(g => aBranches.includes(g))
  if (aHasGuiin || bHasGuiin) {
    const who = aHasGuiin && bHasGuiin ? '서로가 서로에게'
              : aHasGuiin ? '상대가 나에게'
              : '내가 상대에게'
    specials.push({
      type: '특수합',
      name: '천을귀인(天乙貴人)',
      desc: `${who} 천을귀인이야! 천을귀인은 가장 고귀한 귀인으로, 어려울 때 서로를 도와주는 특별한 인연이야. 위기 상황에서 서로가 서로의 구원자가 될 수 있어.`,
      rating: 'great',
    })
  }

  return specials
}

function findAllHaps(a: SajuResult, b: SajuResult): HapInfo[] {
  const haps: HapInfo[] = []

  // 1. 천간합: 두 사람의 일간끼리
  for (const [s1, s2, name, desc] of CHEONGAN_HAP) {
    if ((a.dayPillar.stem === s1 && b.dayPillar.stem === s2) ||
        (a.dayPillar.stem === s2 && b.dayPillar.stem === s1)) {
      haps.push({ type: '천간합', name, desc, rating: 'great' })
    }
  }

  // 2. 지지육합: 두 사람의 일지끼리
  for (const [b1, b2, name, desc] of JIJI_YUKHAP) {
    if ((a.dayPillar.branch === b1 && b.dayPillar.branch === b2) ||
        (a.dayPillar.branch === b2 && b.dayPillar.branch === b1)) {
      haps.push({ type: '지지육합', name, desc, rating: 'great' })
    }
  }

  // 3. 지지삼합 (반합 포함): 두 사람의 일지가 삼합의 일부를 이루는지
  for (const [branches, name, desc] of JIJI_SAMHAP) {
    const ab = a.dayPillar.branch
    const bb = b.dayPillar.branch
    if (ab !== bb && branches.includes(ab) && branches.includes(bb)) {
      haps.push({ type: '지지삼합(반합)', name: name.replace('삼합', '반합'), desc: desc.replace('모이면', '중 두 개가 만나면 반합으로'), rating: 'good' })
    }
  }

  // 4. 천간합: 모든 천간 조합 (일간 외에도)
  const aStemsAll = [a.yearPillar.stem, a.monthPillar.stem]
  if (a.hourPillar) aStemsAll.push(a.hourPillar.stem)
  const bStemsAll = [b.yearPillar.stem, b.monthPillar.stem]
  if (b.hourPillar) bStemsAll.push(b.hourPillar.stem)

  for (const [s1, s2, name, _desc] of CHEONGAN_HAP) {
    // 이미 일간끼리 합이 잡혔으면 스킵
    if ((a.dayPillar.stem === s1 && b.dayPillar.stem === s2) ||
        (a.dayPillar.stem === s2 && b.dayPillar.stem === s1)) continue
    const found = (aStemsAll.includes(s1) && bStemsAll.includes(s2)) ||
                  (aStemsAll.includes(s2) && bStemsAll.includes(s1)) ||
                  (aStemsAll.includes(s1) && b.dayPillar.stem === s2) ||
                  (aStemsAll.includes(s2) && b.dayPillar.stem === s1) ||
                  (a.dayPillar.stem === s1 && bStemsAll.includes(s2)) ||
                  (a.dayPillar.stem === s2 && bStemsAll.includes(s1))
    if (found) {
      haps.push({ type: '천간합(기둥)', name: name + ' (기둥간)', desc: '일간 외의 기둥에서도 ' + name + '이 발견돼. 직접적인 일간합보다는 약하지만, 두 사람 사이에 은근한 끌림이나 협력의 기운이 있어.', rating: 'good' })
    }
  }

  // 5. 특수합
  haps.push(...findSpecialHaps(a, b))

  return haps
}

export function analyzeCompatibility(resultA: SajuResult, resultB: SajuResult): CompatibilityResult {
  const relation1to2 = getTenGod(resultA.dayPillar.stem, resultB.dayPillar.stem)
  const relation2to1 = getTenGod(resultB.dayPillar.stem, resultA.dayPillar.stem)

  const elA = analyzeElements(resultA)
  const elB = analyzeElements(resultB)

  const elementBalance = elA.map((a, i) => ({
    element: i,
    name: a.name,
    hanja: a.hanja,
    countA: a.count,
    countB: elB[i].count,
    total: a.count + elB[i].count,
  }))

  const missingElements = elementBalance
    .filter(e => e.total === 0)
    .map(e => `${e.hanja}(${e.name})`)

  // 합 분석
  const haps = findAllHaps(resultA, resultB)

  // 점수 계산
  let score = 50

  // 1) 상생 관계 보너스
  const goodRelations = ['정인', '정재', '식신', '정관']
  if (goodRelations.includes(relation1to2)) score += 12
  if (goodRelations.includes(relation2to1)) score += 12

  // 비견은 보통
  if (relation1to2 === '비견') score += 5
  if (relation2to1 === '비견') score += 5

  // 편관/겁재/상관은 감점
  const hardRelations = ['편관', '겁재', '상관']
  if (hardRelations.includes(relation1to2)) score -= 5
  if (hardRelations.includes(relation2to1)) score -= 5

  // 2) 오행 보완도
  const aMissing = elA.filter(e => e.count === 0).length
  const bMissing = elB.filter(e => e.count === 0).length
  const combinedMissing = missingElements.length
  const complemented = (aMissing + bMissing) - combinedMissing
  score += complemented * 5

  // 3) 오행 균형도
  const totalCounts = elementBalance.map(e => e.total)
  const max = Math.max(...totalCounts)
  const min = Math.min(...totalCounts)
  if (max - min <= 2) score += 8

  // 4) 합 보너스
  for (const hap of haps) {
    if (hap.rating === 'great') score += 10
    else if (hap.rating === 'good') score += 5
  }

  score = Math.max(0, Math.min(100, score))

  // 요약
  const stemA = `${resultA.dayPillar.stemChar}(${resultA.dayPillar.stemKo})`
  const stemB = `${resultB.dayPillar.stemChar}(${resultB.dayPillar.stemKo})`
  const hapSummary = haps.length > 0
    ? ` ${haps.filter(h => h.type === '천간합' || h.type === '지지육합').map(h => h.name).join(', ')}${haps.some(h => h.type === '천간합' || h.type === '지지육합') ? '이 있어 강한 인연입니다.' : ''}`
    : ''
  const summary = `${stemA} 일간에서 상대는 ${relation1to2}, ${stemB} 일간에서 상대는 ${relation2to1}의 관계입니다.${hapSummary} ${
    complemented > 0
      ? `서로의 부족한 오행을 ${complemented}개 보완해주는 좋은 조합입니다.`
      : missingElements.length > 0
        ? `합쳐도 ${missingElements.join(', ')} 오행이 부족합니다.`
        : '오행이 고루 갖춰진 조합입니다.'
  }`

  return { relation1to2, relation2to1, elementBalance, missingElements, haps, score, summary }
}

// ============================================================
// 일간 성격 해설
// ============================================================

export interface DayMasterProfile {
  title: string
  personality: string
  strengths: string
  weaknesses: string
  advice: string
}

export const DAY_MASTER_PROFILES: Record<string, DayMasterProfile> = {
  '갑': {
    title: '甲 갑목 — 큰 나무',
    personality: '우직하고 곧은 성품으로, 한번 결심하면 뜻을 굽히지 않는 리더형입니다. 정의감이 강하고 어려운 사람을 도우려는 마음이 큽니다. 조직에서 자연스럽게 중심 역할을 맡게 됩니다.',
    strengths: '결단력, 추진력, 책임감이 뛰어나며 큰 그림을 그리는 능력이 있습니다. 위기 상황에서 흔들리지 않는 강인함을 지닙니다.',
    weaknesses: '고집이 세고 유연성이 부족할 수 있습니다. 타인의 의견을 무시하거나, 자신만의 방식을 고수하다 기회를 놓치기도 합니다.',
    advice: '유연함을 기르고, 작은 것부터 양보하는 연습을 하면 더 넓은 세상을 만날 수 있습니다.',
  },
  '을': {
    title: '乙 을목 — 풀과 덩굴',
    personality: '부드럽고 유연한 성격으로, 어떤 환경에서든 적응력이 뛰어납니다. 겉으로는 순해 보이지만 내면에 강한 생존력과 끈기를 가지고 있습니다.',
    strengths: '처세술이 뛰어나고 인간관계에 능합니다. 위기를 유연하게 넘기며, 꾸준한 노력으로 목표를 달성합니다.',
    weaknesses: '우유부단하거나 눈치를 너무 보는 경향이 있습니다. 자신의 의견을 확실히 표현하지 못해 손해를 볼 수 있습니다.',
    advice: '자기 목소리를 내는 연습이 필요합니다. 유연함은 유지하되, 핵심 가치는 지키세요.',
  },
  '병': {
    title: '丙 병화 — 태양',
    personality: '밝고 화려한 에너지로 주변을 환하게 비추는 사람입니다. 낙천적이고 활동적이며, 어디서든 분위기를 주도합니다. 열정적이고 표현력이 풍부합니다.',
    strengths: '리더십과 카리스마가 넘치며 사람을 끄는 매력이 있습니다. 창의적이고 행동력이 강합니다.',
    weaknesses: '성격이 급하고 쉽게 싫증을 내며, 자기 과시 욕구가 강할 수 있습니다. 뜨겁게 타오르다 쉽게 지치는 면이 있습니다.',
    advice: '꾸준함의 가치를 배우고, 주변 사람의 공로를 인정하는 넉넉함을 기르세요.',
  },
  '정': {
    title: '丁 정화 — 촛불',
    personality: '섬세하고 따뜻한 마음을 가진 사람입니다. 조용하지만 깊은 열정을 품고 있으며, 한 분야에 집중하는 장인 기질이 있습니다.',
    strengths: '관찰력과 분석력이 뛰어나며, 예술적 감각이 탁월합니다. 꼼꼼하고 배려심이 깊습니다.',
    weaknesses: '걱정이 많고 내면에 불안을 품기 쉽습니다. 감정 기복이 있고, 때로 비관적이 될 수 있습니다.',
    advice: '완벽주의를 내려놓고, 자신의 감정을 솔직하게 표현하는 연습을 하세요.',
  },
  '무': {
    title: '戊 무토 — 산과 대지',
    personality: '듬직하고 믿음직한 성품으로, 사람들에게 안정감을 줍니다. 중재자 역할을 잘하며, 넓은 포용력을 가지고 있습니다.',
    strengths: '신뢰감이 강하고 인내심이 뛰어납니다. 어떤 상황에서도 흔들리지 않는 안정감이 최대 장점입니다.',
    weaknesses: '변화를 싫어하고 보수적인 면이 있습니다. 게으름이나 무관심으로 비칠 수 있고, 새로운 시도에 소극적입니다.',
    advice: '가끔은 익숙한 것에서 벗어나 새로운 경험을 시도해보세요. 변화도 성장의 일부입니다.',
  },
  '기': {
    title: '己 기토 — 논밭',
    personality: '실용적이고 세심한 성격으로, 일상 속에서 가치를 찾는 사람입니다. 겸손하고 꼼꼼하며, 사람을 키우고 돌보는 데 재능이 있습니다.',
    strengths: '섬세한 관리 능력과 현실 감각이 뛰어납니다. 사람을 잘 돌보고, 조직의 살림을 잘 꾸립니다.',
    weaknesses: '소심하거나 자기 확신이 부족할 수 있습니다. 남의 눈치를 보며 자신의 가치를 과소평가하기 쉽습니다.',
    advice: '자신의 능력과 가치를 당당하게 인정하세요. 작은 성공들을 축하하는 습관을 기르세요.',
  },
  '경': {
    title: '庚 경금 — 바위와 쇠',
    personality: '강인한 의지와 결단력의 소유자입니다. 원칙을 중시하며, 한번 정한 규칙은 반드시 지키려 합니다. 의리가 강하고 직선적입니다.',
    strengths: '실행력이 뛰어나고 목표를 향해 돌진하는 추진력이 있습니다. 정의롭고 의리를 중시합니다.',
    weaknesses: '너무 강경해서 갈등을 불러일으킬 수 있습니다. 융통성이 부족하고, 감정 표현이 서투릅니다.',
    advice: '부드러움도 강함의 일종입니다. 강함 속에 유연함을 더하면 더 큰 영향력을 발휘할 수 있습니다.',
  },
  '신': {
    title: '辛 신금 — 보석과 칼날',
    personality: '예리한 감각과 심미안의 소유자입니다. 완벽주의적 성향이 있으며, 세련되고 품위 있는 것을 추구합니다. 내면이 여리고 감성적입니다.',
    strengths: '미적 감각이 뛰어나고 디테일에 강합니다. 분석력과 비평 능력이 탁월하며, 자기 분야에서 전문성을 인정받습니다.',
    weaknesses: '예민하고 상처를 잘 받습니다. 완벽주의로 인해 자신과 타인에게 지나치게 엄격할 수 있습니다.',
    advice: '불완전함을 받아들이는 연습을 하세요. 완벽하지 않아도 충분히 빛나는 자신을 인정하세요.',
  },
  '임': {
    title: '壬 임수 — 바다와 큰 강',
    personality: '넓은 포용력과 깊은 지혜를 가진 사람입니다. 자유로운 영혼으로, 한곳에 머무르기보다 넓은 세상을 탐험하길 원합니다. 통찰력이 뛰어납니다.',
    strengths: '지적 호기심이 강하고 학습 능력이 탁월합니다. 어떤 분야든 빠르게 이해하며, 큰 그림을 보는 안목이 있습니다.',
    weaknesses: '한곳에 집중하지 못하고 산만해질 수 있습니다. 감정에 휩쓸리거나, 현실보다 이상을 좇기도 합니다.',
    advice: '깊이 있는 집중력을 기르세요. 넓은 시야와 깊은 전문성을 함께 갖추면 무적이 됩니다.',
  },
  '계': {
    title: '癸 계수 — 이슬과 샘물',
    personality: '총명하고 직관력이 뛰어난 사람입니다. 조용하지만 내면에 깊은 사색의 세계를 가지고 있습니다. 영감이 풍부하고 영적 감수성이 높습니다.',
    strengths: '관찰력과 직관이 뛰어나며, 보이지 않는 것을 감지하는 능력이 있습니다. 학문이나 연구 분야에서 두각을 나타냅니다.',
    weaknesses: '내성적이고 우울해지기 쉬우며, 현실 감각이 부족할 수 있습니다. 결정 장애나 자기 의심에 빠지기도 합니다.',
    advice: '머릿속 생각을 행동으로 옮기는 연습을 하세요. 작은 실천이 큰 변화를 만듭니다.',
  },
}
