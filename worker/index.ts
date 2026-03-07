import http from 'http'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })

import { runSingleBot, runWorkspace } from './bot-runner'

const PORT = process.env.WORKER_PORT || process.env.PORT || 3001
const API_KEY = process.env.WORKER_API_KEY || ''

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })
}

function checkAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return false
  }
  return true
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Run a single bot — one Chrome per Cloud Run instance
  if (req.method === 'POST' && req.url === '/spawn-bot') {
    if (!checkAuth(req, res)) return

    try {
      const { botId, workspaceId } = JSON.parse(await readBody(req))
      if (!botId || !workspaceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'botId and workspaceId are required' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, botId }))

      runSingleBot(botId, workspaceId).catch((err) => {
        console.error(`[Worker] Error running bot ${botId}:`, err)
      })
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
    return
  }

  // Legacy: run all bots in one container (kept for local dev / docker-compose)
  if (req.method === 'POST' && req.url === '/spawn') {
    if (!checkAuth(req, res)) return

    try {
      const { workspaceId } = JSON.parse(await readBody(req))
      if (!workspaceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'workspaceId is required' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, workspaceId }))

      runWorkspace(workspaceId).catch((err) => {
        console.error(`[Worker] Error running workspace ${workspaceId}:`, err)
      })
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Worker] tracebox worker listening on 0.0.0.0:${PORT}`)
})
