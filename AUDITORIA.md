# Auditoría y plan · DragoToY

Fecha: 29 oct 2026. Base: el código de este repositorio, revisado archivo por archivo.

## 1. Qué hay hoy

**Stack:** React 19 + Vite, TypeScript, Tailwind 3, Framer Motion, React Hook Form + Zod, Zustand, Lucide. Sin servidor: los datos viven en el navegador (IndexedDB, desde la etapa 1). La capa `src/services/api.ts` ya tiene las rutas REST previstas para cuando exista un backend (`VITE_API_URL`).

**Módulos que funcionan de punta a punta:**

| Módulo | Estado |
|---|---|
| Cargar productos (alta continua, lector USB/cámara, plantillas por categoría, reposición, deshacer, importación CSV/Excel) | Completo |
| Inventario (tabla, búsqueda, filtros por categoría y nivel de stock, cajón de detalle, fotos) | Completo |
| Categorías (colores, plantillas y margen) | Alta y edición desde la app |
| Proveedores | Alta y edición desde la app |
| Reportes | Ventas por período, más y menos vendidos, balance y punto de equilibrio |
| Tienda online, descuentos, facturación, temporadas, avisos y asistente | Nuevo (etapa 3) |
| Login, roles, usuarios, actividad, copias de seguridad | Nuevo (etapa 1) |

## 2. Problemas encontrados y corregidos en esta etapa

1. **Los datos se perdían al recargar.** Todo vivía en memoria. → Ahora se guardan en IndexedDB en cada operación, con migración de esquema no destructiva (`src/services/localDb.ts`).
2. **El historial del producto era inventado.** El gráfico de "movimientos" se generaba al azar. → Eliminado. Ahora cada alta, reposición y ajuste deja un movimiento real con usuario, fecha y motivo.
3. **El stock se podía cambiar con +/− sin motivo ni rastro.** → El ajuste manual pide el stock contado y un motivo (conteo físico, merma, dañado, exhibición, error de carga, otro), queda en el historial y en Actividad, y solo lo puede hacer el dueño.
4. **Cualquiera podía borrar productos.** → Solo el dueño, con confirmación y registro.
5. **La importación no verificaba códigos repetidos en la capa de datos.** → Ahora es todo o nada: si un código ya existe o se repite en el archivo, no se guarda ninguna fila.
6. **"Deshacer" en Cargar productos usaba borrar y editar stock.** Con roles, eso le habría fallado al vendedor. → Operaciones propias: deshacer una carga recién hecha (la de uno mismo, hasta 30 min) o una reposición, con registro.
7. **No había usuarios ni control de acceso.** → Etapa 1, abajo.

## 3. Etapa 1 implementada: acceso, roles y trazabilidad

- **Primer uso:** pantalla para crear la cuenta del dueño. Los productos de ejemplo se cargan solo si se pide y quedan marcados "(ejemplo)".
- **Ingreso:**
  - Las contraseñas se guardan con hash PBKDF2-SHA256 (210.000 iteraciones y sal propia); nunca en texto.
  - Tras 5 intentos fallidos se bloquea 1 minuto.
  - La sesión dura 12 horas.
  - Avisa si Bloq Mayús está activado.
- **Roles:**

  | Permiso | Dueño | Vendedor |
  |---|---|---|
  | Ver inventario, cargar productos, reponer, subir fotos | ✓ | ✓ |
  | Ajustar stock a mano, borrar productos, importar archivos | ✓ | — |
  | Reportes, usuarios, actividad, copias de seguridad | ✓ | — |

  Los permisos se validan dos veces: en la interfaz (no se muestra lo que no se puede usar) y en la capa de datos (`requirePermission`), así no alcanza con ocultar un botón.
- **Usuarios** (solo dueño):
  - Alta de usuarios, cambio de rol, contraseña nueva, desactivar y reactivar.
  - No se puede desactivar el propio usuario ni dejar el sistema sin un dueño activo.
- **Actividad:**
  - Registro de ingresos (incluidos los fallidos), salidas, ajustes de stock, cambios de precio, borrados, importaciones, usuarios y copias de seguridad.
  - Filtro "solo acciones sensibles".
- **Copia de seguridad:** se descarga en JSON. Restaurar exige escribir "RESTAURAR".
- **Cuenta:** cualquier usuario puede cambiar su propia contraseña (pide la actual) y salir.

### Límite importante (decisión tomada: "solo navegador por ahora")

Sin servidor, el login **ordena el acceso y deja rastro**, pero **no es una barrera de seguridad real**: alguien con conocimientos técnicos y acceso a la computadora puede leer o modificar los datos del navegador. Además, los datos no se comparten entre equipos. Antes de usar el sistema para dinero (POS, caja), recomiendo pasar a un backend (Supabase o un servidor local). La capa de servicios está preparada para eso.

## 4. Requerimientos: qué está y qué falta

| Área | Hecho | Falta |
|---|---|---|
| A. Productos | SKU único, alta por escaneo, categorías (crear/editar), marca, precio de compra y recomendado, importación con plantilla Excel y resolución de categorías nuevas, fotos | Variantes, duplicar, exportación, edición masiva, etiquetas/QR |
| B. Ventas | Tienda online con carrito, cupones, promociones, reserva "paga al retirar" y compras de prueba; descuento automático de stock; anulación con trazabilidad | Punto de venta de mostrador con lector, pagos divididos, ventas en espera |
| C. Inventario | Stock mínimo, avisos de reposición (se marcan vistos), orden por urgencia, historial real con motivo, ajustes con motivo | Stock máximo, inventario físico guiado |
| D. Caja y finanzas | Balance del mes (ventas, IVA, costo, margen, gastos fijos), punto de equilibrio | Apertura/cierre de caja, arqueo, retiros, gastos variables |
| E. Compras y proveedores | Alta y edición de proveedores; sugerencias de reposición por temporada | Órdenes de compra, recepción parcial, cuentas pendientes |
| F. Clientes | Datos del cliente en cada venta | Ficha, historial, cumpleaños, lista de deseos |
| G. Reportes | Ventas por día/semana/mes/año con %, más y menos vendidos, stock valorizado, balance, equilibrio | Comparativas de períodos personalizadas, reportes de caja y compras |
| H. Juguetería | Edad, baterías, temporadas (Navidad, Reyes, Día de las Infancias, editables) con anticipación de reposición | Tipo de pilas, advertencias, licencias, kits, asistente de regalos |
| Facturación | Comprobantes A/B/X numerados, IVA 21 % (discriminado en A, contenido en B), impresión, anulación | Factura electrónica ARCA/AFIP (requiere servidor + certificado) |
| Asistente | Preguntas predefinidas y escritas a mano, respondidas con datos reales y según el rol | IA conversacional real (requiere backend para la clave de API) |
| Seguridad | Roles, permisos, validaciones, confirmaciones, duplicados, auditoría, copias | Copia automática programada; seguridad real requiere backend |

**Costo:** el producto ya tiene precio de compra. Los productos cargados antes no lo tienen; hasta completarlo, no entran en el cálculo de margen ni de equilibrio.

## 5. Plan por etapas (siguientes)

| # | Etapa | Contenido | Depende de |
|---|---|---|---|
| 2 | Backend (recomendado) | Mover IndexedDB a Supabase o a un servidor local con SQLite; login real | Tu decisión |
| 3 | Catálogo | Costo y margen, ABM de categorías, marcas y proveedores, duplicar, exportar, edición masiva, etiquetas/QR, campos de juguetería (pilas, advertencias, licencia, colección, temporada) | — |
| 4 | POS | Venta con lector, carrito, descuentos, varios medios de pago, pagos divididos, ventas en espera, ticket, devoluciones y anulaciones con trazabilidad | 3 (costos) |
| 5 | Inventario | Inventario físico guiado, stock máximo, productos sin rotación, sugerencias de compra | 4 (ventas) |
| 6 | Caja | Apertura y cierre, arqueo, ingresos y egresos, retiros, gastos, control por medio de pago | 4 |
| 7 | Compras | Órdenes de compra, recepción parcial o total (reutiliza Cargar productos), actualización de costos, cuentas de proveedores | 3 |
| 8 | Clientes | Ficha, historial, cumpleaños, lista de deseos, frecuentes | 4 |
| 9 | Reportes | Ventas por período, más y menos vendidos, rentabilidad, comparativas, caja, compras, gastos, dashboard | 4–7 |
| 10 | Juguetería | Kits de regalo, accesorios compatibles, asistente de regalos por edad y presupuesto | 3, 4 |
| 11 | Automatizaciones | Copias automáticas, alertas, sugerencias inteligentes | — |

## 6. Cómo probar la etapa 1

1. Abre la app con el navegador limpio, o borra los datos del sitio en DevTools (Application → Storage → Clear site data). Aparece "Configurar la tienda".
2. Crea al dueño. Con una contraseña de menos de 8 caracteres o sin números, avisa.
3. En **Usuarios**, crea un vendedor y sal desde la tarjeta de usuario (abajo a la izquierda, o el círculo arriba a la derecha en el celular).
4. Ingresa con una contraseña equivocada: aparece el mensaje y se registra en Actividad. Tras 5 intentos fallidos, se bloquea 1 minuto.
5. Como vendedor:
   - no ves Reportes, Usuarios ni Actividad (y si escribes `/reportes` en la barra, la app te avisa que es solo para el dueño);
   - en el cajón de un producto no aparecen "Ajustar" ni "Eliminar";
   - en Cargar productos no aparece "Desde archivo".
6. Como dueño, ajusta el stock de un producto: el ajuste aparece en el historial del cajón y en **Actividad**.
7. Recarga la página: la sesión y los datos siguen ahí.

Lo anterior está automatizado en una prueba de navegador. Los 13 pasos pasaron sin errores de consola.
