import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as ROSLIB from 'roslib'

const RosCtx = createContext(null)

const DEFAULT_URL = `ws://${window.location.hostname || '192.168.0.202'}:9090`
export const DEFAULT_REGISTRY = import.meta.env.VITE_REGISTRY_URL || 'https://fleet.alps-robotics.com'

export function RosProvider({ children }) {
  const [ros, setRos] = useState(null)
  const [status, setStatus] = useState('disconnected') // 'connecting' | 'connected' | 'disconnected'
  const [url, setUrl] = useState(() => localStorage.getItem('ros_url') || DEFAULT_URL)
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem('ros_recent') || '[]'))
  const ref = useRef(null)

  // Flotte: zentrale Registry-Abfrage + optionales Auto-Connect (app-weit, nicht
  // nur im Flotte-Tab). So verbindet sich das Dashboard ohne Klick zu einem
  // online gemeldeten UGV — und bei einem IP-Wechsel (alte ws-Verbindung bricht,
  // UGV meldet neue Adresse) automatisch zur neuen Adresse.
  const [registry, setRegistryState] = useState(() => localStorage.getItem('fleet_registry_url') || DEFAULT_REGISTRY)
  const [ugvs, setUgvs] = useState(null) // null = noch nie geladen
  const [fleetError, setFleetError] = useState(null)
  const [autoConnect, setAutoConnectState] = useState(() => localStorage.getItem('fleet_autoconnect') !== '0')
  // Welcher UGV wird im Telemetrie-Tab angezeigt (liest dessen https-Snapshots).
  const [selectedUgv, setSelectedUgvState] = useState(() => localStorage.getItem('fleet_selected_ugv') || null)

  const connect = useCallback((target) => {
    const u = target || url
    if (ref.current) { try { ref.current.close() } catch (e) {} }
    setStatus('connecting')
    const r = new ROSLIB.Ros({ url: u })
    r.on('connection', () => setStatus('connected'))
    r.on('close', () => setStatus('disconnected'))
    r.on('error', () => setStatus('disconnected'))
    ref.current = r
    setRos(r)
    setUrl(u)
    localStorage.setItem('ros_url', u)
    setRecent((prev) => {
      const next = [u, ...prev.filter((x) => x !== u)].slice(0, 8)
      localStorage.setItem('ros_recent', JSON.stringify(next))
      return next
    })
  }, [url])

  const disconnect = useCallback(() => {
    if (ref.current) { try { ref.current.close() } catch (e) {} }
    setStatus('disconnected')
  }, [])

  const setRegistry = useCallback((v) => {
    setRegistryState(v)
    try { localStorage.setItem('fleet_registry_url', v) } catch (e) {}
  }, [])

  const setAutoConnect = useCallback((v) => {
    setAutoConnectState(v)
    try { localStorage.setItem('fleet_autoconnect', v ? '1' : '0') } catch (e) {}
  }, [])

  const setSelectedUgv = useCallback((id) => {
    setSelectedUgvState(id)
    try { if (id) localStorage.setItem('fleet_selected_ugv', id); else localStorage.removeItem('fleet_selected_ugv') } catch (e) {}
  }, [])

  // auto-connect to the last/default endpoint on first load
  useEffect(() => { connect(url) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Registry zyklisch abfragen (eine Quelle fuer alle: Flotte-Tab + Auto-Connect)
  useEffect(() => {
    let alive = true
    const base = (registry || '').replace(/\/+$/, '')
    const poll = async () => {
      if (!base) return
      try {
        const r = await fetch(base + '/ugvs', { cache: 'no-store' })
        if (!r.ok) throw new Error('HTTP ' + r.status)
        const data = await r.json()
        if (alive) { setUgvs(Array.isArray(data) ? data : []); setFleetError(null) }
      } catch (e) {
        if (alive) setFleetError(String(e.message || e))
      }
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [registry])

  // Auto-Connect: nur wenn getrennt und ein UGV online ist. Waehlt das aktuell
  // gesetzte UGV, falls noch online, sonst das erste online gemeldete.
  useEffect(() => {
    if (!autoConnect) return
    if (status !== 'disconnected') return
    const onlineList = (ugvs || []).filter((u) => u.online && u.ws_url)
    if (onlineList.length === 0) return
    const target = onlineList.find((u) => u.ws_url === url) || onlineList[0]
    connect(target.ws_url)
  }, [autoConnect, status, ugvs, url, connect])

  // Auto-Auswahl fuer den Telemetrie-Tab: wenn nichts (mehr) gewaehlt ist, das
  // erste online gemeldete UGV nehmen, sonst das erste in der Liste.
  useEffect(() => {
    const list = ugvs || []
    if (list.length === 0) return
    if (selectedUgv && list.some((u) => u.id === selectedUgv)) return
    const pick = list.find((u) => u.online) || list[0]
    if (pick) setSelectedUgvState(pick.id)
  }, [ugvs, selectedUgv])

  return (
    <RosCtx.Provider value={{
      ros, status, url, setUrl, recent, connect, disconnect,
      registry, setRegistry, ugvs, fleetError, autoConnect, setAutoConnect,
      selectedUgv, setSelectedUgv,
    }}>
      {children}
    </RosCtx.Provider>
  )
}

export const useRos = () => useContext(RosCtx)
