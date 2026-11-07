# nexos_ros2_status

**NEXOS `ros_status`** — a live **ROS 2 system-status web dashboard**. The operations
cockpit for a running ROS 2 stack: node/topic graph, logs, lifecycle, diagnostics,
`ros2_control` and host vitals — in the browser, no desktop app.

Part of the NEXOS ROS 2 family (see [`nexos_ros2`](https://github.com/NEXOSGroup/nexos_ros2)).
Public, **Apache-2.0**.

> Positioning: `ros_status` = **live status & control**. Complementary to **Foxglove**
> (deep data viz) and **NEXOS.Link** (recorded bags/MCAP). It fills the gap ROS 2 leaves
> open: the live system state (nodes, errors, lifecycle, controllers) that otherwise only
> exists on the command line.

## Architecture

```
Browser (roslib.min.js, bundled)  ⇄  rosbridge (ws :9090)  ⇄  ROS 2 graph
        http static page (:8080)                               + nexos_status_agent
                                                                 (host vitals → /diagnostics)
```

- **Backend:** `rosbridge_suite` exposes the ROS 2 graph (topics + any service) over
  WebSocket; `rosapi` provides node/topic/param discovery.
- **Frontend:** a single self-contained page (`web/index.html`) using `roslibjs`
  (bundled locally → works offline / air-gapped).
- **Companion node:** `nexos_status_agent` publishes host CPU/mem/temp/disk to
  `/diagnostics` (things rosbridge can't read on its own).

## Quickstart (on the robot/Pi)

```bash
sudo apt install -y ros-<distro>-rosbridge-suite   # e.g. ros-lyrical-rosbridge-suite
# serve the page + bridge (see scripts/install.sh for systemd autostart)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &   # :9090
( cd web && python3 -m http.server 8080 )                       # :8080
# optional host vitals:
# colcon build --packages-select nexos_status_agent && ros2 run nexos_status_agent agent
```

Open **http://<robot-ip>:8080** in a normal browser (the built-in preview panes of some
tools block LAN WebSockets).

`scripts/install.sh` installs systemd services for autostart (`ros-rosbridge`,
`ros-status-web`).

## Status

- **v1 (now):** connection status, live node list, `/rosout` log with level filter.
- **v2+:** see [ROADMAP.md](ROADMAP.md) — topics+Hz, node details+params, lifecycle,
  diagnostics, `ros2_control` cockpit (controllers, hardware, overruns, joints), health
  header, host vitals, alerts, auth, design.
