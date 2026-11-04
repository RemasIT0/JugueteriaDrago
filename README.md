# DragoToY · Inventario

Sistema de inventario para la juguetería DragoToY, pensado para cargar mercadería **rápido** cuando llega un lote.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # compila a dist/
```

**Primer uso:** la app pide crear la cuenta del dueño. Opcionalmente carga productos de ejemplo (marcados "(ejemplo)").

**Datos:** sin backend, todo se guarda en este navegador (IndexedDB) y sobrevive a recargas. Descarga una copia de seguridad seguido desde **Usuarios → Copia de seguridad**. Para conectar una API real, copia `.env.example` a `.env` y define `VITE_API_URL`.

**Acceso:** dos roles. El **dueño** puede todo; el **vendedor** carga, repone y consulta, pero no ajusta ni borra stock, no importa archivos y no ve reportes, usuarios ni actividad. Detalle, límites de seguridad y plan por etapas: [AUDITORIA.md](AUDITORIA.md).

## Secciones

| Sección | Para qué |
|---|---|
| **Tienda online** (`/tienda`, sin login) | Lo que ven los clientes: dragón animado, catálogo con filtros por categoría, edad y temporada, promociones, carrito, cupones y reserva para pagar al retirar. Permite compras de prueba. |
| Inventario | Ordenado por urgencia (lo que falta primero), filtros por categoría, stock y temporada, cajón con precios, margen, temporadas e historial. |
| Cargar productos | Alta continua con lector, precio de compra y precio recomendado, temporadas; reposición desde una lista escrita o pegada (entiende errores de escritura y pregunta «¿quisiste decir…?»); importación con plantilla Excel (versión del dueño y versión para el proveedor, sin precio de venta). |
| Temporadas | Navidad, Reyes y Día de las Infancias (editables): cuenta regresiva y cuánto pedir de cada producto. |
| Reportes | Ventas por día/semana/mes/año (gráficos de barras y línea, %), más y menos vendidos, balance del mes y punto de equilibrio. |
| Facturación | Comprobantes de cada venta (A, B o X), impresión y anulación con devolución de stock. |
| Descuentos | Promociones para uno o varios productos, por categoría o por temporada, y cupones con código. |
| Avisos y asistente | Campana con productos para reponer (al verlos se apagan) y asistente con preguntas como "¿quién bajó el stock?". |

**Límites honestos:** sin servidor no hay cobro online real (las compras se reservan y se pagan al retirar), los comprobantes no son factura electrónica de ARCA/AFIP, y la tienda solo ve el inventario de este mismo navegador.

## Stack

React 19 + Vite · TypeScript · Tailwind CSS 3 · Framer Motion · React Hook Form + Zod · Zustand · React Icons · Recharts (gráficos) · ExcelJS (plantilla) · PapaParse y read-excel-file (importación) · idb-keyval (base local).

## Estructura

```
src/
├── app/App.tsx                  Rutas y carga inicial de datos
├── components/
│   ├── layout/AppShell.tsx      Barra lateral, navegación móvil, transiciones de página
│   └── ui/                      Button, Field, Drawer, Skeleton, Toaster, Board (pips de stock, etiquetas)
├── features/
│   ├── quick-add/               ★ Cargar productos
│   │   ├── QuickAddPage.tsx     Página: lote, meta, proveedor, modo continuo / archivo
│   │   ├── schema.ts            Validación Zod + campos que se mantienen entre productos
│   │   ├── importFile.ts        Lectura y mapeo de CSV/Excel de proveedores
│   │   ├── hooks/useScannerDetection.ts   Detección de lector de códigos
│   │   └── components/          QuickAddForm, LoteTrack, RecentStack, CategoryPicker,
│   │                            BulkDropzone, CameraScanner
│   ├── inventory/               Tabla, filtros y cajón de detalle
│   ├── suppliers/ categories/ reports/
├── hooks/useHotkeys.ts          Atajos de teclado globales
├── services/                    api.ts (productos, catálogo) y http.ts. Único punto de acceso a datos
├── stores/                      Zustand: inventory (con guardado optimista), lote (persistido), theme
├── lib/                         config (nombre, moneda, API), formato, colores de categoría
├── mocks/seed.ts                Datos de ejemplo
└── types/
```

## Atajos

| Tecla | Acción |
|---|---|
| `Ctrl + Enter` | Guardar y siguiente |
| `Enter` en el código | Ir al siguiente campo útil (Nombre si es nuevo, Cantidad si ya existe) |
| `Alt + 1…6` | Elegir categoría desde cualquier campo |
| `Alt + N` | Limpiar el formulario / ir a Cargar productos desde otra sección |
| `Ctrl + Z` (con el campo vacío) | Deshacer el último guardado |
| `/` | Buscar en Inventario |
| `Esc` | Cerrar el cajón de producto |

`Ctrl + N` también está programado, pero Chrome y Edge lo reservan para abrir una ventana nueva y no dejan que una página lo use (salvo que la app esté instalada como PWA). Por eso el atajo que siempre funciona es `Alt + N`.

## Cómo se cargan 50 juguetes en 5 minutos

Meta: un producto cada 6 segundos.

1. **Abrir el lote (10 s).** `Alt + N` desde cualquier pantalla lleva a Cargar productos. Se elige el proveedor y la meta (50). La pista del lote muestra 50 casillas vacías y la bandera al final.
2. **Escanear (≈1 s).** El cursor ya está en *Código*. Se pasa el lector: el código entra solo y el cursor salta.
   - **Producto nuevo** → salta a *Nombre*.
   - **Producto que ya existe** → aparece un aviso azul con el stock actual, se completan nombre, categoría y precio, y el cursor salta directo a *Cantidad*: solo se escribe cuántas llegaron. Así se resuelve en ~2 s la mayor parte de un lote de reposición.
   - Si alguien escanea con el cursor en otro campo, el sistema devuelve ese campo a como estaba y pone el código donde va.
3. **Nombre (≈3 s).** Se escribe el nombre.
4. **Categoría (≈0,5 s).** `Alt + 4` (Juegos de mesa). La plantilla completa *Edad +5*, *Sin baterías* y el aviso de stock mínimo. La categoría y la marca **se mantienen** para el siguiente producto: en lotes de un mismo tipo no hace falta tocarlas.
5. **Precio y cantidad (≈2 s).** `Tab` salta de la categoría a *Precio* y de ahí a *Cantidad*. Acepta `39,90` o `39.90`.
6. **Guardar (≈0 s de espera).** `Ctrl + Enter`. El producto se valida en el mismo instante, entra a la pila de "Recién guardados" (la tapa de color se cierra con un rebote) y la ficha avanza una casilla. El formulario se limpia con un deslizamiento y el cursor vuelve a *Código* en el mismo cuadro: la pila muestra "listo en X ms". El guardado en el servidor sigue en segundo plano; si falla, la carta muestra **Reintentar** y no se pierde nada.
7. **Errores.** Si falta algo, se marcan los campos en rojo, el cursor va al primero y los mensajes se actualizan mientras se corrige. Nunca se borra lo ya escrito.
8. **Equivocaciones.** El botón de deshacer de la última carta (o `Ctrl + Z`) quita el último producto o la última reposición.
9. **Ritmo.** La pista muestra productos por minuto y tiempo transcurrido. Si el lote se corta (luz, recarga), el avance se conserva.
10. **Plan B: lista del proveedor.** Si el proveedor mandó Excel/CSV: pestaña *Desde archivo*, se arrastra el archivo, se revisa la vista previa (filas listas y filas con problemas, con el motivo) y se confirma. Se puede descargar una plantilla con las columnas esperadas.

En tablet o celular, el botón de cámara junto al código usa la cámara como lector (en navegadores con `BarcodeDetector`, por ejemplo Chrome en Android).

## API esperada

`src/services/api.ts` documenta cada ruta: `GET/POST /products`, `POST /products/bulk`, `PATCH/DELETE /products/:id`, `GET /products/:id/movements`, `GET /categories`, `GET /suppliers`. Para conectar el backend solo hay que definir `VITE_API_URL`; los componentes no cambian.
