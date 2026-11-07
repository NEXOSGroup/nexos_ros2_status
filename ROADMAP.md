# ros_status — Roadmap

The live ROS 2 operations cockpit for NEXOS. Everything below is reachable **live**
via `rosbridge` (topics + any service) and `rosapi` — grounded, not aspirational.

## ROS 2 capability surface (what we can tap)

| Area | Access |
|------|--------|
| Graph | `rosapi` `/nodes`, `/node_details`, `/topics(+for_type)`, `/services`, `/interfaces`, `/action_servers` |
| Parameters | `rosapi` `/params`, `get_param`, `set_param` (read **and** write) |
| Logs | `/rosout` topic; set logger levels at runtime |
| Lifecycle | per-node `get_state`, `get_available_transitions`, `change_state` |
| Diagnostics | `/diagnostics` (`diagnostic_msgs/DiagnosticArray`) |
| TF | `/tf`, `/tf_static` |
| ros2_control | `controller_manager/list_controllers`, `list_hardware_components`, `switch_controller`, `set_hardware_component_state` |
| Actions / Bags | action servers + goals; `ros2 bag` status (bridge to NEXOS.Link) |

## Feature modules

- **Mission-control header** — aggregated health traffic-light; vital tiles
  (#nodes/topics/services/actions, error/warn rate, controller_manager, RMW, DOMAIN_ID, uptime)
- **Host vitals** — CPU/RAM/temp/disk/net (via `nexos_status_agent` → `/diagnostics`)
- **Nodes** — live list + detail drawer (pub/sub/services/actions, params read+edit, logger level, lifecycle)
- **Topics** — type, pub/sub counts, **Hz + bandwidth**, QoS; live value preview + sparkline
- **Graph** — interactive node/topic graph (replaces rqt_graph)
- **Logs (/rosout) Pro** — per-node/level filter, regex search, pause, error-rate graph, severity histogram, export
- **Lifecycle** — states + transition timeline + trigger buttons
- **Diagnostics** — component tree OK/WARN/ERROR/STALE, values, history, alerting
- **ros2_control cockpit** — controllers load/switch/activate; hardware components + state;
  **overrun monitor** (actual vs target rate, read/write timing, missed cycles);
  **joint live view** (pos/vel/effort gauges + plots); **guarded jog/command panel** (safety gate)
- **Parameters** — per-node browser, edit/set, dump/load param sets
- **Plots** — any numeric field, multi-series, CSV export
- **Actions** — servers, goals in flight, feedback/status, cancel
- **Alerts/Events** — rules (node died, diagnostics ERROR, error-rate, controller deactivated,
  overrun spike, temp high) → banner + browser notification + webhook (Teams/Slack); event timeline
- **Recording bridge** — start/stop `ros2 bag` from UI → hand off to NEXOS.Link
- **Fleet** — multiple rosbridge endpoints, fleet health, compare
- **Platform/UX** — NEXOS dark+gold, responsive (desktop/tablet/phone), layout presets
  (operator/developer/defence), **login + roles** (read-only vs operator gating control actions),
  connection manager, latency, offline/air-gap, system-snapshot export
- **Vision** — 3D (URDF+TF), Nav2/map, bag-playback scrubbing, SROS2-aware + operator **audit log**,
  embeddable panels (iframe) in NEXOS Intranet

## Milestones

- **v1 (done):** connection, nodes, `/rosout`.
- **v2 — core cockpit:** topics+Hz, node details+params, lifecycle, diagnostics,
  ros2_control panel (overrun + joint view), health header, host vitals, log-pro;
  + `nexos_status_agent`, systemd, basic auth, NEXOS design.
- **v3 — operations:** plots, TF, graph, alerts/webhooks, guarded jog, recording↔NEXOS.Link, presets.
- **v4 — extreme:** fleet, 3D, roles/audit, SROS2, intranet embed.

## Security note

Any control action (lifecycle transitions, controller switching, jog) is **gated**; for
defence/remote use these require an operator role and are audit-logged. See
`nexos_ros2_defence` for deployment/security specifics.
