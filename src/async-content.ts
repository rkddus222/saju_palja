import type { GuideCategory } from './guide-data'
import type { DayPillarProfile } from './day-pillar-profiles'

export type GuideKey =
  | 'cheongan'
  | 'jiji'
  | 'sipsung'
  | 'twelveStage'
  | 'twelveSpirit'
  | 'johu'
  | 'singang'
  | 'hyungchung'

const guideModulePromise = import('./guide-data')
const dayPillarProfilesPromise = import('./day-pillar-profiles')

export async function loadGuide(key: GuideKey): Promise<GuideCategory> {
  const module = await guideModulePromise

  switch (key) {
    case 'cheongan':
      return module.CHEONGAN_GUIDE
    case 'jiji':
      return module.JIJI_GUIDE
    case 'sipsung':
      return module.SIPSUNG_GUIDE
    case 'twelveStage':
      return module.TWELVE_STAGE_GUIDE
    case 'twelveSpirit':
      return module.TWELVE_SPIRIT_GUIDE
    case 'johu':
      return module.JOHU_GUIDE
    case 'singang':
      return module.SINGANG_GUIDE
    case 'hyungchung':
      return module.HYUNGCHUNG_GUIDE
  }
}

export async function loadDayPillarProfile(sexagenary: number): Promise<DayPillarProfile | null> {
  const module = await dayPillarProfilesPromise
  return module.DAY_PILLAR_PROFILES[sexagenary] ?? null
}
