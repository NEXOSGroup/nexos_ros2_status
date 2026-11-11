# nexos_ros2_status

**NEXOS `ros_status`** — das **Bodenstations-Dashboard** und der **Fleet-Registry-
Server** für eine NEXOS-UGV-Flotte. Live-ROS-2-Systemstatus und -Telemetrie im
Browser, ohne Desktop-App.

Teil der NEXOS-ROS-2-Familie (siehe [`nexos_ros2`](https://github.com/NEXOSGroup/nexos_ros2)).
Public, **Apache-2.0**.

> Positionierung: `ros_status` = **Live-Status & -Telemetrie**. Komplementär zu
> **Foxglove** (tiefe Datenviz) und **NEXOS.Link** (aufgezeichnete Bags/MCAP).

## Architektur — UGV → Server → Dashboard

```
 UGV (ROS 2)            Server (Fleet-Registry)        Dashboard (Browser)
 ───────────            ───────────────────────        ───────────────────
 Registrar  ─heartbeat─►  POST /heartbeat  → wer online   GET /ugvs
 Telemetrie ─push──────►  POST /telemetry  → Snapshots ─► GET /telemetry
 (ROS-Nodes)            (hält je UGV den letzten Stand)   rendert Kacheln generisch
```

Die UGVs liefern **nur Werte** (selbstbeschreibende Kacheln, Schema `nexos.tiles/1`);
das **Design macht das Dashboard**. Weil Telemetrie über den Server läuft, braucht die
öffentlich (https) gehostete Oberfläche keinen Direktzugriff auf die `ws`-LAN-Adresse
der Roboter.

## Inhalt dieses Repos
| Pfad | Was |
|---|---|
| `app/` | **Dashboard** (React 19 + MUI + Vite + roslibjs). Kachel-Startseite, pro UGV eine Unterseite mit generischer Telemetrie, Einstellungen. Deploy: `app/DEPLOY.md`. |
| `nexos_fleet_registry/` | **Server** (Node-stdlib, zero-dep): Heartbeat-Register (`/heartbeat`, `/ugvs`) + Telemetrie-Relay (`/telemetry`). Deploy: `nexos_fleet_registry/DEPLOY.md`. |

## UGV-Seite (separates Repo)
Die Teile, die **auf dem Roboter** laufen (rosbridge-Bridge, Status-Agent, Registrar,
On-Host-Install), liegen in
**[`nexos_ros2_status_agent`](https://github.com/NEXOSGroup/nexos_ros2_status_agent)**.
Roboter-spezifische Dekodierung/Telemetrie (z. B. ODIN) im jeweiligen Roboter-Repo
(z. B. `ODIN.75_TDW`).

## Live
- Dashboard: `https://status.alps-robotics.com`
- Registry/Service: `https://fleet.alps-robotics.com`

## Technik-Hinweise
- MUI = React; Vite nur Build. roslib 2.x: **kein** Default-Export (`import * as ROSLIB`),
  **kein** `ServiceRequest` (callService nimmt ein Plain-Object).
- Roadmap: [ROADMAP.md](ROADMAP.md).
