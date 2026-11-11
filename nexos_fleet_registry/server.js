// NEXOS fleet registry — Heartbeat-Register + Telemetrie-Relay fuer UGVs.
//
// Jeder UGV sendet periodisch einen Heartbeat (POST /heartbeat) mit seiner
// aktuellen rosbridge-Adresse. Der Dienst merkt sich "zuletzt gesehen" und
// liefert (GET /ugvs) die Flotte mit online/offline. Damit ist die wechselnde
// IP eines UGV egal: der UGV meldet seine Adresse selbst.
//
// Zusaetzlich pusht ein UGV seine Telemetrie (POST /telemetry {id,data}); der
// Dienst haelt je UGV den letzten Snapshot, und das Dashboard liest ihn per
// GET /telemetry?id=<ugv> ueber https. So braucht die oeffentlich gehostete
// Oberflaeche keinen Direktzugriff auf die ws-LAN-Adresse der Roboter
// (UGV -> Server -> Dashboard).
//
// Bewusst ohne Auth (ziviler Demo). Vor Produktiv/Defence: Token/mTLS fuer
// Heartbeats, Zugriffsschutz der Liste, Rate-Limiting — siehe README (TODO).
//
// Keine externen Abhaengigkeiten (nur Node >=18 stdlib) -> einfaches Deployment
// (z. B. Plesk-Node.js), analog zu nexos_status_sim.

const http = require('node:http')

// Plesk/Passenger uebergibt in PORT einen Unix-Socket-PFAD (kein numerischer
// Port). Darum NICHT nach Number zwingen: ein numerischer Wert wird zum TCP-Port,
// ein Socket-Pfad bleibt String und wird direkt an listen() gegeben.
const RAW_PORT = process.env.PORT || 8090
const PORT = /^\d+$/.test(String(RAW_PORT)) ? Number(RAW_PORT) : RAW_PORT
// Nach so vielen ms ohne Heartbeat gilt ein UGV als offline.
const OFFLINE_TIMEOUT_MS = Number(process.env.OFFLINE_TIMEOUT_MS || 10000)
// UGVs, die laenger als das weg sind, werden ganz vergessen.
const FORGET_MS = Number(process.env.FORGET_MS || 1000 * 60 * 60)
const MAX_BODY = 8 * 1024 // Heartbeats sind winzig; grosse Bodies ablehnen.
const MAX_TELEM = 256 * 1024 // Telemetrie-Snapshots duerfen groesser sein.
// Nach so vielen ms ohne Telemetrie gilt ein Snapshot als "stale" (veraltet).
const TELEM_STALE_MS = Number(process.env.TELEM_STALE_MS || 5000)

/** @type {Map<string, {id:string,name:string,ws_url:string,status:string,last_seen:number}>} */
const fleet = new Map()
/** @type {Map<string, {id:string, ts:number, data:object}>} letzter Telemetrie-Snapshot je UGV */
const telemetry = new Map()

const isStr = (v, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max
// Nur ws:// oder wss:// zulassen — kein beliebiges Schema in die Liste schreiben.
const isWsUrl = (v) => isStr(v, 300) && /^wss?:\/\/[^\s]+$/i.test(v)

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function listUgvs() {
  const now = Date.now()
  return [...fleet.values()]
    .map((u) => ({
      id: u.id,
      name: u.name,
      ws_url: u.ws_url,
      status: u.status,
      online: now - u.last_seen < OFFLINE_TIMEOUT_MS,
      last_seen: new Date(u.last_seen).toISOString(),
      age_s: Math.round((now - u.last_seen) / 1000),
    }))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
}

function readBody(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let data = ''
    let tooBig = false
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > max) {
        tooBig = true
        req.destroy()
      }
    })
    req.on('end', () => (tooBig ? reject(new Error('body too large')) : resolve(data)))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') return sendJson(res, 204, {})

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, ugvs: fleet.size, telemetry: telemetry.size })
  }

  if (req.method === 'GET' && url.pathname === '/ugvs') {
    return sendJson(res, 200, listUgvs())
  }

  // Telemetrie lesen: ?id=<ugv> -> letzter Snapshot; ohne id -> Liste der IDs.
  if (req.method === 'GET' && url.pathname === '/telemetry') {
    const now = Date.now()
    const id = url.searchParams.get('id')
    if (!id) {
      const ids = [...telemetry.values()].map((t) => ({
        id: t.id, age_s: Math.round((now - t.ts) / 1000), fresh: now - t.ts < TELEM_STALE_MS,
      }))
      return sendJson(res, 200, { ids })
    }
    const t = telemetry.get(id)
    if (!t) return sendJson(res, 404, { ok: false, error: 'no telemetry for id' })
    return sendJson(res, 200, {
      id: t.id,
      ts: new Date(t.ts).toISOString(),
      age_s: Math.round((now - t.ts) / 1000),
      fresh: now - t.ts < TELEM_STALE_MS,
      data: t.data,
    })
  }

  // Telemetrie schreiben: UGV-Pusher schickt { id, data } (letzte Topic-Staende).
  if (req.method === 'POST' && url.pathname === '/telemetry') {
    let payload
    try {
      payload = JSON.parse(await readBody(req, MAX_TELEM))
    } catch {
      return sendJson(res, 400, { ok: false, error: 'invalid or too large JSON' })
    }
    if (!payload || !isStr(payload.id, 64) || typeof payload.data !== 'object' || payload.data === null) {
      return sendJson(res, 400, { ok: false, error: 'id and data object required' })
    }
    const id = payload.id.trim()
    telemetry.set(id, { id, ts: Date.now(), data: payload.data })
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/heartbeat') {
    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch {
      return sendJson(res, 400, { ok: false, error: 'invalid or too large JSON' })
    }
    if (!payload || !isStr(payload.id, 64) || !isWsUrl(payload.ws_url)) {
      return sendJson(res, 400, { ok: false, error: 'id and valid ws_url required' })
    }
    const id = payload.id.trim()
    fleet.set(id, {
      id,
      name: isStr(payload.name, 120) ? payload.name : id,
      ws_url: payload.ws_url,
      status: isStr(payload.status, 60) ? payload.status : 'unknown',
      last_seen: Date.now(),
    })
    return sendJson(res, 200, { ok: true })
  }

  sendJson(res, 404, { ok: false, error: 'not found' })
})

// Lange verschollene UGVs vergessen, damit die Liste nicht ewig waechst.
setInterval(() => {
  const now = Date.now()
  for (const [id, u] of fleet) if (now - u.last_seen > FORGET_MS) fleet.delete(id)
  for (const [id, t] of telemetry) if (now - t.ts > FORGET_MS) telemetry.delete(id)
}, 30000).unref()

server.listen(PORT, () => {
  console.log(`[fleet-registry] hoert auf :${PORT} (offline nach ${OFFLINE_TIMEOUT_MS} ms)`)
})
