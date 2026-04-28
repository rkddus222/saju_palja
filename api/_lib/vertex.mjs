import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { GoogleAuth } from 'google-auth-library'

const FALLBACK_KEY_PATH = path.resolve(process.cwd(), 'gemini_service_account.json')
const DEFAULT_LOCATION = process.env.VERTEX_LOCATION ?? 'global'
const DEFAULT_MODEL = process.env.VERTEX_MODEL ?? 'gemini-2.5-flash'

let credsCache = null
let authCache = null

async function loadCredentials() {
  if (credsCache) return credsCache
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (raw && raw.trim()) {
    const trimmed = raw.trim()
    const text = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8')
    credsCache = JSON.parse(text)
    return credsCache
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? FALLBACK_KEY_PATH
  const fileContent = await readFile(keyPath, 'utf8')
  credsCache = JSON.parse(fileContent)
  return credsCache
}

async function resolveProjectId() {
  if (process.env.VERTEX_PROJECT_ID) return process.env.VERTEX_PROJECT_ID
  const creds = await loadCredentials()
  if (!creds.project_id) {
    throw new Error('서비스 계정 자격증명에서 project_id를 찾지 못했습니다.')
  }
  return creds.project_id
}

async function getAuth() {
  if (authCache) return authCache
  const creds = await loadCredentials()
  authCache = new GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  return authCache
}

async function getAccessToken() {
  const auth = await getAuth()
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const token =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token
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
    return [{ role: 'user', parts: [{ text: payload.prompt.trim() }] }]
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

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export async function generateVertexContent(payload = {}) {
  try {
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
        thinkingConfig: { thinkingBudget: payload.thinkingBudget },
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
        return {
          status: 502,
          body: {
            error: 'Vertex AI가 JSON이 아닌 응답을 반환했습니다.',
            details: {
              status: vertexResponse.status,
              statusText: vertexResponse.statusText,
              bodyPreview: rawResponse.slice(0, 500),
            },
          },
        }
      }
    }

    if (!vertexResponse.ok) {
      console.error('[vertex-api] vertex request failed', {
        status: vertexResponse.status,
        statusText: vertexResponse.statusText,
        details: data,
      })
      return {
        status: vertexResponse.status,
        body: {
          error: data?.error?.message ?? 'Vertex AI 요청에 실패했습니다.',
          details: data,
        },
      }
    }

    return {
      status: 200,
      body: {
        text: extractText(data),
        model,
        location,
        finishReason: data?.candidates?.[0]?.finishReason ?? null,
        raw: data,
      },
    }
  } catch (error) {
    console.error('[vertex-api] unhandled error', error)
    return {
      status: 500,
      body: { error: toErrorMessage(error) },
    }
  }
}

export async function vertexHealth() {
  try {
    const projectId = await resolveProjectId().catch(() => null)
    return {
      status: 200,
      body: {
        ok: true,
        projectId,
        location: DEFAULT_LOCATION,
        model: DEFAULT_MODEL,
        credentialsSource: process.env.GOOGLE_SERVICE_ACCOUNT_JSON
          ? 'env:GOOGLE_SERVICE_ACCOUNT_JSON'
          : (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? FALLBACK_KEY_PATH),
      },
    }
  } catch (error) {
    return {
      status: 500,
      body: { ok: false, error: toErrorMessage(error) },
    }
  }
}
