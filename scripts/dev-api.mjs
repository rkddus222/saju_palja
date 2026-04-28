import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()

function loadDotenv(file) {
  if (!existsSync(file)) return false
  const raw = readFileSync(file, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
  return true
}

const loadedLocal = loadDotenv(path.join(ROOT, '.env.local'))
const loadedEnv = loadDotenv(path.join(ROOT, '.env'))

const LOCAL_KEY = path.join(ROOT, 'gemini_service_account.json')
if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && existsSync(LOCAL_KEY)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = LOCAL_KEY
}

const { default: generateHandler } = await import('../api/vertex/generate.mjs')
const { default: healthHandler } = await import('../api/vertex/health.mjs')
const { vertexHealth } = await import('../api/_lib/vertex.mjs')

const PORT = Number(process.env.PORT ?? 8787)

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400
    res.end()
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.url === '/api/vertex/generate' && req.method === 'POST') {
    return generateHandler(req, res)
  }
  if (req.url === '/api/vertex/health' && req.method === 'GET') {
    return healthHandler(req, res)
  }

  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'Not Found' }))
})

server.listen(PORT, async () => {
  console.log(`[dev-api] listening on http://127.0.0.1:${PORT}`)
  if (loadedLocal) console.log('[dev-api] loaded .env.local')
  if (loadedEnv) console.log('[dev-api] loaded .env')
  try {
    const { body } = await vertexHealth()
    console.log(
      `[dev-api] credentials: ${body.credentialsSource} | project: ${body.projectId} | model: ${body.model} (${body.location})`,
    )
  } catch (e) {
    console.warn('[dev-api] credentials probe failed:', e?.message ?? e)
  }
})
