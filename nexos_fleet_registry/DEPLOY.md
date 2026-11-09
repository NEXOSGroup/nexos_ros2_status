# Deployment — nexos_fleet_registry

Der Dienst ist eine reine Node-stdlib-App (keine Abhängigkeiten) und spricht
**plain HTTP** (kein WebSocket). Er muss erreichbar sein für:

- die **UGVs** (ausgehender `POST /heartbeat`) und
- die **Clients** — Dashboard und Website (`GET /ugvs`).

Sind UGVs oder Clients außerhalb des LAN, muss der Endpoint aus dem Internet
erreichbar sein (mit TLS).

## Voraussetzungen
- Node.js **>= 18** auf dem Server.

## Variante A — systemd + Reverse-Proxy + TLS (empfohlen für eigenen Server)

```bash
# 1. Code auf den Server legen
sudo mkdir -p /opt/nexos_fleet_registry
sudo cp server.js package.json /opt/nexos_fleet_registry/

# 2. systemd-Unit installieren (User/Pfad in der Unit ggf. anpassen)
sudo cp systemd/nexos-fleet-registry.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nexos-fleet-registry
curl -s http://127.0.0.1:8090/healthz   # {"ok":true,...}
```

Reverse-Proxy (nginx) für `fleet.example.com` → `127.0.0.1:8090`, dann
Let's-Encrypt-TLS:

```nginx
server {
  server_name fleet.example.com;
  location / { proxy_pass http://127.0.0.1:8090; }
}
```
```bash
sudo certbot --nginx -d fleet.example.com
```

Endpoint danach: `https://fleet.example.com` (→ im Dashboard-Flotte-Tab als
Registry-URL eintragen, und im UGV-Registrar als `REGISTRY_URL`).

## Variante B — Plesk-Node.js (wie der Sim)

Subdomain anlegen (z. B. `fleet.alps-robotics.com`) → **Node.js aktivieren** →
Startdatei `server.js` → `PORT` setzt Plesk per `process.env.PORT` selbst, unser
Code liest ihn. **npm install entfällt** (keine Dependencies). Let's-Encrypt-TLS
aktivieren.

Anders als beim Sim: hier ist **kein WebSocket-Upgrade** nötig → der Plesk-
„Proxy mode" darf **an** bleiben (der WS-Sonderfall des Sims gilt hier nicht).

**Nur `server.js` + `package.json`** in den Anwendungsstamm — eine evtl. von Plesk
angelegte `index.html` **löschen** (sonst bedient Apache die statisch bei `/`).

### Stolperfalle: Anwendungsstamm liegt unter einer CMS-Seite (z. B. TYPO3)

Liegt der Node-Anwendungsstamm **innerhalb** einer bestehenden Seite (z. B.
`/httpdocs/html/fleet.<domain>` unter einer TYPO3-Installation), greift deren
`.htaccess` durch: Die TYPO3-Catch-all-Regel
(`RewriteRule ^.*$ … index.php [QSA,L]`) leitet jede nicht existierende Datei auf
`index.php` um. In unserem Ordner gibt es keine → **Endlos-Redirect**
(`AH00124: Request exceeded the limit of 10 internal redirects`) → **HTTP 500**,
Passenger wird nie erreicht.

**Fix:** die mitgelieferte **`plesk/.htaccess`** (`RewriteEngine Off`) in den
Anwendungsstamm legen (als `.htaccess`). Dann greifen die geerbten CMS-Rewrites
dort nicht mehr und Passenger bedient die Node-App. Danach „App neu starten".
Besser noch, falls möglich: den Anwendungsstamm **außerhalb** der CMS-Seite
anlegen (eigene Subdomain-Docroot, nicht unter `httpdocs/html/…`).

## Konfiguration (Env)

| Var | Default | Zweck |
|---|---|---|
| `PORT` | 8090 | Listen-Port |
| `OFFLINE_TIMEOUT_MS` | 10000 | ab wann ein UGV „offline" ist |
| `FORGET_MS` | 3600000 | ab wann verschollene UGVs vergessen werden |

## Nach dem Deploy

- UGV-Registrar auf den Endpoint zeigen lassen (`REGISTRY_URL=https://…`) — das
  macht die **ODIN-Session** (Roboter-Seite).
- Im Dashboard-Flotte-Tab die Registry-URL eintragen (oder Build-Zeit
  `VITE_REGISTRY_URL`).

## Sicherheit vor Produktiv/Defence (siehe README)

Aktuell **ohne Auth** und `Access-Control-Allow-Origin: *`. Vor Produktiv:
Heartbeat-Auth (Token/mTLS), `GET /ugvs` hinter Auth bzw. öffentlich nur
anonymisiert, CORS auf bekannte Origins einschränken, Rate-Limiting, TLS
erzwingen, CI (CodeQL/Trivy/gitleaks) + signierte Commits.
