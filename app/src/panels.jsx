import { useEffect, useMemo, useRef, useState } from 'react'
import * as ROSLIB from 'roslib'
import {
  Card, CardHeader, CardContent, List, ListItemButton, ListItem, ListItemText,
  Chip, TextField, Button, Stack, Drawer, Box, Typography, LinearProgress,
  IconButton, ToggleButton, ToggleButtonGroup, Divider, Tooltip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'

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
export function SystemPanel({ ros }) {
  const [host, setHost] = useState(null)
  const [info, setInfo] = useState([])
  useEffect(() => {
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/diagnostics', messageType: 'diagnostic_msgs/msg/DiagnosticArray' })
    t.subscribe((m) => {
      const h = (m.status || []).find((s) => (s.name || '').toLowerCase().startsWith('host'))
      if (h) setHost(h)
    })
    const sv = new ROSLIB.Service({ ros, name: '/rosapi/get_ros_version', serviceType: 'rosapi_msgs/srv/GetROSVersion' })
    sv.callService({},
      (r) => setInfo([['ROS Distro', r.distro], ['ROS version', r.version]]),
      () => setInfo([]))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros])

  return (
    <Box sx={grid2}>
      <PanelCard title={`Host-Vitals ${host ? '· ' + (host.hardware_id || '') : ''}`}>
        {!host ? <Empty>Warte auf nexos_status_agent (/diagnostics) …</Empty> : (
          <List dense>
            {(host.values || []).map((v) => {
              const num = parseFloat(v.value); const pct = /%/.test(v.key) && !isNaN(num)
              return (
                <ListItem key={v.key} secondaryAction={<Typography sx={mono}>{v.value}</Typography>}>
                  <ListItemText primary={v.key} primaryTypographyProps={{ color: 'text.secondary' }} />
                  {pct && <Box sx={{ width: 120, mr: 10 }}><LinearProgress variant="determinate" value={Math.min(100, num)} /></Box>}
                </ListItem>
              )
            })}
          </List>
        )}
      </PanelCard>
      <PanelCard title="System">
        <List dense>
          {info.map(([k, v]) => (
            <ListItem key={k} secondaryAction={<Typography sx={mono}>{v}</Typography>}>
              <ListItemText primary={k} primaryTypographyProps={{ color: 'text.secondary' }} />
            </ListItem>
          ))}
          <ListItem secondaryAction={<Typography sx={mono}>{ros?.socket?.url || ''}</Typography>}>
            <ListItemText primary="Bridge" primaryTypographyProps={{ color: 'text.secondary' }} />
          </ListItem>
        </List>
      </PanelCard>
    </Box>
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
  return (
    <PanelCard title="Diagnostics (/diagnostics)" count={keys.length}>
      {keys.length ? (
        <List dense>
          {keys.map((k) => {
            const s = map[k]; const d = DIAG[s.level] || ['?', 'default']
            return (
              <ListItem key={k}>
                <Chip size="small" color={d[1]} variant="outlined" label={d[0]} sx={{ mr: 1.5 }} />
                <ListItemText primary={s.name} primaryTypographyProps={{ sx: mono }} />
                <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end">
                  {(s.values || []).map((v) => (
                    <Chip key={v.key} size="small" variant="outlined"
                      label={<span><span style={{ color: '#8b98a5' }}>{v.key}</span> {v.value}</span>} />
                  ))}
                </Stack>
              </ListItem>
            )
          })}
        </List>
      ) : <Empty>Warte auf /diagnostics …</Empty>}
    </PanelCard>
  )
}

/* ---------------- ros2_control ---------------- */
export function ControlPanel({ ros }) {
  const [controllers, setControllers] = useState(null)
  const [hw, setHw] = useState(null)
  const [joints, setJoints] = useState([])
  const refresh = () => {
    if (!ros) return
    const cm = '/controller_manager'
    new ROSLIB.Service({ ros, name: cm + '/list_controllers', serviceType: 'controller_manager_msgs/srv/ListControllers' })
      .callService({}, (r) => setControllers(r.controller || []), () => setControllers([]))
    new ROSLIB.Service({ ros, name: cm + '/list_hardware_components', serviceType: 'controller_manager_msgs/srv/ListHardwareComponents' })
      .callService({}, (r) => setHw(r.component || []), () => setHw([]))
  }
  useEffect(() => {
    refresh()
    if (!ros) return
    const t = new ROSLIB.Topic({ ros, name: '/joint_states', messageType: 'sensor_msgs/msg/JointState' })
    t.subscribe((m) => setJoints((m.name || []).map((n, i) => ({
      name: n,
      pos: m.position && m.position[i] != null ? m.position[i].toFixed(4) : '–',
      vel: m.velocity && m.velocity[i] != null ? m.velocity[i].toFixed(3) : '–',
    }))))
    return () => { try { t.unsubscribe() } catch (e) {} }
  }, [ros]) // eslint-disable-line

  const stColor = (s) => s === 'active' ? 'success' : s === 'inactive' ? 'warning' : 'default'
  return (
    <Box sx={grid2}>
      <PanelCard title="Controller" onRefresh={refresh}>
        {controllers == null ? <Empty>„⟳" (controller_manager nötig)</Empty> :
          controllers.length ? (
            <List dense>{controllers.map((c) => (
              <ListItem key={c.name} secondaryAction={<Chip size="small" variant="outlined" color={stColor(c.state)} label={c.state} />}>
                <ListItemText primary={c.name} secondary={c.type} primaryTypographyProps={{ sx: mono }}
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
      <PanelCard title="Joints (/joint_states)">
        {joints.length ? (
          <List dense>{joints.map((j) => (
            <ListItem key={j.name} secondaryAction={
              <Stack direction="row" spacing={0.5}>
                <Chip size="small" variant="outlined" label={`pos ${j.pos}`} />
                <Chip size="small" variant="outlined" label={`vel ${j.vel}`} />
              </Stack>}>
              <ListItemText primary={j.name} primaryTypographyProps={{ sx: mono }} />
            </ListItem>
          ))}</List>
        ) : <Empty>Warte auf /joint_states …</Empty>}
      </PanelCard>
    </Box>
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
