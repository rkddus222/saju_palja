import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleAuth } from 'google-auth-library'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DEFAULT_CREDENTIALS_PATH = path.join(ROOT_DIR, 'gemini_service_account.json')
const PORT = Number(process.env.PORT ?? 8787)
const DEFAULT_LOCATION = process.env.VERTEX_LOCATION ?? 'global'
const DEFAULT_MODEL = process.env.VERTEX_MODEL ?? 'gemini-2.5-flash'

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function toErrorMessage(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}

async function resolveProjectId() {
  if (process.env.VERTEX_PROJECT_ID) return process.env.VERTEX_PROJECT_ID
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? DEFAULT_CREDENTIALS_PATH
  const raw = await readFile(credentialsPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed.project_id) {
    throw new Error('서비스 계정 파일에서 project_id를 찾지 못했습니다.')
  }
  return parsed.project_id
}

async function getAccessToken() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? DEFAULT_CREDENTIALS_PATH
  const auth = new GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token
  if (!token) {
    throw new Error('Vertex AI access token을 발급하지 못했습니다.')
  }
  return token
}

function toContents(payload) {
  if (Array.isArray(payload.contents) && payload.contents.length > 0) {
    return payload.contents
  }
  if (typeof payload.prompt === 'string' && payload.prompt.trim()) {
    return [
      {
        role: 'user',
        parts: [{ text: payload.prompt.trim() }],
      },
    ]
  }
  throw new Error('`prompt` 또는 `contents`를 전달해야 합니다.')
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
}

async function handleGenerate(req, res) {
  try {
    const payload = await readJsonBody(req)
    const projectId = await resolveProjectId()
    const location = payload.location ?? DEFAULT_LOCATION
    const model = payload.model ?? DEFAULT_MODEL
    const accessToken = await getAccessToken()
    const serviceEndpoint =
      location === 'global'
        ? 'https://aiplatform.googleapis.com'
        : `https://${location}-aiplatform.googleapis.com`
    const endpoint = `${serviceEndpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`

    const vertexPayload = {
      contents: toContents(payload),
      ...(payload.systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: String(payload.systemInstruction) }],
            },
          }
        : {}),
      ...(payload.temperature !== undefined || payload.maxOutputTokens !== undefined
        ? {
            generationConfig: {
              ...(payload.temperature !== undefined ? { temperature: payload.temperature } : {}),
              ...(payload.maxOutputTokens !== undefined ? { maxOutputTokens: payload.maxOutputTokens } : {}),
            },
          }
        : {}),
    }

    if (payload.thinkingBudget !== undefined) {
      vertexPayload.generationConfig = {
        ...(vertexPayload.generationConfig ?? {}),
        thinkingConfig: {
          thinkingBudget: payload.thinkingBudget,
        },
      }
    }

    const vertexResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(vertexPayload),
    })

    const rawResponse = await vertexResponse.text()
    let data = {}

    if (rawResponse) {
      try {
        data = JSON.parse(rawResponse)
      } catch {
        console.error('[vertex-api] non-json response from vertex', {
          status: vertexResponse.status,
          statusText: vertexResponse.statusText,
          body: rawResponse.slice(0, 500),
        })
        return json(res, 502, {
          error: 'Vertex AI가 JSON이 아닌 응답을 반환했습니다.',
          details: {
            status: vertexResponse.status,
            statusText: vertexResponse.statusText,
            bodyPreview: rawResponse.slice(0, 500),
          },
        })
      }
    }

    if (!vertexResponse.ok) {
      console.error('[vertex-api] vertex request failed', {
        status: vertexResponse.status,
        statusText: vertexResponse.statusText,
        details: data,
      })
      return json(res, vertexResponse.status, {
        error: data?.error?.message ?? 'Vertex AI 요청에 실패했습니다.',
        details: data,
      })
    }

    return json(res, 200, {
      text: extractText(data),
      model,
      location,
      finishReason: data?.candidates?.[0]?.finishReason ?? null,
      raw: data,
    })
  } catch (error) {
    console.error('[vertex-api] unhandled error', error)
    return json(res, 500, {
      error: toErrorMessage(error),
    })
  }
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    return json(res, 400, { error: '잘못된 요청입니다.' })
  }

  if (req.method === 'OPTIONS') {
    return json(res, 204, {})
  }

  if (req.method === 'GET' && req.url === '/api/vertex/health') {
    return json(res, 200, {
      ok: true,
      projectId: await resolveProjectId().catch(() => null),
      location: DEFAULT_LOCATION,
      model: DEFAULT_MODEL,
      credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? DEFAULT_CREDENTIALS_PATH,
    })
  }

  if (req.method === 'POST' && req.url === '/api/vertex/generate') {
    return handleGenerate(req, res)
  }

  return json(res, 404, { error: 'Not Found' })
})

server.listen(PORT, () => {
  console.log(`[vertex-api] listening on http://127.0.0.1:${PORT}`)
})
