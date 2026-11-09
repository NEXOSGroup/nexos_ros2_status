import { useEffect, useState } from 'react'
import {
  AppBar, Toolbar, Box, Typography, Button, Chip, Tabs, Tab, Stack, Divider,
} from '@mui/material'
import logoLight from './assets/nexos-logo-light.png'
import { useRos, pageIsHttps } from './ros'
import {
  HomePanel, SettingsPanel, TelemetryPanel,
  SystemPanel, NodesPanel, TopicsPanel, LifecyclePanel,
  DiagnosticsPanel, ControlPanel, LogsPanel,
} from './panels'

// Entwickler-/ROS-Ansichten eines UGV — brauchen eine direkte ws-Verbindung,
// daher nur im LAN (http) und auf der UGV-Unterseite.
const DEV_TABS = [
  ['System', SystemPanel],
  ['Nodes', NodesPanel],
  ['Topics', TopicsPanel],
  ['Lifecycle', LifecyclePanel],
  ['Diagnostics', DiagnosticsPanel],
  ['ros2_control', ControlPanel],
  ['Logs', LogsPanel],
]

// Mini-Hash-Router: '' -> Startseite, '#/settings', '#/ugv/<id>'.
function useHashRoute() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''))
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const h = (hash || '').replace(/^#\/?/, '')
  if (h === 'settings') return { name: 'settings' }
  const m = h.match(/^ugv\/(.+)$/)
  if (m) return { name: 'ugv', id: decodeURIComponent(m[1]) }
  return { name: 'home' }
}

export default function App() {
  const { ros, status, ugvs, connect, url } = useRos()
  const route = useHashRoute()
  const [devTab, setDevTab] = useState(0)

  const routeUgv = route.name === 'ugv' ? (ugvs || []).find((u) => u.id === route.id) : null

  // UGV-Unterseite im LAN (http): ws zu genau diesem UGV verbinden, damit die
  // Dev-Tabs dessen Daten zeigen. Auf https passiert nichts (kein ws).
  useEffect(() => {
    if (pageIsHttps) return
    if (route.name === 'ugv' && routeUgv && routeUgv.ws_url && url !== routeUgv.ws_url) {
      connect(routeUgv.ws_url)
    }
  }, [route.name, route.id, routeUgv, url, connect])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1.5, py: 1 }}>
          <Box component="a" href="#/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
            <img src={logoLight} alt="NEXOS.Group" style={{ height: 72, display: 'block' }} />
            <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />
            <Typography sx={{ fontFamily: 'ui-monospace,Menlo,monospace', color: 'text.secondary', letterSpacing: 1, fontSize: 15 }}>
              ros_status
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {route.name !== 'home' && (
            <Button href="#/" size="small" variant="outlined">← Startseite</Button>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, maxWidth: 1360, mx: 'auto' }}>
        {route.name === 'home' && <HomePanel />}
        {route.name === 'settings' && <SettingsPanel />}
        {route.name === 'ugv' && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">{routeUgv?.name || route.id}</Typography>
              {routeUgv && (
                <Chip size="small" color={routeUgv.online ? 'success' : 'default'}
                  variant={routeUgv.online ? 'filled' : 'outlined'} label={routeUgv.online ? 'online' : 'offline'} />
              )}
            </Stack>

            <TelemetryPanel ugvId={route.id} />

            {!pageIsHttps && (
              <Box>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="overline" color="text.secondary">
                  Entwickler (LAN) · ws {status === 'connected' ? 'verbunden' : status}
                </Typography>
                <Tabs value={devTab} onChange={(e, v) => setDevTab(v)} variant="scrollable" scrollButtons="auto"
                  sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  {DEV_TABS.map(([name]) => <Tab key={name} label={name} />)}
                </Tabs>
                <Box sx={{ pt: 2 }}>
                  {status === 'connected'
                    ? (() => { const P = DEV_TABS[devTab][1]; return <P ros={ros} /> })()
                    : <Typography sx={{ p: 2, color: 'text.secondary' }}>
                        Nicht ws-verbunden — im LAN verbindet sich das Dashboard automatisch mit diesem UGV.
                      </Typography>}
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  )
}
