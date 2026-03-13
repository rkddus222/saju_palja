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
// 궁합 비교
// ============================================================

export interface CompatibilityResult {
  relation1to2: string  // A의 일간에서 본 B
  relation2to1: string  // B의 일간에서 본 A
  elementBalance: { element: number; name: string; hanja: string; countA: number; countB: number; total: number }[]
  missingElements: string[]
  score: number         // 0~100
  summary: string
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

  score = Math.max(0, Math.min(100, score))

  // 요약
  const stemA = `${resultA.dayPillar.stemChar}(${resultA.dayPillar.stemKo})`
  const stemB = `${resultB.dayPillar.stemChar}(${resultB.dayPillar.stemKo})`
  const summary = `${stemA} 일간에서 상대는 ${relation1to2}, ${stemB} 일간에서 상대는 ${relation2to1}의 관계입니다. ${
    complemented > 0
      ? `서로의 부족한 오행을 ${complemented}개 보완해주는 좋은 조합입니다.`
      : missingElements.length > 0
        ? `합쳐도 ${missingElements.join(', ')} 오행이 부족합니다.`
        : '오행이 고루 갖춰진 조합입니다.'
  }`

  return { relation1to2, relation2to1, elementBalance, missingElements, score, summary }
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
