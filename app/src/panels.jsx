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
