"""
Persistencia gratuita de la base de datos SQLite en GitHub.

En hosting gratuito (Render free) el disco se borra cada vez que el servidor se
reinicia o se "duerme". Para no perder los cambios hechos desde la web:
  - Al arrancar: se descarga la última copia de la BD desde la rama `datos` del repo.
  - Tras cada cambio (POST/PUT/PATCH/DELETE): se sube una copia de la BD a esa rama
    (con un pequeño retardo para agrupar varios cambios seguidos).

Se activa solo si existe la variable de entorno GH_DATA_TOKEN (token de GitHub con
permiso de lectura/escritura de "Contents" sobre el repositorio). En local no hace nada.
"""
import base64
import json
import os
import sqlite3
import tempfile
import threading
import urllib.error
import urllib.request
from datetime import datetime

from database import DB_PATH

TOKEN = os.environ.get("GH_DATA_TOKEN", "").strip()
REPO = os.environ.get("GH_DATA_REPO", "victormanuel80-2026/proyecto-gestion-logistica")
BRANCH = os.environ.get("GH_DATA_BRANCH", "datos")
FILE_PATH = os.environ.get("GH_DATA_PATH", "backup/pharma_commercial.db")
DEBOUNCE_SECONDS = float(os.environ.get("GH_DATA_DEBOUNCE", "4"))

API = f"https://api.github.com/repos/{REPO}"

_lock = threading.Lock()
_timer = None
_pending = False


def enabled() -> bool:
    return bool(TOKEN)


def _request(method: str, url: str, body=None, accept="application/vnd.github+json"):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", accept)
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "pharma-erp-backend")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def restore_from_github() -> bool:
    """Descarga la BD guardada en GitHub (si existe) y la coloca en DB_PATH."""
    if not enabled():
        return False
    try:
        raw = _request("GET", f"{API}/contents/{FILE_PATH}?ref={BRANCH}",
                       accept="application/vnd.github.raw")
    except urllib.error.HTTPError as e:
        print(f"[persistencia] No hay copia previa en GitHub ({e.code}); se usa la BD inicial.")
        return False
    except Exception as e:  # red caída, etc.
        print(f"[persistencia] Error descargando BD: {e}")
        return False
    if not raw.startswith(b"SQLite format 3"):
        print("[persistencia] El archivo descargado no es una BD SQLite válida; se ignora.")
        return False
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    with open(DB_PATH, "wb") as f:
        f.write(raw)
    print(f"[persistencia] BD restaurada desde GitHub ({len(raw)} bytes).")
    return True


def _ensure_branch():
    try:
        _request("GET", f"{API}/git/ref/heads/{BRANCH}")
        return
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
    repo_info = json.loads(_request("GET", API))
    base = repo_info.get("default_branch", "main")
    base_sha = json.loads(_request("GET", f"{API}/git/ref/heads/{base}"))["object"]["sha"]
    _request("POST", f"{API}/git/refs", {"ref": f"refs/heads/{BRANCH}", "sha": base_sha})


def _snapshot_bytes() -> bytes:
    """Copia consistente de la BD usando la API de backup de SQLite."""
    fd, tmp = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        src = sqlite3.connect(DB_PATH, timeout=15)
        dst = sqlite3.connect(tmp)
        src.backup(dst)
        dst.close()
        src.close()
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


def backup_now():
    """Sube inmediatamente la BD actual a GitHub."""
    global _pending
    if not enabled():
        return
    with _lock:
        _pending = False
        try:
            _ensure_branch()
            content = base64.b64encode(_snapshot_bytes()).decode()
            sha = None
            try:
                meta = json.loads(_request("GET", f"{API}/contents/{FILE_PATH}?ref={BRANCH}"))
                sha = meta.get("sha")
            except urllib.error.HTTPError as e:
                if e.code != 404:
                    raise
            body = {
                "message": f"datos: guardado automático {datetime.utcnow().isoformat(timespec='seconds')}Z",
                "content": content,
                "branch": BRANCH,
            }
            if sha:
                body["sha"] = sha
            _request("PUT", f"{API}/contents/{FILE_PATH}", body)
            print("[persistencia] BD guardada en GitHub.")
        except Exception as e:
            _pending = True
            print(f"[persistencia] Error guardando BD en GitHub: {e}")


def schedule_backup():
    """Programa un guardado con retardo (agrupa varios cambios seguidos en un solo commit)."""
    global _timer, _pending
    if not enabled():
        return
    _pending = True
    if _timer is not None:
        _timer.cancel()
    _timer = threading.Timer(DEBOUNCE_SECONDS, backup_now)
    _timer.daemon = True
    _timer.start()


def flush():
    """Al apagar el servidor: guardar si quedó algún cambio pendiente."""
    global _timer
    if _timer is not None:
        _timer.cancel()
        _timer = None
    if _pending:
        backup_now()
