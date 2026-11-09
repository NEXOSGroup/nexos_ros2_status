# nexos_fleet_registry

Minimaler **Flotten-Register** für `ros_status`: UGVs melden sich per Heartbeat
an, Clients (Dashboard, Website) lesen die **Online-Liste**. Damit ist die
wechselnde IP eines UGV egal — der UGV meldet seine aktuelle rosbridge-Adresse
selbst.

```
UGV (registrar.py) --POST /heartbeat--> Registry (server.js) <--GET /ugvs-- Dashboard / Website
Dashboard --ws:// direkt (LAN)--> UGV rosbridge   (Telemetrie, erst beim Verbinden)
```

Für „wer ist online" braucht die Website **nur** `GET /ugvs` — keine Telemetrie,
kein rosbridge-Zugriff. Die eigentliche Telemetrie holt sich das Dashboard
weiterhin direkt per WebSocket vom UGV (LAN).

## Teile

- **`server.js`** — die Registry. Reine Node-stdlib (>=18), keine Abhängigkeiten.
- **`registrar.py`** — Referenz-Client für die **UGV-Seite**. Reine Python-stdlib.

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
| `GET` | `/healthz` | Health-Check |

`ws_url` muss `ws://…` oder `wss://…` sein. Bodies sind auf 8 KB begrenzt.

## Registrar auf dem UGV

```bash
REGISTRY_URL=https://fleet.example.com UGV_ID=odin75 UGV_NAME="ODIN 75" \
  python3 registrar.py
```

Als systemd-**User**-Service (kein sudo nötig, reiner Outbound-Call) oder neben
der bestehenden Bridge. Der Registrar erkennt die lokale IP automatisch
(`--host` überschreibt sie), `--port` setzt den rosbridge-Port (Default 9090).

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
