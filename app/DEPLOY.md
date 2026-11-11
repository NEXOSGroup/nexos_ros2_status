# Deployment — ros_status Dashboard (statisch, z. B. status.alps-robotics.com)

Das Dashboard ist eine **statische Single-Page-App** (Vite-Build). Es braucht
**kein Node.js** auf dem Server — nur statisches Hosting. Es holt die Flotten-
Liste und Telemetrie per **https** von der Registry; echte UGV-Telemetrie kommt
also über den Server (`UGV → Server → Dashboard`), nicht direkt aus dem LAN.

## 1. Bauen
```bash
cd app
npm ci
npm run build        # Ergebnis: app/dist/
```
Die **Registry-URL** ist fest auf `https://fleet.alps-robotics.com` vorbelegt.
Andere Registry? Beim Bauen überschreiben:
```bash
VITE_REGISTRY_URL=https://fleet.example.com npm run build
```
(Zur Laufzeit lässt sie sich im Flotte-Tab ebenfalls ändern; der Default kommt
aus dem Build.)

Der Build enthält automatisch die **`.htaccess`** (`RewriteEngine Off`, aus
`app/public/.htaccess`) gegen geerbte CMS-Rewrites — siehe unten.

## 2. Auf Plesk hochladen (statisch)
1. **Subdomain** `status.alps-robotics.com` anlegen.
2. **Node.js NICHT** aktivieren — rein statisch.
3. Eine evtl. von Plesk angelegte Platzhalter-**`index.html`** im Docroot
   **löschen**.
4. Den **Inhalt von `app/dist/`** in den Docroot der Subdomain hochladen —
   also `index.html`, der Ordner `assets/` **und** die `.htaccess`
   (versteckte Dateien im Dateimanager einblenden). Nicht den `dist`-Ordner
   selbst, sondern seinen Inhalt.
5. **Let's-Encrypt-TLS** für die Subdomain aktivieren (SSL/TLS-Zertifikate →
   kostenloses Zertifikat).

## 3. Testen
`https://status.alps-robotics.com` öffnen:
- Dashboard lädt (dunkles NEXOS-Theme).
- **Flotte**-Tab: gemeldete UGVs (online/offline).
- **Telemetrie**-Tab: UGV wählen → Kacheln des UGV live.

## Stolperfalle (wie bei der Registry): Docroot unter einer CMS-Seite
Liegt die Subdomain-Docroot **innerhalb** einer bestehenden Seite (z. B.
`/httpdocs/html/status.alps-robotics.com` unter einer TYPO3-Installation),
greifen deren `.htaccess`-Rewrites durch und liefern 500 (AH00124) oder 404
(AH01276). Die mitgelieferte **`.htaccess`** (`RewriteEngine Off`) im Docroot
behebt das — sie ist bereits im Build enthalten, also einfach mit hochladen.
Besser noch, falls möglich: Docroot **außerhalb** der CMS-Seite anlegen.

## Updates
Neuer Build → `app/dist/`-Inhalt erneut hochladen (überschreiben). Fertig.
