# nexos_fleet_registry

Minimaler **Flotten-Register** für `ros_status`: UGVs melden sich per Heartbeat
an, Clients (Dashboard, Website) lesen die **Online-Liste**. Damit ist die
wechselnde IP eines UGV egal — der UGV meldet seine aktuelle rosbridge-Adresse
selbst.

```
UGV --POST /heartbeat--> Registry (server.js) <--GET /ugvs------- Dashboard
UGV --POST /telemetry--> Registry (Snapshots)  <--GET /telemetry-- Dashboard
```

**UGV → Server → Dashboard:** UGVs melden ihre Adresse (Heartbeat) und pushen ihre
Telemetrie als selbstbeschreibende Kacheln (`nexos.tiles/1`). Das Dashboard liest
beides per **https** — so braucht die öffentlich gehostete Oberfläche keinen
Direktzugriff auf die `ws`-LAN-Adresse der Roboter.

## Teile

- **`server.js`** — Registry + Telemetrie-Relay. Reine Node-stdlib (>=18), keine Abhängigkeiten.
- Die **UGV-Seite** (Registrar, Bridge, Agent) liegt im Repo
  [`nexos_ros2_status_agent`](https://github.com/NEXOSGroup/nexos_ros2_status_agent).

## Registry starten

```bash
cd nexos_fleet_registry
npm start            # oder: node server.js
```

Env: `PORT` (Default 8090), `OFFLINE_TIMEOUT_MS` (Default 10000),
`FORGET_MS` (Default 1 h).

### API

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/heartbeat` | `{ "id", "name", "ws_url", "status" }` — UGV meldet sich |
| `GET` | `/ugvs` | Flotte mit `online`/`offline`, `ws_url`, `age_s` |
| `POST` | `/telemetry` | `{ "id", "data" }` — UGV pusht Kachel-Snapshot (`nexos.tiles/1`) |
| `GET` | `/telemetry?id=…` | letzter Snapshot eines UGV (`fresh`, `age_s`, `data`) |
| `GET` | `/healthz` | Health-Check |

`ws_url` muss `ws://…` oder `wss://…` sein. Heartbeat-Bodies 8 KB, Telemetrie 256 KB.

## UGV-Seite

Registrar + (roboter-spezifischer) Telemetrie-Pusher laufen auf dem Roboter — Code im
Repo [`nexos_ros2_status_agent`](https://github.com/NEXOSGroup/nexos_ros2_status_agent).
Der Registrar meldet `ws_url` per Heartbeat; der Pusher schickt die Telemetrie-Kacheln
an `/telemetry`.

## Dashboard

Der **Flotte**-Tab in `app/` pollt `GET /ugvs` und zeigt die UGVs mit
Online-Ampel; Klick auf „Verbinden" setzt die Bridge-URL auf die gemeldete
`ws_url`. Registry-URL im Tab einstellbar (oder Build-Zeit `VITE_REGISTRY_URL`).

## Deployment

Wie `nexos_status_sim`: als Node.js-App hinter Reverse-Proxy + TLS (z. B.
Plesk-Node.js auf einer eigenen Subdomain). Muss von den **UGVs** (Heartbeat
rein) **und** von **Dashboard/Website** (Liste raus) erreichbar sein.

## Sicherheit (bewusst offen im zivilen Demo)

**Aktuell ohne Auth** — jeder im Netz kann anmelden und lesen. Vor
Produktiv-/Defence-Einsatz ist zwingend nachzurüsten (Secure-SDLC-Baseline):

- [ ] **Heartbeat-Auth** — Token pro UGV oder mTLS; nur bekannte UGVs dürfen anmelden.
- [ ] **Listen-Zugriff** — `GET /ugvs` hinter Auth; öffentliche Sicht nur anonymisiert.
- [ ] **Rate-Limiting / Input-Hardening** am Ingress.
- [ ] **TLS** erzwingen (nur `wss://` / `https://`).
- [ ] **CI** (CodeQL/Trivy/gitleaks), signierte Commits, Container-Härtung.

Zivil/Demo: ok. Defence/öffentlich: erst nach obiger Härtung.
