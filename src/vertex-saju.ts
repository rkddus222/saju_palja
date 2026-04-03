import {
  analyzeElements,
  analyzeInteractions,
  analyzeVoid,
  BRANCHES,
  BRANCH_KO,
  ELEMENTS_HANJA,
  ELEMENTS_KO,
  type JohuResult,
  type SajuResult,
  type SingangResult,
  type YongshinResult,
} from './saju-calc'
import type { FormState } from './saju-types'

export type SajuInterpretationSection =
  | '핵심 성향'
  | '강점과 주의점'
  | '인간관계와 연애'
  | '일과 재능'
  | '균형 포인트'
  | '균형 조언'

function formatPillar(label: string, pillar: SajuResult['hourPillar']) {
  if (!pillar) return `${label}: 미상`
  return `${label}: ${pillar.stemChar}${pillar.branchChar}(${pillar.stemKo}${pillar.branchKo}) / 천간십성 ${pillar.tenGodStem} / 지지십성 ${pillar.tenGodBranch} / 12운성 ${pillar.twelveStage}`
}

export function buildSajuInterpretationPrompt({
  form,
  birthText,
  genderText,
  result,
  singang,
  johu,
  yongshin,
}: {
  form: FormState
  birthText: string
  genderText: string
  result: SajuResult
  singang: SingangResult
  johu: JohuResult
  yongshin: YongshinResult
}) {
  const interactions = analyzeInteractions(result)
  const voidInfo = analyzeVoid(result)
  const elements = analyzeElements(result)
  const name = form.name.trim() || '의뢰인'
  const mbti = form.mbti ? `MBTI: ${form.mbti}` : 'MBTI: 미입력'

  const elementSummary = elements
    .map(item => `${item.hanja}(${item.name}) ${item.count}`)
    .join(', ')

  const interactionSummary = interactions.length > 0
    ? interactions.map(item => `${item.type} ${item.name}`).join(', ')
    : '특이한 형충파해/합 없음'

  const affectedVoid = voidInfo.affectedPillars.length > 0
    ? voidInfo.affectedPillars.map(item => `${item.pillar} 공망`).join(', ')
    : '원국에 직접 걸린 공망 없음'

  return [
    `이름: ${name}`,
    `출생정보: ${birthText} / ${genderText}`,
    mbti,
    '',
    '[사주 원국]',
    formatPillar('년주', result.yearPillar),
    formatPillar('월주', result.monthPillar),
    formatPillar('일주', result.dayPillar),
    formatPillar('시주', result.hourPillar),
    `입춘 기준 사주 연도: ${result.sajuYear}`,
    `공망: ${result.voidBranches.map(branch => `${BRANCHES[branch]}(${BRANCH_KO[branch]})`).join(', ')}`,
    '',
    '[분석 요약]',
    `일간: ${result.dayPillar.stemChar}(${result.dayPillar.stemKo})`,
    `오행 분포: ${elementSummary}`,
    `신강/신약: ${singang.label} ${singang.score}점`,
    `조후: ${johu.season}, ${johu.temperature}, ${johu.humidity}, 필요 오행 ${johu.neededHanja}(${johu.neededElement})`,
    `용신: ${ELEMENTS_HANJA[yongshin.yongshin]}(${ELEMENTS_KO[yongshin.yongshin]})`,
    `기신: ${ELEMENTS_HANJA[yongshin.gishin]}(${ELEMENTS_KO[yongshin.gishin]})`,
    `형충파해/합: ${interactionSummary}`,
    `공망 영향: ${affectedVoid}`,
    '',
    '[작성 지침]',
    '위 데이터만 근거로 한국어 존댓말로 해석해주세요.',
    '과장하거나 운명을 단정하지 말고, 앱 사용자에게 읽기 쉬운 실전 조언 형태로 작성해주세요.',
    '사주 초보자도 이해할 수 있도록 용어를 풀어서 설명하되, 핵심 사주 용어는 괄호 안에 병기해도 됩니다.',
    '각 섹션마다 반드시 위 데이터 중 어떤 근거를 보는지 자연스럽게 반영해주세요. 특히 일간, 월지, 오행 분포, 신강/신약, 용신, 형충파해/합, 공망 정보를 빠뜨리지 마세요.',
    '막연한 칭찬보다 성향의 이유와 주의할 상황을 구체적으로 설명해주세요.',
    '반드시 아래 형식을 지켜주세요.',
    '[핵심 성향]',
    '4~5문장. 일간과 월지, 신강/신약을 근거로 성격의 중심축을 설명해주세요.',
    '[강점과 주의점]',
    '5~6문장. 오행 분포와 형충파해/합을 바탕으로 강점, 약점, 흔들리기 쉬운 상황을 설명해주세요.',
    '[인간관계와 연애]',
    '4~5문장. 대인관계 스타일, 감정 표현 방식, 관계에서의 주의점을 설명해주세요.',
    '[일과 재능]',
    '4~5문장. 일 처리 방식, 맞는 환경, 강점이 살아나는 역할을 설명해주세요.',
    '[균형 포인트]',
    '4~5문장. 조후, 용신, 기신, 공망을 근거로 생활 습관이나 태도 조언을 구체적으로 적어주세요.',
    '[균형 조언]',
    '마지막 한 문단으로 2~3문장. 전체 해석을 한 번에 정리하는 마무리 조언을 적어주세요.',
  ].join('\n')
}

export function buildSajuSectionPrompt(
  basePrompt: string,
  section: SajuInterpretationSection,
) {
  const sectionGuide: Record<SajuInterpretationSection, string> = {
    '핵심 성향': '반드시 `### [핵심 성향]` 제목으로 시작하고, 4~5문장으로만 작성해주세요. 일간, 월지, 신강/신약을 중심 근거로 설명해주세요.',
    '강점과 주의점': '반드시 `### [강점과 주의점]` 제목으로 시작하고, 5~6문장으로만 작성해주세요. 오행 분포와 형충파해/합을 중심 근거로 설명해주세요.',
    '인간관계와 연애': '반드시 `### [인간관계와 연애]` 제목으로 시작하고, 4~5문장으로만 작성해주세요. 관계 패턴, 감정 표현, 갈등 포인트를 설명해주세요.',
    '일과 재능': '반드시 `### [일과 재능]` 제목으로 시작하고, 4~5문장으로만 작성해주세요. 일 처리 방식, 맞는 역할, 강점이 살아나는 환경을 설명해주세요.',
    '균형 포인트': '반드시 `### [균형 포인트]` 제목으로 시작하고, 4~5문장으로만 작성해주세요. 조후, 용신, 기신, 공망을 근거로 생활 조언을 설명해주세요.',
    '균형 조언': '반드시 `### [균형 조언]` 제목으로 시작하고, 2~3문장으로만 작성해주세요. 전체 해석을 정리하는 마무리 조언만 적어주세요.',
  }

  return [
    basePrompt,
    '',
    '[이번 요청]',
    `${section} 섹션만 작성해주세요.`,
    sectionGuide[section],
    '다른 섹션은 절대 출력하지 마세요.',
    '앞머리 인사말이나 전체 서론도 쓰지 마세요.',
  ].join('\n')
}

export const SAJU_INTERPRETATION_SYSTEM_INSTRUCTION =
  '당신은 사주 앱의 해설 보조 모델입니다. 제공된 계산 결과만 바탕으로 해석하고, 단정적 예언이나 의료·법률·재정 조언은 하지 마세요. 섹션 제목은 그대로 유지하고, 각 섹션을 충분히 상세하게 작성하세요. 사용자가 왜 그런 해석이 나오는지 이해할 수 있도록 근거가 드러나는 자연스러운 한국어 존댓말로 작성하세요.'
