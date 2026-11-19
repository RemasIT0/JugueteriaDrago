# DragoToY · Programa de escritorio (Python)

El panel de gestión de la juguetería como programa de Windows: una ventana propia, sin navegador.
Es **el mismo panel de la web** (mismo diseño, guía y animaciones) y se conecta **al mismo Supabase**,
así que comparte stock, ventas y los pedidos de la tienda online. La tienda de clientes no viene
incluida: «Ver tienda online» la abre en el navegador.

## Dos versiones

| | `DragoToY.exe` (conectada) | `DragoToY-sin-conexion.exe` |
|---|---|---|
| Internet | Necesario | **No hace falta** |
| Dónde quedan los datos | Supabase (la nube) | Solo en esta computadora (`%LOCALAPPDATA%\DragoToY-sin-conexion`) |
| Tienda online | Recibe sus pedidos y comparte el stock | **Separada**: no recibe pedidos ni le avisa el stock |
| Otros equipos y celular | Ven los mismos datos | No |
| Respaldo | Lo hace Supabase | Usuarios → «Descargar copia» seguido (por ejemplo a un pendrive) |

Las dos pueden estar instaladas en la misma PC: cada una guarda sus datos aparte.
En cualquiera, el asistente responde **«¿Lo que hice quedó en la nube o solo en esta PC?»**:
dice en qué versión estás, si hay internet y qué se modificó últimamente y dónde quedó guardado.

## Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `main.py` | Programa en Python. Sirve el panel solo en esta PC (`127.0.0.1:47615`) y lo abre en una ventana nativa con **pywebview** (motor de Edge, WebView2). Guarda la sesión en `%LOCALAPPDATA%\DragoToY`. |
| `build.py` | Compila el panel para escritorio (`web/`) y arma `dist/DragoToY.exe` con **PyInstaller**. |
| `assets/` | Ícono del dragón (`.ico` para Windows, `.png` para el resto). |

Diferencias con la web (todas en `src/lib/print.ts`, activas solo con `VITE_DESKTOP=1`):
- Facturas y cierre de caja se imprimen desde la misma ventana (pywebview no abre ventanas emergentes).
- Los enlaces a la tienda van a la tienda publicada en Vercel.

## Generar el .exe

Requisitos: Node/npm y Python 3.10 o más nuevo, y `.env.local` con la conexión a Supabase (la misma de la web).

```bash
python -m venv desktop/.venv
desktop/.venv/Scripts/python -m pip install -r desktop/requirements.txt
desktop/.venv/Scripts/python desktop/build.py
```

Resultado: `desktop/dist/DragoToY.exe` (un solo archivo, no hace falta instalar Python en la PC donde se use).
Para la versión sin conexión: `desktop/.venv/Scripts/python desktop/build.py --offline` → `desktop/dist/DragoToY-sin-conexion.exe`.

Para probar sin empaquetar: `desktop/.venv/Scripts/python desktop/build.py --web` y luego
`desktop/.venv/Scripts/python desktop/main.py`. Con la variable `DRAGOTOY_DEBUG=1` se abren las herramientas de desarrollo.

Si la tienda se publica en otra dirección: `DRAGOTOY_STORE_URL=https://otra-direccion.vercel.app`.

## Requisitos en la PC del local

- Windows 10 u 11 (traen WebView2). En Windows 7 no funciona.
- Internet, solo para la versión conectada (los datos están en Supabase, como en la web).
- El registro de errores queda en `%LOCALAPPDATA%\DragoToY\dragotoy.log`.
