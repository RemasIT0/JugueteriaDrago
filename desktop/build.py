"""
Arma el programa de escritorio de DragoToY.

  python desktop/build.py              → versión conectada (Supabase): desktop/dist/DragoToY.exe
  python desktop/build.py --offline    → versión sin conexión: desktop/dist/DragoToY-sin-conexion.exe
  python desktop/build.py --web        → solo compila el panel (probar con: python desktop/main.py)

Necesita: Node/npm (para compilar el panel) y el entorno de Python de desktop/ con
pywebview y pyinstaller (ver desktop/requirements.txt).
La versión conectada toma la conexión a Supabase de .env.local, igual que la web.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

DESKTOP = Path(__file__).resolve().parent
ROOT = DESKTOP.parent
OFFLINE = "--offline" in sys.argv
WEB_OUT = DESKTOP / ("web-offline" if OFFLINE else "web")
# Dirección pública de la tienda: el botón «Ver tienda online» la abre en el navegador.
STORE_URL = os.environ.get("DRAGOTOY_STORE_URL", "https://jugueteria-drago.vercel.app")

MODE = (
    {
        "name": "DragoToY-sin-conexion",
        "title": "DragoToY · Gestión (sin conexión)",
        "offline": True,
        "ports": [47625, 47626, 47627, 47628],
    }
    if OFFLINE
    else {
        "name": "DragoToY",
        "title": "DragoToY · Gestión",
        "offline": False,
        "ports": [47615, 47616, 47617, 47618],
    }
)


def run(cmd: list[str], **kw) -> None:
    print("›", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, shell=(os.name == "nt" and cmd[0] in {"npm", "npx"}), **kw)


def build_web() -> None:
    env = {**os.environ, "VITE_DESKTOP": "1", "VITE_STORE_URL": "" if OFFLINE else STORE_URL}
    if OFFLINE:
        # Vacías ganan sobre .env.local: el panel queda en modo local (datos en esta computadora).
        env.update({"VITE_SUPABASE_URL": "", "VITE_SUPABASE_PUBLISHABLE_KEY": ""})
    if WEB_OUT.exists():
        shutil.rmtree(WEB_OUT)
    run(["npx", "vite", "build", "--outDir", str(WEB_OUT), "--emptyOutDir"], cwd=ROOT, env=env)
    (WEB_OUT / "mode.json").write_text(json.dumps(MODE, ensure_ascii=False, indent=1), encoding="utf-8")


def build_exe() -> None:
    sep = ";" if os.name == "nt" else ":"
    run(
        [
            sys.executable, "-m", "PyInstaller",
            "--noconfirm", "--clean", "--onefile", "--windowed",
            "--name", MODE["name"],
            "--icon", str(DESKTOP / "assets" / "dragotoy.ico"),
            "--add-data", f"{WEB_OUT}{sep}web",
            "--add-data", f"{WEB_OUT / 'mode.json'}{sep}.",
            "--add-data", f"{DESKTOP / 'assets'}{sep}assets",
            "--distpath", str(DESKTOP / "dist"),
            "--workpath", str(DESKTOP / "build" / MODE["name"]),
            "--specpath", str(DESKTOP / "build" / MODE["name"]),
            str(DESKTOP / "main.py"),
        ],
        cwd=DESKTOP,
    )
    print(f"\nListo: {DESKTOP / 'dist' / (MODE['name'] + '.exe')}")


if __name__ == "__main__":
    build_web()
    if "--web" not in sys.argv:
        build_exe()
