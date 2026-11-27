#!/usr/bin/env python3
"""
Servidor Cloud & Local Híbrido (HTTP + HTTPS para Câmera iPhone + API REST Multiplayer/Save/Admin).
Pronto para rodar na máquina local (Wi-Fi) ou em qualquer servidor externo (Render, Railway, Fly.io, VPS, Docker).
"""
import http.server
import json
import os
import socket
import ssl
import subprocess
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT_DIR / "web"
DATA_DIR = ROOT_DIR / "server_data"
DATA_DIR.mkdir(exist_ok=True)

BALANCE_FILE = DATA_DIR / "balance.json"
BUGS_FILE = DATA_DIR / "bug_reports.json"
SAVES_DIR = DATA_DIR / "saves"
SAVES_DIR.mkdir(exist_ok=True)
ONLINE_PLAYERS = {}



class PokeAsciiHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/balance":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if BALANCE_FILE.exists():
                self.wfile.write(BALANCE_FILE.read_bytes())
            else:
                self.wfile.write(b"{}")
            return
        if self.path == "/api/bug-report":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if BUGS_FILE.exists():
                self.wfile.write(BUGS_FILE.read_bytes())
            else:
                self.wfile.write(b"[]")
            return
        if self.path == "/api/multiplayer":
            self._reply_json({"players": list(ONLINE_PLAYERS.values())})
            return
        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            payload = {}

        if self.path == "/api/balance":
            BALANCE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            self._reply_json({"ok": True})
            return

        if self.path == "/api/save":
            trainer = "".join(c for c in str(payload.get("trainerName", "player")) if c.isalnum() or c in ("_", "-"))
            if not trainer:
                trainer = "player"
            (SAVES_DIR / f"{trainer}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
            self._reply_json({"ok": True, "trainer": trainer})
            return

        if self.path == "/api/bug-report":
            bugs = []
            if BUGS_FILE.exists():
                try:
                    bugs = json.loads(BUGS_FILE.read_text(encoding="utf-8"))
                except Exception:
                    bugs = []
            bugs.insert(0, payload)
            BUGS_FILE.write_text(json.dumps(bugs[:500], indent=2), encoding="utf-8")
            self._reply_json({"ok": True, "total": len(bugs)})
            return

        if self.path == "/api/multiplayer":
            pid = str(payload.get("trainerName", "Treinador"))[:24]
            ONLINE_PLAYERS[pid] = payload
            self._reply_json({"ok": True, "players": list(ONLINE_PLAYERS.values())})
            return

        self._reply_json({"ok": False, "error": "Endpoint desconhecido"}, status=404)

    def _reply_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def ensure_self_signed_cert():
    """Gera certificado TLS auto-assinado para que o Chrome/Safari do iPhone libere a câmera na rede Wi-Fi local."""
    cert_path = DATA_DIR / "dev_cert.pem"
    key_path = DATA_DIR / "dev_key.pem"
    if cert_path.exists() and key_path.exists():
        return cert_path, key_path
    try:
        subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048",
                "-keyout", str(key_path), "-out", str(cert_path),
                "-days", "365", "-nodes", "-subj", "/CN=PokeASCII-Local-AR"
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return cert_path, key_path
    except Exception:
        return None, None


def main():
    http_port = int(os.environ.get("PORT", "8088"))
    https_port = int(os.environ.get("HTTPS_PORT", "8443"))

    http_srv = http.server.ThreadingHTTPServer(("0.0.0.0", http_port), PokeAsciiHandler)
    print(f"[HTTP]  Servidor PokeASCII rodando em http://localhost:{http_port}")

    cert_path, key_path = ensure_self_signed_cert()
    if cert_path and key_path:
        try:
            https_srv = http.server.ThreadingHTTPServer(("0.0.0.0", https_port), PokeAsciiHandler)
            ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ssl_ctx.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
            https_srv.socket = ssl_ctx.wrap_socket(https_srv.socket, server_side=True)
            t = threading.Thread(target=https_srv.serve_forever, daemon=True)
            t.start()
            print(f"[HTTPS] Servidor Seguro p/ iPhone (Câmera WebKit) rodando na porta :{https_port}")
        except Exception as e:
            print(f"[AVISO] HTTPS local nao iniciado ({e}); use GitHub Pages para HTTPS oficial no iPhone.")

    http_srv.serve_forever()


if __name__ == "__main__":
    main()
