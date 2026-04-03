export interface VertexGenerateRequest {
  prompt?: string
  contents?: Array<{
    role?: string
    parts: Array<{ text?: string }>
  }>
  systemInstruction?: string
  temperature?: number
  maxOutputTokens?: number
  thinkingBudget?: number
  model?: string
  location?: string
}

export interface VertexGenerateResponse {
  text: string
  model: string
  location: string
  raw: unknown
  finishReason?: string
}

interface VertexErrorResponse {
  error?: string
  details?: unknown
}

export async function generateWithVertex(
  payload: VertexGenerateRequest,
): Promise<VertexGenerateResponse> {
  let response: Response

  try {
    response = await fetch('/api/vertex/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('API 서버에 연결하지 못했습니다. `npm run dev:api` 실행 상태를 확인해주세요.')
  }

  const rawText = await response.text()
  let data: (VertexGenerateResponse & VertexErrorResponse) | null = null

  if (rawText) {
    try {
      data = JSON.parse(rawText) as VertexGenerateResponse & { error?: string }
    } catch {
      if (rawText.trim().startsWith('<')) {
        throw new Error('API 응답이 JSON이 아닙니다. Vite 프록시 또는 API 서버 상태를 확인해주세요.')
      }
      throw new Error(`API 응답을 해석하지 못했습니다. 응답 본문: ${rawText.slice(0, 160)}`)
    }
  }

  if (!response.ok) {
    const detailText =
      data?.details && typeof data.details === 'object'
        ? JSON.stringify(data.details).slice(0, 220)
        : null
    throw new Error(
      data?.error
        ? detailText
          ? `${data.error} (${detailText})`
          : data.error
        : `Vertex AI 호출에 실패했습니다. HTTP ${response.status}`,
    )
  }

  if (!data) {
    throw new Error('API 서버가 빈 응답을 반환했습니다. `npm run dev:api` 로그를 확인해주세요.')
  }
  return data
}
