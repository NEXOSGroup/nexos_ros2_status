#!/usr/bin/env python3
"""NEXOS fleet registrar — laeuft AUF dem UGV und meldet es bei der Registry an.

Schickt periodisch einen Heartbeat mit der AKTUELL erkannten rosbridge-Adresse
des UGV. Dadurch ist die wechselnde IP egal: der UGV meldet seine Adresse selbst,
das Dashboard muss sie nicht vorher kennen.

Nur Python-Standardbibliothek (keine Abhaengigkeiten) -> laeuft direkt auf dem Pi
oder lokal zum Testen. Kein sudo noetig (reiner ausgehender HTTPS/HTTP-Call).

Konfiguration per Env oder CLI-Flag:
  REGISTRY_URL   z. B. https://fleet.example.com        (--registry)
  UGV_ID         stabile Kennung, z. B. odin75          (--id)
  UGV_NAME       Anzeigename, z. B. "ODIN 75"           (--name)
  ROSBRIDGE_PORT Port der rosbridge (Default 9090)      (--port)
  WS_HOST        Host/IP in der ws_url erzwingen        (--host)
                 (sonst wird die lokale IP automatisch erkannt)
  INTERVAL_S     Sekunden zwischen Heartbeats (Default 3) (--interval)
  STATUS         Kurzstatus (Default "idle")            (--status)

Beispiel (auf ODIN):
  REGISTRY_URL=https://fleet.alps-robotics.com \\
  UGV_ID=odin75 UGV_NAME="ODIN 75" python3 registrar.py
"""
import argparse
import json
import os
import socket
import sys
import time
import urllib.request


def detect_local_ip() -> str:
    """Lokale IP ermitteln, ueber die der UGV im LAN erreichbar ist."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Zieladresse muss nicht erreichbar sein; waehlt nur das Interface.
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def send_heartbeat(registry_url: str, payload: dict, timeout: float = 5.0) -> None:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        registry_url.rstrip("/") + "/heartbeat",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        resp.read()


def main() -> int:
    p = argparse.ArgumentParser(description="NEXOS fleet registrar (UGV-Seite)")
    p.add_argument("--registry", default=os.environ.get("REGISTRY_URL", "http://localhost:8090"))
    p.add_argument("--id", default=os.environ.get("UGV_ID", socket.gethostname().lower()))
    p.add_argument("--name", default=os.environ.get("UGV_NAME", socket.gethostname()))
    p.add_argument("--port", type=int, default=int(os.environ.get("ROSBRIDGE_PORT", "9090")))
    p.add_argument("--host", default=os.environ.get("WS_HOST", ""))
    p.add_argument("--interval", type=float, default=float(os.environ.get("INTERVAL_S", "3")))
    p.add_argument("--status", default=os.environ.get("STATUS", "idle"))
    args = p.parse_args()

    print(f"[registrar] id={args.id} -> {args.registry} alle {args.interval}s", flush=True)
    while True:
        host = args.host or detect_local_ip()
        payload = {
            "id": args.id,
            "name": args.name,
            "ws_url": f"ws://{host}:{args.port}",
            "status": args.status,
        }
        try:
            send_heartbeat(args.registry, payload)
        except Exception as exc:  # Registry mal weg? Weitermachen, nicht sterben.
            print(f"[registrar] Heartbeat fehlgeschlagen: {exc}", file=sys.stderr, flush=True)
        time.sleep(max(0.5, args.interval))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        pass
