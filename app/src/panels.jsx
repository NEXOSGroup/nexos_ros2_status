import { useEffect, useMemo, useRef, useState } from 'react'
import * as ROSLIB from 'roslib'
import {
  Card, CardHeader, CardContent, List, ListItemButton, ListItem, ListItemText,
  Chip, TextField, Button, Stack, Drawer, Box, Typography, LinearProgress,
  IconButton, ToggleButton, ToggleButtonGroup, Divider, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, CircularProgress,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge'
import { LineChart } from '@mui/x-charts/LineChart'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'

const grid2 = { display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }
const LVL = { 10: 'DEBUG', 20: 'INFO', 30: 'WARN', 40: 'ERROR', 50: 'FATAL' }
const LVL_COLOR = { DEBUG: 'text.secondary', INFO: 'info.main', WARN: 'warning.main', ERROR: 'error.main', FATAL: 'error.main' }
const DIAG = { 0: ['OK', 'success'], 1: ['WARN', 'warning'], 2: ['ERROR', 'error'], 3: ['STALE', 'default'] }

function PanelCard({ title, count, onRefresh, children, sx }) {
  return (
    <Card sx={sx}>
      <CardHeader
        title={title}
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }}
        action={<Stack direction="row" spacing={1} alignItems="center">
          {count != null && <Chip size="small" color="primary" variant="outlined" label={count} />}
          {onRefresh && <IconButton size="small" onClick={onRefresh}><RefreshIcon fontSize="small" /></IconButton>}
        </Stack>}
        sx={{ py: 1 }}
      />
      <Divider />
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, maxHeight: '70vh', overflow: 'auto' }}>{children}</CardContent>
    </Card>
  )
}

const Empty = ({ children }) => <Typography sx={{ p: 2, color: 'text.secondary' }}>{children}</Typography>
const mono = { fontFamily: 'ui-monospace,Menlo,monospace', wordBreak: 'break-all' }

/* ---------------- System ---------------- */
const hv = (host, key) => {
  const v = (host?.values || []).find((x) => x.key === key)
  return v ? parseFloat(v.value) : NaN
}
const fmtUptime = (s) => {
  if (!s || isNaN(s)) return '–'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return (d ? d + 'd ' : '') + h + 'h ' + m + 'm'
}
const gcolor = (v, warn, err) => isNaN(v) ? '#8b98a5' : v >= err ? '#f85149' : v >= warn ? '#d29922' : '#3fb950'

export function SystemPanel({ ros }) {
  const [host, setHost] = useState(null)
  const [info, setInfo] = useState([])
  const hist = useRef([])
  const [, force] = useState(0)

  useEffect(() => {
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    t.subscribe((m) => {
      const h = (m.status || []).find((s) => (s.name || '').toLowerCase().startsWith('host'))
      if (!h) return
      setHost(h)
      hist.current = [...hist.current, { cpu: hv(h, 'CPU %'), temp: hv(h, 'Temp C'), mem: hv(h, 'Mem %') }].slice(-60)
      force((n) => n + 1)
    })
    const sv = new ROSLIB.Service({ ros, name: '/rosapi/get_ros_version', serviceType: 'rosapi_msgs/srv/GetROSVersion' })
    sv.callService({}, (r) => setInfo([['ROS Distro', r.distro], ['ROS version', r.version]]), () => setInfo([]))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros])

  const h = hist.current
  const gauges = [
    { label: 'CPU', value: hv(host, 'CPU %'), warn: 80, err: 95, unit: '%', max: 100 },
    { label: 'RAM', value: hv(host, 'Mem %'), warn: 80, err: 92, unit: '%', max: 100 },
    { label: 'Disk', value: hv(host, 'Disk / %'), warn: 85, err: 95, unit: '%', max: 100 },
    { label: 'Temp', value: hv(host, 'Temp C'), warn: 70, err: 82, unit: '°C', max: 100 },
  ]

  return (
    <Stack spacing={2}>
      <Card>
        <CardHeader title={`Host-Vitals ${host ? '· ' + (host.hardware_id || '') : ''}`}
          titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
        <Divider />
        <CardContent>
          {!host ? <Empty>Warte auf nexos_status_agent …</Empty> : (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              {gauges.map((g) => (
                <Box key={g.label} sx={{ textAlign: 'center' }}>
                  <Gauge height={160} value={isNaN(g.value) ? 0 : g.value} valueMax={g.max}
                    startAngle={-110} endAngle={110} innerRadius="66%" cornerRadius="50%"
                    text={() => (isNaN(g.value) ? '–' : `${g.value.toFixed(0)}${g.unit}`)}
                    sx={{
                      [`& .${gaugeClasses.valueArc}`]: { fill: gcolor(g.value, g.warn, g.err) },
                      [`& .${gaugeClasses.referenceArc}`]: { fill: '#2a333d' },
                      [`& .${gaugeClasses.valueText}`]: { fontSize: 22, fontWeight: 700 },
                    }} />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: -1 }}>{g.label}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={grid2}>
        <Card>
          <CardHeader title="Verlauf · CPU / Temperatur"
            titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
          <Divider />
          <CardContent>
            {h.length > 1 ? (
              <LineChart height={240}
                margin={{ top: 20, right: 16, bottom: 20, left: 40 }}
                xAxis={[{ data: h.map((_, i) => i), scaleType: 'point' }]}
                series={[
                  { data: h.map((x) => (isNaN(x.cpu) ? null : x.cpu)), label: 'CPU %', color: '#c8a34e', showMark: false, area: true, curve: 'monotoneX' },
                  { data: h.map((x) => (isNaN(x.temp) ? null : x.temp)), label: 'Temp °C', color: '#f85149', showMark: false, curve: 'monotoneX' },
                ]}
                slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'end' } } }} />
            ) : <Empty>sammle Messwerte …</Empty>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="System" titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
          <Divider />
          <CardContent sx={{ p: 0 }}>
            <List dense>
              {info.map(([k, v]) => (
                <ListItem key={k} secondaryAction={<Typography sx={mono}>{v}</Typography>}>
                  <ListItemText primary={k} primaryTypographyProps={{ color: 'text.secondary' }} />
                </ListItem>
              ))}
              <ListItem secondaryAction={<Typography sx={mono}>{fmtUptime(hv(host, 'Uptime s'))}</Typography>}>
                <ListItemText primary="Uptime" primaryTypographyProps={{ color: 'text.secondary' }} /></ListItem>
              <ListItem secondaryAction={<Typography sx={mono}>{isNaN(hv(host, 'Load 1m')) ? '–' : hv(host, 'Load 1m').toFixed(2)}</Typography>}>
                <ListItemText primary="Load (1m)" primaryTypographyProps={{ color: 'text.secondary' }} /></ListItem>
              <ListItem secondaryAction={<Typography sx={mono}>{isNaN(hv(host, 'Mem total MB')) ? '–' : (hv(host, 'Mem total MB') / 1024).toFixed(1) + ' GB'}</Typography>}>
                <ListItemText primary="RAM gesamt" primaryTypographyProps={{ color: 'text.secondary' }} /></ListItem>
              <ListItem secondaryAction={<Typography sx={mono}>{ros?.socket?.url || ''}</Typography>}>
                <ListItemText primary="Bridge" primaryTypographyProps={{ color: 'text.secondary' }} /></ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}

/* ---------------- Nodes ---------------- */
export function NodesPanel({ ros }) {
  const [nodes, setNodes] = useState([])
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const refresh = () => ros && ros.getNodes((n) => setNodes(n.sort()), () => {})
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id) }, [ros]) // eslint-disable-line

  const open = (n) => ros.getNodeDetails(n, (subs, pubs, srvs) =>
    setDetail({ name: n, pubs: pubs || [], subs: subs || [], srvs: srvs || [] }), () => {})
  const view = nodes.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))

  return (
    <PanelCard title="Nodes" count={nodes.length} onRefresh={refresh}>
      <Box sx={{ p: 1 }}><TextField size="small" fullWidth placeholder="filtern…" value={filter} onChange={(e) => setFilter(e.target.value)} /></Box>
      <List dense>
        {view.length ? view.map((n) => (
          <ListItemButton key={n} onClick={() => open(n)}>
            <ListItemText primary={n} primaryTypographyProps={{ sx: mono }} />
            <Chip size="small" variant="outlined" label="Details ›" />
          </ListItemButton>
        )) : <Empty>keine Nodes</Empty>}
      </List>
      <Drawer anchor="right" open={!!detail} onClose={() => setDetail(null)}
        PaperProps={{ sx: { width: 'min(440px,92vw)' } }}>
        {detail && (
          <Box>
            <Stack direction="row" alignItems="center" sx={{ p: 2 }}>
              <Typography sx={{ ...mono, flexGrow: 1 }}>{detail.name}</Typography>
              <IconButton onClick={() => setDetail(null)}><CloseIcon /></IconButton>
            </Stack>
            <Divider />
            {[['Publications', detail.pubs], ['Subscriptions', detail.subs], ['Services', detail.srvs]].map(([t, arr]) => (
              <Box key={t} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="overline" color="text.secondary">{t} ({arr.length})</Typography>
                {arr.length ? arr.map((x) => <Typography key={x} sx={mono}>{x}</Typography>)
                  : <Typography color="text.secondary">—</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </Drawer>
    </PanelCard>
  )
}

/* ---------------- Topics ---------------- */
export function TopicsPanel({ ros }) {
  const [topics, setTopics] = useState([])
  const [filter, setFilter] = useState('')
  const [hz, setHz] = useState({})
  const subRef = useRef(null)
  const refresh = () => ros && ros.getTopics((r) =>
    setTopics((r.topics || []).map((t, i) => ({ name: t, type: (r.types || [])[i] || '' })).sort((a, b) => a.name < b.name ? -1 : 1)), () => {})
  useEffect(() => { refresh() }, [ros]) // eslint-disable-line

  const measure = (t) => {
    if (subRef.current) { try { subRef.current.unsubscribe() } catch (e) {} }
    setHz((h) => ({ ...h, [t.name]: '…' }))
    let n = 0; const t0 = Date.now()
    const s = new ROSLIB.Topic({ ros, name: t.name, messageType: t.type })
    s.subscribe(() => { n++ }); subRef.current = s
    setTimeout(() => {
      const dt = (Date.now() - t0) / 1000
      setHz((h) => ({ ...h, [t.name]: (n / dt).toFixed(1) + ' Hz' }))
      try { s.unsubscribe() } catch (e) {}
    }, 3000)
  }
  const view = topics.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <PanelCard title="Topics (Klick misst Hz)" count={topics.length} onRefresh={refresh}>
      <Box sx={{ p: 1 }}><TextField size="small" fullWidth placeholder="filtern…" value={filter} onChange={(e) => setFilter(e.target.value)} /></Box>
      <List dense>
        {view.length ? view.map((t) => (
          <ListItemButton key={t.name} onClick={() => measure(t)}>
            <ListItemText primary={t.name} secondary={t.type}
              primaryTypographyProps={{ sx: mono }} secondaryTypographyProps={{ sx: mono, color: 'text.secondary' }} />
            {hz[t.name] && <Chip size="small" color="primary" variant="outlined" label={hz[t.name]} />}
          </ListItemButton>
        )) : <Empty>keine Topics</Empty>}
      </List>
    </PanelCard>
  )
}

/* ---------------- Lifecycle ---------------- */
export function LifecyclePanel({ ros }) {
  const [nodes, setNodes] = useState([])
  const [states, setStates] = useState({})
  const scan = () => ros && ros.getServices((all) => {
    const lc = all.filter((s) => s.endsWith('/get_state')).map((s) => s.replace(/\/get_state$/, ''))
    setNodes(lc)
    lc.forEach((n) => {
      const sv = new ROSLIB.Service({ ros, name: n + '/get_state', serviceType: 'lifecycle_msgs/srv/GetState' })
      sv.callService({},
        (r) => setStates((st) => ({ ...st, [n]: (r.current_state && r.current_state.label) || '?' })), () => {})
    })
  }, () => {})
  useEffect(() => { scan() }, [ros]) // eslint-disable-line

  const trans = (n, id) => {
    const sv = new ROSLIB.Service({ ros, name: n + '/change_state', serviceType: 'lifecycle_msgs/srv/ChangeState' })
    sv.callService({ transition: { id } }, () => setTimeout(scan, 400), () => setTimeout(scan, 400))
  }
  return (
    <PanelCard title="Lifecycle-Nodes" count={nodes.length} onRefresh={scan}>
      {nodes.length ? (
        <List dense>
          {nodes.map((n) => (
            <ListItem key={n} secondaryAction={
              <Stack direction="row" spacing={0.5}>
                <Button size="small" onClick={() => trans(n, 1)}>configure</Button>
                <Button size="small" onClick={() => trans(n, 3)}>activate</Button>
                <Button size="small" onClick={() => trans(n, 4)}>deactivate</Button>
              </Stack>}>
              <ListItemText primary={n} primaryTypographyProps={{ sx: mono }} />
              <Chip size="small" variant="outlined"
                color={states[n] === 'active' ? 'success' : states[n] === 'inactive' ? 'warning' : 'default'}
                label={states[n] || '…'} sx={{ mr: 2 }} />
            </ListItem>
          ))}
        </List>
      ) : <Empty>keine Lifecycle-Nodes</Empty>}
    </PanelCard>
  )
}

/* ---------------- Diagnostics ---------------- */
export function DiagnosticsPanel({ ros }) {
  const [map, setMap] = useState({})
  useEffect(() => {
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    t.subscribe((m) => setMap((prev) => {
      const next = { ...prev }; (m.status || []).forEach((s) => { next[s.name] = s }); return next
    }))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros])
  const keys = Object.keys(map).sort()
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 }
  keys.forEach((k) => { counts[map[k].level] = (counts[map[k].level] || 0) + 1 })
  const accent = { success: '#3fb950', warning: '#d29922', error: '#f85149', default: '#8b98a5' }

  return (
    <Card>
      <CardHeader title="Diagnostics (/diagnostics)"
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }}
        action={<Stack direction="row" spacing={1}>
          {[[0, 'OK'], [1, 'WARN'], [2, 'ERROR'], [3, 'STALE']].map(([lv, lbl]) => (
            <Chip key={lv} size="small" color={DIAG[lv][1]} variant={counts[lv] ? 'filled' : 'outlined'} label={`${counts[lv] || 0} ${lbl}`} />
          ))}
        </Stack>} />
      <Divider />
      <CardContent sx={{ p: 0, maxHeight: '72vh', overflow: 'auto' }}>
        {keys.length ? keys.map((k) => {
          const s = map[k]; const d = DIAG[s.level] || ['?', 'default']
          return (
            <Box key={k} sx={{ borderLeft: `3px solid ${accent[d[1]]}`, px: 2, py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" color={d[1]} label={d[0]} />
                <Typography sx={{ ...mono, flexGrow: 1 }}>{s.name}</Typography>
                <Typography variant="caption" color="text.secondary">{s.message}</Typography>
              </Stack>
              {(s.values || []).length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {(s.values || []).map((v) => {
                    const num = parseFloat(v.value); const pct = /%/.test(v.key) && !isNaN(num)
                    return (
                      <Box key={v.key} sx={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 1, alignItems: 'baseline', py: 0.3 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{v.key}</Typography>
                        <Box>
                          <Typography variant="caption" sx={{ fontFamily: 'ui-monospace,Menlo,monospace', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{v.value}</Typography>
                          {pct && <LinearProgress variant="determinate" value={Math.min(100, num)}
                            sx={{ height: 6, borderRadius: 3, mt: 0.3, bgcolor: '#2a333d', '& .MuiLinearProgress-bar': { backgroundColor: gcolor(num, 80, 92) } }} />}
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )
        }) : <Empty>Warte auf /diagnostics …</Empty>}
      </CardContent>
    </Card>
  )
}

/* ---------------- ros2_control ---------------- */
/* Remote drive on/off — switches epos-bringup.service on the UGV via
   /nexos/epos/power (SetBool); live state from /nexos/epos/power_state (Bool). */
function PowerCard({ ros }) {
  const [on, setOn] = useState(null)         // null = unbekannt, sonst bool
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // true=ein, false=aus, null=zu
  const [snack, setSnack] = useState(null)      // { ok, text }

  useEffect(() => {
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/nexos/epos/power_state', messageType: 'std_msgs/msg/Bool' })
    t.subscribe((m) => setOn(!!m.data))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros])

  const doSwitch = (data) => {
    setConfirm(null); setBusy(true)
    new ROSLIB.Service({ ros, name: '/nexos/epos/power', serviceType: 'std_srvs/srv/SetBool' })
      .callService({ data },
        (r) => { setBusy(false); setSnack({ ok: !!r.success, text: r.message || (r.success ? 'ok' : 'Fehler') }) },
        (e) => { setBusy(false); setSnack({ ok: false, text: 'Service nicht erreichbar: ' + e }) })
  }

  const known = on !== null
  const stChip = !known
    ? <Chip size="small" variant="outlined" label="Status unbekannt" />
    : <Chip size="small" color={on ? 'success' : 'default'} variant={on ? 'filled' : 'outlined'}
        icon={<PowerSettingsNewIcon sx={{ fontSize: 14 }} />}
        label={on ? 'EIN · Motor bestromt' : 'AUS · stromlos'} />

  return (
    <Card sx={{ borderColor: '#c8a34e55' }}>
      <CardHeader
        avatar={<PowerSettingsNewIcon sx={{ color: '#c8a34e' }} />}
        title="Antrieb · Ein / Aus"
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }}
        action={stChip} sx={{ py: 1 }} />
      <Divider />
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" color="success" startIcon={<PowerSettingsNewIcon />}
            disabled={busy || on === true} onClick={() => setConfirm(true)}>Einschalten</Button>
          <Button variant="outlined" color="error"
            disabled={busy || on === false} onClick={() => setConfirm(false)}>Ausschalten</Button>
          {busy && <CircularProgress size={20} />}
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ ...mono }}>
            epos-bringup.service @ UGV
          </Typography>
        </Stack>
      </CardContent>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm ? 'Antrieb einschalten?' : 'Antrieb ausschalten?'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm
              ? 'Der EPOS-Bringup wird gestartet und der Motor wird BESTROMT. Achse frei? Niemand im Gefahrenbereich?'
              : 'Der EPOS-Bringup wird gestoppt, der Motor wird stromlos. Eine laufende Bewegung stoppt sofort.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Abbrechen</Button>
          <Button variant="contained" color={confirm ? 'success' : 'error'} onClick={() => doSwitch(confirm)}>
            {confirm ? 'Jetzt einschalten' : 'Jetzt ausschalten'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={6000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.ok ? 'success' : 'error'} variant="filled"
          onClose={() => setSnack(null)}>{snack.text}</Alert> : undefined}
      </Snackbar>
    </Card>
  )
}

export function ControlPanel({ ros }) {
  const [controllers, setControllers] = useState(null)
  const [hw, setHw] = useState(null)
  const [hwIfaces, setHwIfaces] = useState(null)
  const [cmDiag, setCmDiag] = useState({})
  const [joints, setJoints] = useState([])
  const hist = useRef({})
  const [, force] = useState(0)
  const refresh = () => {
    if (!ros) return
    const cm = '/controller_manager'
    const callCm = () => {
      new ROSLIB.Service({ ros, name: cm + '/list_controllers', serviceType: 'controller_manager_msgs/srv/ListControllers' })
        .callService({}, (r) => setControllers(r.controller || []), () => setControllers([]))
      new ROSLIB.Service({ ros, name: cm + '/list_hardware_components', serviceType: 'controller_manager_msgs/srv/ListHardwareComponents' })
        .callService({}, (r) => setHw(r.component || []), () => setHw([]))
      new ROSLIB.Service({ ros, name: cm + '/list_hardware_interfaces', serviceType: 'controller_manager_msgs/srv/ListHardwareInterfaces' })
        .callService({}, (r) => setHwIfaces(r), () => setHwIfaces(null))
    }
    // Only poke the controller_manager if it actually exists — otherwise the
    // calls fail and rosbridge logs ERRORs that wrongly turn the health red
    // while the drive is simply switched off.
    new ROSLIB.Service({ ros, name: '/rosapi/services', serviceType: 'rosapi_msgs/srv/Services' })
      .callService({}, (r) => {
        if ((r.services || []).includes(cm + '/list_controllers')) callCm()
        else { setControllers([]); setHw([]); setHwIfaces(null) }
      }, () => callCm())
  }
  useEffect(() => {
    refresh()
    if (!ros) return
    // Keep controller/hardware lists live: they otherwise only refresh on mount,
    // so they'd stay empty after the drive is switched on via the power button.
    const ri = setInterval(refresh, 4000)
    const t = new ROSLIB.Topic({ ros, name: '/joint_states', messageType: 'sensor_msgs/msg/JointState' })
    t.subscribe((m) => {
      const js = (m.name || []).map((n, i) => ({
        name: n,
        pos: m.position && m.position[i] != null ? m.position[i] : null,
        vel: m.velocity && m.velocity[i] != null ? m.velocity[i] : null,
      }))
      setJoints(js)
      js.forEach((j) => {
        const arr = hist.current[j.name] || []
        arr.push({ pos: j.pos, vel: j.vel })
        hist.current[j.name] = arr.slice(-80)
      })
      force((n) => n + 1)
    })
    const td = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    td.subscribe((m) => setCmDiag((prev) => {
      const next = { ...prev }
      ;(m.status || []).forEach((s) => { if ((s.name || '').includes('controller_manager')) next[s.name] = s })
      return next
    }))
    return () => { clearInterval(ri); try { t.unsubscribe() } catch (e) {}; try { td.unsubscribe() } catch (e) {} }
  }, [ros]) // eslint-disable-line

  const stColor = (s) => s === 'active' ? 'success' : s === 'inactive' ? 'warning' : 'default'
  const fx = (v, d) => (v == null ? '–' : v.toFixed(d))
  return (
    <Stack spacing={2}>
      <PowerCard ros={ros} />
      <Box sx={grid2}>
        <PanelCard title="Controller" onRefresh={refresh}>
          {controllers == null ? <Empty>„⟳" (controller_manager nötig)</Empty> :
            controllers.length ? (
              <List dense>{controllers.map((c) => (
                <ListItem key={c.name} secondaryAction={<Chip size="small" variant="outlined" color={stColor(c.state)} label={c.state} />}>
                  <ListItemText primary={c.name}
                    secondary={`${c.type}${c.update_rate ? '  ·  ' + c.update_rate + ' Hz' : ''}  ·  ${(c.claimed_interfaces || []).length} claimed`}
                    primaryTypographyProps={{ sx: mono }}
                    secondaryTypographyProps={{ sx: mono, color: 'text.secondary' }} />
                </ListItem>
              ))}</List>
            ) : <Empty>keine Controller</Empty>}
        </PanelCard>
        <PanelCard title="Hardware-Komponenten">
          {hw == null ? <Empty>—</Empty> : hw.length ? (
            <List dense>{hw.map((h) => {
              const st = (h.state && h.state.label) || '?'
              return (
                <ListItem key={h.name} secondaryAction={<Chip size="small" variant="outlined" color={stColor(st)} label={st} />}>
                  <ListItemText primary={h.name} secondary={h.type} primaryTypographyProps={{ sx: mono }}
                    secondaryTypographyProps={{ sx: mono, color: 'text.secondary' }} />
                </ListItem>
              )
            })}</List>
          ) : <Empty>keine Komponenten</Empty>}
        </PanelCard>
      </Box>

      <Card>
        <CardHeader title="Joints · Live-Plots (/joint_states)"
          titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
        <Divider />
        <CardContent>
          {joints.length ? joints.map((j) => {
            const hh = hist.current[j.name] || []
            return (
              <Box key={j.name} sx={{ mb: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography sx={{ ...mono, flexGrow: 1 }}>{j.name}</Typography>
                  <Chip size="small" variant="outlined" sx={{ borderColor: '#c8a34e', color: '#c8a34e' }} label={`pos ${fx(j.pos, 3)} rad`} />
                  <Chip size="small" variant="outlined" color="info" label={`vel ${fx(j.vel, 3)} rad/s`} />
                </Stack>
                {hh.length > 1 ? (
                  <LineChart height={210}
                    margin={{ top: 16, right: 52, bottom: 20, left: 52 }}
                    xAxis={[{ data: hh.map((_, i) => i), scaleType: 'point' }]}
                    yAxis={[{ id: 'pos' }, { id: 'vel', position: 'right' }]}
                    series={[
                      { data: hh.map((x) => x.pos), label: 'pos rad', yAxisId: 'pos', color: '#c8a34e', showMark: false, curve: 'monotoneX' },
                      { data: hh.map((x) => x.vel), label: 'vel rad/s', yAxisId: 'vel', color: '#58a6ff', showMark: false, area: true, curve: 'monotoneX' },
                    ]}
                    slotProps={{ legend: { direction: 'row', position: { vertical: 'top', horizontal: 'end' } } }} />
                ) : <Empty>sammle Messwerte …</Empty>}
              </Box>
            )
          }) : <Empty>Warte auf /joint_states … (EPOS-Bringup auf dem UGV starten)</Empty>}
        </CardContent>
      </Card>

      <Box sx={grid2}>
        <PanelCard title="HW-Interfaces · command">
          {hwIfaces && hwIfaces.command_interfaces ? (hwIfaces.command_interfaces.length ? (
            <List dense>{hwIfaces.command_interfaces.map((i) => (
              <ListItem key={i.name} secondaryAction={<Stack direction="row" spacing={0.5}>
                <Chip size="small" variant="outlined" color={i.is_available ? 'success' : 'default'} label={i.is_available ? 'avail' : 'n/a'} />
                <Chip size="small" variant="outlined" color={i.is_claimed ? 'warning' : 'default'} label={i.is_claimed ? 'claimed' : 'free'} />
              </Stack>}>
                <ListItemText primary={i.name} primaryTypographyProps={{ sx: mono }} />
              </ListItem>
            ))}</List>
          ) : <Empty>keine</Empty>) : <Empty>—</Empty>}
        </PanelCard>
        <PanelCard title="HW-Interfaces · state">
          {hwIfaces && hwIfaces.state_interfaces ? (hwIfaces.state_interfaces.length ? (
            <List dense>{hwIfaces.state_interfaces.map((i) => (
              <ListItem key={i.name} secondaryAction={<Stack direction="row" spacing={0.5}>
                <Chip size="small" variant="outlined" color={i.is_available ? 'success' : 'default'} label={i.is_available ? 'avail' : 'n/a'} />
                <Chip size="small" variant="outlined" color={i.is_claimed ? 'warning' : 'default'} label={i.is_claimed ? 'claimed' : 'free'} />
              </Stack>}>
                <ListItemText primary={i.name} primaryTypographyProps={{ sx: mono }} />
              </ListItem>
            ))}</List>
          ) : <Empty>keine</Empty>) : <Empty>—</Empty>}
        </PanelCard>
      </Box>

      <Card>
        <CardHeader title="Timing / Jitter · controller_manager"
          titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
        <Divider />
        <CardContent>
          {Object.keys(cmDiag).length ? Object.values(cmDiag).map((s) => {
            const d = DIAG[s.level] || ['?', 'default']
            return (
              <Box key={s.name} sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color={d[1]} label={d[0]} />
                  <Typography sx={{ ...mono, flexGrow: 1 }}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.message}</Typography>
                </Stack>
                <Box sx={{ mt: 0.5 }}>
                  {(s.values || []).map((v) => (
                    <Box key={v.key} sx={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 1, alignItems: 'baseline', py: 0.2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{v.key}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'ui-monospace,Menlo,monospace', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{v.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )
          }) : <Empty>controller_manager-Diagnostics (EPOS-Bringup nötig) …</Empty>}
        </CardContent>
      </Card>
    </Stack>
  )
}

/* ---------------- ODIN (NEXOS.Defence UGV) ---------------- *
   Read-only Live-Telemetrie des realen ODIN-UGV. ODIN publisht Standard-ROS-
   Typen vom Telemetrie-Node: /odin/joint_states (JointState: pos rad, vel rad/s,
   effort A), /diagnostics (zwei Drive-Status "ODIN drive: track_*" + ein Funk-
   Status "ODIN radio: …") und /joy. Kein controller_manager — eigener Tab, der
   dem Muster von ControlPanel/SystemPanel folgt. Keine Steuerung, nur Anzeige. */

const ODIN_TRACKS = [
  { key: 'track_left', label: 'Kette links', diag: 'track_left', color: '#c8a34e' },
  { key: 'track_right', label: 'Kette rechts', diag: 'track_right', color: '#58a6ff' },
]

// KeyValue-Helfer für diagnostic_msgs/KeyValue-Listen
const dval = (status, key) => {
  const v = (status?.values || []).find((x) => x.key === key)
  return v ? v.value : undefined
}
const dnum = (status, key) => {
  const v = dval(status, key)
  const n = v == null ? NaN : parseFloat(v)
  return isNaN(n) ? NaN : n
}
const dhex = (status, key) => {
  const v = dval(status, key)
  if (v == null) return NaN
  const n = parseInt(String(v).replace(/^0x/i, ''), 16)
  return isNaN(n) ? NaN : n
}
const truthy = (v) => /^(1|true|yes|on|ok|ja)$/i.test(String(v ?? '').trim())

// CiA-402 Statusword → Betriebszustand (herstellerneutral, EPOS4 = CiA 402)
function decodeStatusword(sw) {
  if (isNaN(sw)) return { label: '—', color: 'default' }
  if ((sw & 0x4f) === 0x08) return { label: 'FAULT', color: 'error' }
  if ((sw & 0x4f) === 0x0f) return { label: 'Fault-Reaktion', color: 'error' }
  if ((sw & 0x6f) === 0x27) return { label: 'Operation enabled', color: 'success' }
  if ((sw & 0x6f) === 0x07) return { label: 'Quick-Stop aktiv', color: 'warning' }
  if ((sw & 0x6f) === 0x23) return { label: 'Switched on', color: 'warning' }
  if ((sw & 0x6f) === 0x21) return { label: 'Ready to switch on', color: 'default' }
  if ((sw & 0x4f) === 0x40) return { label: 'Switch-on disabled', color: 'default' }
  if ((sw & 0x4f) === 0x00) return { label: 'Not ready', color: 'default' }
  return { label: '0x' + (sw & 0xffff).toString(16).padStart(4, '0'), color: 'default' }
}

function OdinMetric({ label, value, unit, color, hint }) {
  return (
    <Box sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: '#0e1116', border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography sx={{ ...mono, fontSize: 18, fontWeight: 700, color: color || 'text.primary', lineHeight: 1.3 }}>
        {value}{value !== '–' && unit ? <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }}>{unit}</Typography> : null}
      </Typography>
      {hint && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, display: 'block' }}>{hint}</Typography>}
    </Box>
  )
}

const fnum = (v, d = 0) => (v == null || isNaN(v) ? '–' : v.toFixed(d))

// Funk-Panel (NBB nano-minor): E-Stop, Link, Modus, Knöpfe + Rohbytes
function OdinRadioCard({ diag, joy }) {
  const level = diag ? diag.level : null
  const d = DIAG[level] ?? ['—', 'default']
  const estopOk = diag ? truthy(dval(diag, 'e-stop ok')) : (joy ? joy.buttons?.[0] === 1 : null)
  const linkAge = dnum(diag, 'link age [s]')
  const mode = dval(diag, 'mode')
  const white = diag ? truthy(dval(diag, 'white button')) : (joy ? joy.buttons?.[3] === 1 : null)
  const reset = diag ? truthy(dval(diag, 'RESET (SW08)')) : (joy ? joy.buttons?.[1] === 1 : null)
  const raw = [
    ['byte0', dval(diag, 'byte0')], ['byte1', dval(diag, 'byte1')],
    ['fwd raw', dval(diag, 'fwd raw')], ['turn raw', dval(diag, 'turn raw')],
  ]
  return (
    <Card>
      <CardHeader title="Funk · NBB nano-minor"
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }}
        action={<Chip size="small" color={d[1]} variant={level ? 'filled' : 'outlined'} label={level != null ? d[0] : '—'} />} />
      <Divider />
      <CardContent>
        {!diag && joy == null ? <Empty>Warte auf Funk-Status …</Empty> : (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Chip color={estopOk === null ? 'default' : estopOk ? 'success' : 'error'}
                variant={estopOk ? 'filled' : 'outlined'}
                label={estopOk === null ? 'E-Stop ?' : estopOk ? 'E-STOP OK' : 'E-STOP AUSGELÖST'} />
              <Chip color={level === 0 ? 'success' : level === 1 ? 'warning' : level === 2 ? 'error' : 'default'}
                variant="outlined"
                label={`Funk ${isNaN(linkAge) ? '—' : 'Link-Age ' + linkAge.toFixed(2) + ' s'}`} />
              {mode && <Chip variant="outlined" sx={{ borderColor: '#c8a34e', color: '#c8a34e' }}
                label={`Modus: ${mode}`} />}
              {white != null && <Chip variant={white ? 'filled' : 'outlined'} color={white ? 'info' : 'default'}
                label="weißer Knopf" />}
              {reset != null && <Chip variant={reset ? 'filled' : 'outlined'} color={reset ? 'warning' : 'default'}
                label="RESET (SW08)" />}
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 1 }}>
              {raw.map(([k, v]) => <OdinMetric key={k} label={k} value={v ?? '–'} />)}
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

// Antriebs-Status einer Kette (ein Drive-Diagnostic + passender Joint)
function OdinTrackCard({ track, diag, joint }) {
  const sw = dhex(diag, 'statusword')
  const st = decodeStatusword(sw)
  const level = diag ? diag.level : null
  const d = DIAG[level] ?? ['—', 'default']
  const errCode = dhex(diag, 'error code')
  const errReg = dhex(diag, 'error register')
  const hasErr = (!isNaN(errCode) && errCode !== 0) || (!isNaN(errReg) && errReg !== 0)
  const currentA = joint?.eff != null ? joint.eff : (isNaN(dnum(diag, 'current avg [mA]')) ? null : dnum(diag, 'current avg [mA]') / 1000)
  const rows = [
    ['Betriebsart', dval(diag, 'mode display')],
    ['Statusword', !isNaN(sw) ? '0x' + (sw & 0xffff).toString(16).padStart(4, '0') : '–'],
    ['Error code', !isNaN(errCode) ? '0x' + errCode.toString(16).padStart(4, '0') : '–'],
    ['Error register', !isNaN(errReg) ? '0x' + errReg.toString(16).padStart(2, '0') : '–'],
    ['Moment', dval(diag, 'torque [1/1000 rated]') != null ? dval(diag, 'torque [1/1000 rated]') + ' ‰ rated' : '–'],
    ['Position', dval(diag, 'position [inc]') != null ? dval(diag, 'position [inc]') + ' inc' : '–'],
    ['Digital-Eingänge', dval(diag, 'digital inputs') ?? '–'],
  ]
  return (
    <Card sx={{ borderColor: st.color === 'error' ? '#f8514955' : undefined }}>
      <CardHeader
        title={track.label}
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }}
        action={<Stack direction="row" spacing={0.5}>
          <Chip size="small" color={st.color} variant={st.color === 'success' ? 'filled' : 'outlined'} label={st.label} />
          {level != null && <Chip size="small" color={d[1]} variant="outlined" label={d[0]} />}
        </Stack>}
        sx={{ py: 1 }} />
      <Divider />
      <CardContent>
        {!diag && !joint ? <Empty>Warte auf Antriebs-Daten … (odin-rc-drive)</Empty> : (
          <Stack spacing={1.5}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 1 }}>
              <OdinMetric label="Drehzahl" value={fnum(dnum(diag, 'velocity [rpm]'), 0)} unit="rpm" color={track.color} />
              <OdinMetric label="Ø Drehzahl" value={fnum(dnum(diag, 'velocity avg [rpm]'), 0)} unit="rpm" />
              <OdinMetric label="Strom" value={currentA == null ? '–' : currentA.toFixed(2)} unit="A"
                color={currentA != null && Math.abs(currentA) > 5 ? '#d29922' : undefined} />
              <OdinMetric label="Spannung" value={fnum(dnum(diag, 'supply [V]'), 1)} unit="V" />
              <OdinMetric label="Temperatur" value={dval(diag, 'temp 0x3201:1 [raw]') ?? '–'} unit="raw"
                hint="Rohwert · °C unbestätigt" color="#58a6ff" />
              <OdinMetric label="Pos (Kette)" value={joint?.pos != null ? joint.pos.toFixed(3) : '–'} unit="rad" />
            </Box>
            {hasErr && (
              <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
                Fehler aktiv — error code 0x{isNaN(errCode) ? '?' : errCode.toString(16)} / register 0x{isNaN(errReg) ? '?' : errReg.toString(16)}
              </Alert>
            )}
            <Box>
              {rows.map(([k, v]) => (
                <Box key={k} sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 1, py: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">{k}</Typography>
                  <Typography variant="caption" sx={mono}>{v}</Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

// Joystick-Visualisierung aus /joy (axes=[fwd, -turn])
function OdinJoyCard({ joy }) {
  const fwd = joy ? -(joy.axes?.[0] ?? 0) : 0   // Stick vor = positiv (Hardware liefert vor = negativ)
  const turn = joy ? -(joy.axes?.[1] ?? 0) : 0  // axes[1] = -turn → turn = -axes[1]
  const cx = 60 + Math.max(-1, Math.min(1, turn)) * 48
  const cy = 60 - Math.max(-1, Math.min(1, fwd)) * 48
  const btn = [['E-Stop', 0, 'success'], ['Reset', 1, 'warning'], ['Turtle', 2, 'info'], ['Weiß', 3, 'info']]
  return (
    <Card>
      <CardHeader title="Joystick · /joy"
        titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
      <Divider />
      <CardContent>
        {!joy ? <Empty>Warte auf /joy …</Empty> : (
          <Stack direction="row" spacing={2} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Box component="svg" viewBox="0 0 120 120" sx={{ width: 120, height: 120, flexShrink: 0 }}>
              <rect x="4" y="4" width="112" height="112" rx="10" fill="#0e1116" stroke="#2a333d" />
              <line x1="60" y1="8" x2="60" y2="112" stroke="#2a333d" strokeWidth="1" />
              <line x1="8" y1="60" x2="112" y2="60" stroke="#2a333d" strokeWidth="1" />
              <circle cx={cx} cy={cy} r="9" fill="#c8a34e" />
            </Box>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <Chip size="small" variant="outlined" sx={{ borderColor: '#c8a34e', color: '#c8a34e' }} label={`vor/zurück ${fwd.toFixed(2)}`} />
                <Chip size="small" variant="outlined" color="info" label={`drehen ${turn.toFixed(2)}`} />
              </Stack>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {btn.map(([lbl, i, col]) => {
                  const on = joy.buttons?.[i] === 1
                  return <Chip key={lbl} size="small" color={on ? col : 'default'} variant={on ? 'filled' : 'outlined'} label={lbl} />
                })}
              </Stack>
            </Stack>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

// Kompakte MUI-Sparkline mit Fläche + Live-Wert (Drehzahl / Strom je Kette)
function SparkTile({ label, value, unit, color, data }) {
  const ok = data.length > 1
  return (
    <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#0e1116', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography sx={{ ...mono, fontSize: 15, fontWeight: 700, color }}>
          {value}{value !== '–' && unit ? <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 0.4 }}>{unit}</Typography> : null}
        </Typography>
      </Stack>
      {ok ? (
        <SparkLineChart data={data} height={58} showHighlight showTooltip
          color={color} curve="monotoneX"
          sx={{ [`& .MuiLineElement-root`]: { strokeWidth: 2 } }} />
      ) : <Typography variant="caption" color="text.secondary">sammle Messwerte …</Typography>}
    </Box>
  )
}

export function OdinPanel({ ros }) {
  const [diagMap, setDiagMap] = useState({})
  const [joints, setJoints] = useState({})
  const [joy, setJoy] = useState(null)
  const hist = useRef({})
  const [, force] = useState(0)

  useEffect(() => {
    if (!ros) return
    const td = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    td.subscribe((m) => setDiagMap((prev) => {
      const next = { ...prev }
      ;(m.status || []).forEach((s) => { if (/odin/i.test(s.name || '')) next[s.name] = s })
      return next
    }))
    const tj = new ROSLIB.Topic({ ros, name: '/odin/joint_states', messageType: 'sensor_msgs/msg/JointState' })
    tj.subscribe((m) => {
      const next = {}
      ;(m.name || []).forEach((n, i) => {
        next[n] = {
          pos: m.position && m.position[i] != null ? m.position[i] : null,
          vel: m.velocity && m.velocity[i] != null ? m.velocity[i] : null,
          eff: m.effort && m.effort[i] != null ? m.effort[i] : null,
        }
        const arr = hist.current[n] || []
        arr.push({ vel: next[n].vel, eff: next[n].eff })
        hist.current[n] = arr.slice(-80)
      })
      setJoints(next)
      force((x) => x + 1)
    })
    const ty = new ROSLIB.Topic({ ros, name: '/joy', messageType: 'sensor_msgs/msg/Joy' })
    ty.subscribe((m) => setJoy({ axes: m.axes || [], buttons: m.buttons || [] }))
    return () => {
      try { td.unsubscribe() } catch (e) {}
      try { tj.unsubscribe() } catch (e) {}
      try { ty.unsubscribe() } catch (e) {}
    }
  }, [ros])

  const findDiag = (sub) => Object.values(diagMap).find((s) => /drive/i.test(s.name) && s.name.includes(sub))
  const radio = Object.values(diagMap).find((s) => /radio/i.test(s.name))
  const seen = Object.keys(diagMap).length > 0 || Object.keys(joints).length > 0 || joy != null

  return (
    <Stack spacing={2}>
      {!seen && (
        <Card>
          <CardContent>
            <Empty>
              Keine ODIN-Telemetrie. Oben im Verbindungs-Manager zu ODINs Bridge verbinden
              (<Box component="span" sx={mono}>ws://&lt;odin-ip&gt;:9090</Box>). Erwartet werden
              <Box component="span" sx={mono}> /odin/joint_states</Box>,
              <Box component="span" sx={mono}> /diagnostics</Box> (ODIN-Einträge) und
              <Box component="span" sx={mono}> /joy</Box>.
            </Empty>
          </CardContent>
        </Card>
      )}

      <OdinRadioCard diag={radio} joy={joy} />

      <Box sx={grid2}>
        {ODIN_TRACKS.map((t) => (
          <OdinTrackCard key={t.key} track={t} diag={findDiag(t.diag)} joint={joints[t.key]} />
        ))}
      </Box>

      <Card>
        <CardHeader title="Ketten · Live-Verlauf (/odin/joint_states)"
          titleTypographyProps={{ variant: 'overline', color: 'text.secondary' }} sx={{ py: 1 }} />
        <Divider />
        <CardContent>
          {ODIN_TRACKS.some((t) => (hist.current[t.key] || []).length > 1) ? (
            <Box sx={grid2}>
              {ODIN_TRACKS.map((t) => {
                const hh = hist.current[t.key] || []
                return (
                  <Box key={t.key}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color }} />
                      <Typography sx={mono}>{t.key}</Typography>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      <SparkTile label="Drehzahl" unit="rad/s" color={t.color}
                        value={fnum(joints[t.key]?.vel, 2)} data={hh.map((x) => x.vel ?? 0)} />
                      <SparkTile label="Strom" unit="A" color="#d29922"
                        value={fnum(joints[t.key]?.eff, 2)} data={hh.map((x) => x.eff ?? 0)} />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          ) : <Empty>Warte auf /odin/joint_states … (odin-rc-drive auf ODIN starten)</Empty>}
        </CardContent>
      </Card>

      <OdinJoyCard joy={joy} />
    </Stack>
  )
}

/* ---------------- Logs ---------------- */
export function LogsPanel({ ros }) {
  const [logs, setLogs] = useState([])
  const [minLvl, setMinLvl] = useState(0)
  const [q, setQ] = useState('')
  const [nodeF, setNodeF] = useState('')
  const boxRef = useRef(null)
  useEffect(() => {
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/rosout', messageType: 'rcl_interfaces/msg/Log' })
    t.subscribe((m) => setLogs((prev) => {
      const next = prev.concat({ lvl: m.level, name: m.name, msg: m.msg, id: prev.length })
      return next.length > 800 ? next.slice(next.length - 800) : next
    }))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros])

  const view = useMemo(() => logs.filter((l) =>
    l.lvl >= minLvl && (!q || l.msg.toLowerCase().includes(q.toLowerCase())) && (!nodeF || l.name.toLowerCase().includes(nodeF.toLowerCase()))
  ).slice(-300), [logs, minLvl, q, nodeF])
  useEffect(() => { const b = boxRef.current; if (b) b.scrollTop = b.scrollHeight }, [view])

  return (
    <PanelCard title="Log (/rosout)" count={logs.length}>
      <Stack direction="row" spacing={1} sx={{ p: 1 }} flexWrap="wrap" alignItems="center">
        <ToggleButtonGroup exclusive size="small" value={minLvl} onChange={(e, v) => v != null && setMinLvl(v)}>
          <ToggleButton value={0}>ALLE</ToggleButton>
          <ToggleButton value={20}>INFO+</ToggleButton>
          <ToggleButton value={30}>WARN+</ToggleButton>
          <ToggleButton value={40}>ERROR+</ToggleButton>
        </ToggleButtonGroup>
        <TextField size="small" placeholder="suche…" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextField size="small" placeholder="node…" value={nodeF} onChange={(e) => setNodeF(e.target.value)} />
        <Button size="small" onClick={() => setLogs([])}>leeren</Button>
      </Stack>
      <Box ref={boxRef} sx={{ maxHeight: '64vh', overflow: 'auto', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12.5 }}>
        {view.length ? view.map((l, i) => {
          const n = LVL[l.lvl] || l.lvl
          return (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '62px 170px 1fr', gap: 1, px: 1.5, py: 0.4, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ fontWeight: 700, color: LVL_COLOR[n] }}>{n}</Box>
              <Box sx={{ color: '#c8a34e', ...mono }}>{l.name}</Box>
              <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.msg}</Box>
            </Box>
          )
        }) : <Empty>keine Einträge</Empty>}
      </Box>
    </PanelCard>
  )
}
