"""
DragoToY · Programa de escritorio.

Abre el panel de gestión de la juguetería en una ventana propia de Windows (sin navegador).
El panel es el mismo de la web (carpeta src/, compilado en desktop/web/) y se conecta al
mismo Supabase, así que comparte stock, ventas y pedidos con la web y la tienda online.

Hay dos versiones, según cómo se armó (python desktop/build.py [--offline]):
  - Conectada: usa Supabase, comparte datos con la web y la tienda online. Necesita internet.
  - Sin conexión: guarda todo en esta computadora. Funciona sin internet, pero no se comunica
    con la tienda online ni con otros equipos. El archivo mode.json dice cuál es.

Cómo funciona:
  1. Un servidor HTTP mínimo, solo en esta computadora (127.0.0.1), sirve los archivos del panel.
  2. pywebview abre una ventana nativa con el motor de Edge (WebView2) y carga ese servidor.
  3. Los datos de la ventana (sesión, tema, guía y, en la versión sin conexión, toda la información
     de la tienda) se guardan en %LOCALAPPDATA%\\<nombre de la versión>.
"""

from __future__ import annotations

import logging
import mimetypes
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import json

import webview


def resource_dir() -> Path:
    """Carpeta con los archivos del programa: junto al .exe empaquetado o junto a este archivo."""
    base = getattr(sys, "_MEIPASS", None)
    return Path(base) if base else Path(__file__).resolve().parent


def load_mode() -> dict:
    """Qué versión es (la escribe build.py). Sin archivo: la versión conectada."""
    mode = {
        "name": "DragoToY",
        "title": "DragoToY · Gestión",
        "offline": False,
        # Puertos fijos y distintos por versión: cada una guarda sus datos aparte y no se mezclan.
        "ports": [47615, 47616, 47617, 47618],
    }
    file = resource_dir() / "mode.json"
    if file.exists():
        mode.update(json.loads(file.read_text(encoding="utf-8")))
    return mode


MODE = load_mode()
APP_NAME = MODE["name"]
APP_TITLE = MODE["title"]


def data_dir() -> Path:
    """Dónde se guardan la sesión y las preferencias (no se borra al actualizar el programa)."""
    root = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    path = Path(root) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


# En Windows el registro a veces asocia .js a "text/plain" y el navegador se niega a ejecutarlo.
for ext, mime in {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
}.items():
    mimetypes.add_type(mime, ext)


class PanelHandler(SimpleHTTPRequestHandler):
    """Sirve el panel compilado. Las rutas del panel (/vender, /pedidos…) devuelven index.html."""

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **{e: m for e, m in mimetypes.types_map.items()}}

    def send_head(self):
        path = Path(self.translate_path(self.path))
        route = self.path.split("?", 1)[0].split("#", 1)[0]
        # Ruta interna del panel (/vender, /pedidos…: sin extensión): la resuelve React en la ventana.
        # Un archivo que falta (/assets/x.js) sí devuelve 404, para no esconder errores.
        if not path.exists() and "." not in route.rsplit("/", 1)[-1]:
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        # index.html nunca queda guardado viejo; los archivos con hash en /assets sí pueden cachearse.
        if self.path.endswith(".html") or self.path == "/":
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):  # silencioso: no hace falta llenar la consola
        logging.debug("http: " + fmt, *args)


# Puerto fijo: la sesión y las preferencias se guardan por dirección (http://127.0.0.1:PUERTO),
# así que si cambiara en cada apertura habría que volver a ingresar siempre.
PREFERRED_PORTS = tuple(MODE["ports"])


def start_server(web_root: Path, ports=PREFERRED_PORTS) -> ThreadingHTTPServer:
    """Levanta el servidor solo en esta computadora (127.0.0.1: no se ve desde la red)."""
    handler = partial(PanelHandler, directory=str(web_root))
    server = None
    for port in (*ports, 0):  # 0 = cualquiera libre, último recurso (no recordaría la sesión)
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError:
            logging.warning("Puerto %s ocupado", port)
    assert server is not None
    threading.Thread(target=server.serve_forever, name="panel-http", daemon=True).start()
    return server


def remote_available(base: str, timeout: float = 4.0) -> bool:
    """
    ¿Responde la versión publicada y ya trae la actualización automática? Se prueba su /version.json
    (es chico). Ojo: Vercel devuelve la página principal ante cualquier dirección que no existe,
    así que no alcanza con un 200: tiene que venir un JSON con el número de versión.
    """
    import urllib.request

    try:
        with urllib.request.urlopen(f"{base}/version.json", timeout=timeout) as res:
            data = json.loads(res.read(4096).decode("utf-8"))
            return res.status == 200 and isinstance(data, dict) and isinstance(data.get("id"), str)
    except Exception:  # noqa: BLE001 — sin red, sitio caído o respuesta rara: se usa la copia interna
        return False


def main() -> None:
    logging.basicConfig(
        filename=data_dir() / "dragotoy.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    logging.info("Versión: %s (%s)", APP_TITLE, "sin conexión" if MODE["offline"] else "conectada")
    web_root = resource_dir() / "web"
    if not (web_root / "index.html").exists():
        raise SystemExit(f"No se encontró el panel compilado en {web_root}. Corre primero: python desktop/build.py")

    server = start_server(web_root)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    logging.info("Copia interna del panel en %s", url)

    # Versión conectada: abre el panel publicado (siempre la última versión, sin cambiar el .exe).
    # Si no se llega a tiempo (sin internet, sitio caído), usa la copia que viene dentro del programa.
    remote = (MODE.get("remote_url") or "").rstrip("/")
    if remote and remote_available(remote):
        url = f"{remote}/?desktop=1"
        logging.info("Abriendo la versión publicada: %s", url)
    elif remote:
        logging.warning("No se pudo llegar a %s: se usa la copia interna", remote)

    # Descargas (PDF, copias de seguridad, Excel): se pregunta dónde guardarlas.
    webview.settings["ALLOW_DOWNLOADS"] = True
    # Los enlaces a la tienda online se abren en el navegador de la computadora.
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True

    webview.create_window(
        APP_TITLE,
        url,
        width=1366,
        height=860,
        min_size=(960, 640),
        background_color="#1E4D57",
        text_select=True,
    )
    debug = os.environ.get("DRAGOTOY_DEBUG") == "1"
    webview.start(
        gui="edgechromium",
        private_mode=False,  # recuerda la sesión, el tema y la guía entre aperturas
        storage_path=str(data_dir() / "webview"),
        debug=debug,
        # Windows (WinForms) solo acepta .ico; Linux/macOS usan el .png.
        icon=str(resource_dir() / "assets" / ("dragotoy.ico" if os.name == "nt" else "dragotoy.png")),
    )
    server.shutdown()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:  # noqa: BLE001 — sin consola, el error solo queda en el registro
        logging.exception("El programa se cerró por un error")
        raise
