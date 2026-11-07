import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as ROSLIB from 'roslib'

const RosCtx = createContext(null)

const DEFAULT_URL = `ws://${window.location.hostname || '192.168.0.202'}:9090`

export function RosProvider({ children }) {
  const [ros, setRos] = useState(null)
  const [status, setStatus] = useState('disconnected') // 'connecting' | 'connected' | 'disconnected'
  const [url, setUrl] = useState(() => localStorage.getItem('ros_url') || DEFAULT_URL)
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem('ros_recent') || '[]'))
  const ref = useRef(null)

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

  // auto-connect to the last/default endpoint on first load
  useEffect(() => { connect(url) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RosCtx.Provider value={{ ros, status, url, setUrl, recent, connect, disconnect }}>
      {children}
    </RosCtx.Provider>
  )
}

export const useRos = () => useContext(RosCtx)
