import { useEffect, useRef, useState } from 'react'
import * as ROSLIB from 'roslib'
import {
  AppBar, Toolbar, Box, Typography, TextField, Button, Chip, IconButton,
  Menu, MenuItem, Tabs, Tab, Stack, Tooltip, Divider,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import CircleIcon from '@mui/icons-material/Circle'
import logoLight from './assets/nexos-logo-light.png'
import { useRos, pageIsHttps } from './ros'
import {
  SystemPanel, NodesPanel, TopicsPanel, LifecyclePanel,
  DiagnosticsPanel, ControlPanel, OdinPanel, FleetPanel, TelemetryPanel, LogsPanel,
} from './panels'

// Panels, die auch ohne aktive ROS-Verbindung sinnvoll sind: Flotte (Roboterwahl)
// und Telemetrie (liest UGV-Snapshots per https, nicht per ws).
const OFFLINE_OK = new Set(['Flotte', 'Telemetrie'])

const TABS = [
  ['Flotte', FleetPanel],
  ['Telemetrie', TelemetryPanel],
  ['System', SystemPanel],
  ['ODIN', OdinPanel],
  ['Nodes', NodesPanel],
  ['Topics', TopicsPanel],
  ['Lifecycle', LifecyclePanel],
  ['Diagnostics', DiagnosticsPanel],
  ['ros2_control', ControlPanel],
  ['Logs', LogsPanel],
]

// Die ws-basierten Tabs (Direktverbindung zum Roboter) ergeben nur im LAN (http)
// Sinn. Oeffentlich (https) laeuft alles ueber den Service -> nur Flotte +
// Telemetrie zeigen, und die ws-Verbindungsleiste ausblenden.
const SERVICE_TABS = new Set(['Flotte', 'Telemetrie'])
const VISIBLE_TABS = pageIsHttps ? TABS.filter(([n]) => SERVICE_TABS.has(n)) : TABS

function useHeaderStats(ros, status) {
  const [stats, setStats] = useState({ nodes: 0, topics: 0, err: 0, warn: 0, diagErr: 0, diagWarn: 0 })
  const ev = useRef({ err: [], warn: [] })
  const diag = useRef({})

  useEffect(() => {
    if (!ros || status !== 'connected') return
    let alive = true
    const poll = () => {
      ros.getNodes((n) => alive && setStats((s) => ({ ...s, nodes: n.length })), () => {})
      ros.getTopics((r) => alive && setStats((s) => ({ ...s, topics: (r.topics || []).length })), () => {})
    }
    poll()
    const id = setInterval(poll, 5000)

    const rosout = new ROSLIB.Topic({ ros, name: '/rosout', messageType: 'rcl_interfaces/msg/Log' })
    rosout.subscribe((m) => {
      const now = Date.now()
      if (m.level >= 40) ev.current.err.push(now)
      else if (m.level >= 30) ev.current.warn.push(now)
    })
    const diagTopic = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    diagTopic.subscribe((m) => { (m.status || []).forEach((s) => { diag.current[s.name] = s.level }) })
    const tick = setInterval(() => {
      const now = Date.now()
      ev.current.err = ev.current.err.filter((t) => now - t < 60000)
      ev.current.warn = ev.current.warn.filter((t) => now - t < 60000)
      const levels = Object.values(diag.current)
      const diagErr = levels.filter((l) => l === 2).length
      const diagWarn = levels.filter((l) => l === 1).length
      if (alive) setStats((s) => ({ ...s, err: ev.current.err.length, warn: ev.current.warn.length, diagErr, diagWarn }))
    }, 2000)

    return () => { alive = false; clearInterval(id); clearInterval(tick); try { rosout.unsubscribe() } catch (e) {}; try { diagTopic.unsubscribe() } catch (e) {} }
  }, [ros, status])

  return stats
}

export default function App() {
  const { ros, status, url, connect, recent } = useRos()
  const [input, setInput] = useState(url)
  const [tab, setTab] = useState(0)
  const [menuEl, setMenuEl] = useState(null)
  const stats = useHeaderStats(ros, status)

  useEffect(() => setInput(url), [url])

  const connected = status === 'connected'
  const statusColor = connected ? 'success' : status === 'connecting' ? 'warning' : 'error'
  const statusLabel = connected ? 'verbunden' : status === 'connecting' ? 'verbinde …' : 'getrennt'

  let health = { c: 'success', t: 'OK' }
  if (!connected) health = { c: 'default', t: 'GETRENNT' }
  else if (stats.err > 0 || stats.diagErr > 0) health = { c: 'error', t: 'PROBLEM' }
  else if (stats.warn > 0 || stats.diagWarn > 0) health = { c: 'warning', t: 'WARN' }

  const Panel = VISIBLE_TABS[tab][1]
  const showOffline = OFFLINE_OK.has(VISIBLE_TABS[tab][0])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img src={logoLight} alt="NEXOS.Group" style={{ height: 88, display: 'block' }} />
            <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
            <Typography sx={{ fontFamily: 'ui-monospace,Menlo,monospace', color: 'text.secondary', letterSpacing: 1, fontSize: 15 }}>
              ros_status
            </Typography>
          </Box>

          {/* Connection manager — nur im LAN (http). Oeffentlich (https) laeuft
              alles ueber den Service, keine Direkt-ws-Verbindung. */}
          {!pageIsHttps && (<>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <TextField
              size="small" label="Bridge (ws://robot:9090)" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connect(input)}
              sx={{ width: 280 }}
            />
            <Button variant="contained" onClick={() => connect(input)}>Verbinden</Button>
            <Tooltip title="Zuletzt verwendet">
              <IconButton onClick={(e) => setMenuEl(e.currentTarget)}><HistoryIcon /></IconButton>
            </Tooltip>
            <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
              {recent.length === 0 && <MenuItem disabled>keine</MenuItem>}
              {recent.map((u) => (
                <MenuItem key={u} onClick={() => { setMenuEl(null); setInput(u); connect(u) }}>{u}</MenuItem>
              ))}
            </Menu>
            <Chip size="small" color={statusColor} variant="outlined"
              icon={<CircleIcon sx={{ fontSize: 12 }} />} label={statusLabel} />
          </>)}

          <Box sx={{ flexGrow: 1 }} />

          {!pageIsHttps && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" variant="outlined" label={`${stats.nodes} Nodes`} />
              <Chip size="small" variant="outlined" label={`${stats.topics} Topics`} />
              <Chip size="small" variant="outlined" color={stats.warn ? 'warning' : 'default'} label={`${stats.warn} Warn/60s`} />
              <Chip size="small" variant="outlined" color={stats.err ? 'error' : 'default'} label={`${stats.err} Err/60s`} />
              <Chip size="small" variant="outlined" color={stats.diagErr ? 'error' : stats.diagWarn ? 'warning' : 'default'}
                label={`Diag ${stats.diagErr}✕ / ${stats.diagWarn}⚠`} />
              <Chip size="small" color={health.c} label={health.t} />
            </Stack>
          )}
        </Toolbar>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {VISIBLE_TABS.map(([name]) => <Tab key={name} label={name} />)}
        </Tabs>
      </AppBar>

      <Box sx={{ p: 2, maxWidth: 1360, mx: 'auto' }}>
        {connected || showOffline ? <Panel ros={ros} /> : (
          <Typography sx={{ p: 4, color: 'text.secondary', textAlign: 'center' }}>
            Nicht verbunden — Bridge-URL eingeben und „Verbinden" klicken.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
