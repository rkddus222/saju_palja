import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

interface ElementAnalysisItem {
  element: number
  name: string
  hanja: string
  count: number
}

export default function ElementRadarChart({
  analysis,
  dark,
  maxCount,
}: {
  analysis: ElementAnalysisItem[]
  dark: boolean
  maxCount: number
}) {
  const radarData = analysis.map(item => ({
    subject: `${item.hanja} ${item.name}`,
    value: item.count,
  }))

  return (
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
  )
}
