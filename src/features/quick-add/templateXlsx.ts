/**
 * Plantilla Excel para cargar productos: colores por tipo de columna, listas desplegables
 * con las categorías y temporadas reales de la tienda, validaciones y una hoja de instrucciones.
 * ExcelJS es pesado: se descarga solo cuando alguien pide la plantilla.
 */
import type { Category, Season } from '@/types'

const C = {
  rail: 'FF1E4D57',
  ink: 'FF24303A',
  soft: 'FF5A666F',
  sol: 'FFF6C945',
  solWash: 'FFFFF4CF',
  turq: 'FFDAF3EF',
  turqInk: 'FF146E65',
  coralWash: 'FFFDE5E0',
  ground: 'FFFAF7F0',
  line: 'FFE9E3D6',
  white: 'FFFFFFFF',
}

interface Col {
  header: string
  key: string
  width: number
  required: boolean
  help: string
  example: string
  numFmt?: string
}

const COLUMNS: Col[] = [
  { header: 'Código de barras *', key: 'sku', width: 20, required: true, help: 'El número debajo del código de barras (o el código del proveedor). Único por producto.', example: '7790001234567' },
  { header: 'Nombre del producto *', key: 'name', width: 38, required: true, help: 'Cómo lo vas a buscar: tipo + personaje/modelo + tamaño.', example: 'Peluche Dragón Verde 30 cm' },
  { header: 'Categoría *', key: 'cat', width: 18, required: true, help: 'Elegí de la lista. Si escribís una nueva, el sistema te pregunta qué hacer al importar.', example: 'Peluches' },
  { header: 'Precio de compra', key: 'cost', width: 16, required: false, help: 'Lo que te cobra el proveedor por unidad. Sirve para márgenes y el precio recomendado.', example: '12500', numFmt: '"$" #,##0.00' },
  { header: 'Precio de venta *', key: 'price', width: 16, required: true, help: 'Precio al público con IVA. Si lo dejás vacío y pusiste el de compra, se usa el recomendado.', example: '24900', numFmt: '"$" #,##0.00' },
  { header: 'Cantidad *', key: 'qty', width: 11, required: true, help: 'Unidades que llegaron.', example: '12', numFmt: '0' },
  { header: 'Edad mínima', key: 'age', width: 12, required: false, help: 'Años. Vacío = la de la plantilla de la categoría.', example: '3', numFmt: '0' },
  { header: 'Baterías', key: 'bat', width: 11, required: false, help: 'Sí o No. Vacío = lo de la categoría.', example: 'No' },
  { header: 'Marca', key: 'brand', width: 16, required: false, help: 'Opcional.', example: 'El Osito' },
  { header: 'Temporadas', key: 'seasons', width: 26, required: false, help: 'Una de la lista, o varias separadas por coma.', example: 'Navidad, Reyes' },
]

const HEADER_ROW = 5
const ROWS = 300

export async function downloadTemplate(categories: Category[], seasons: Season[]) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DragoToY'
  wb.created = new Date()

  // ── Hoja principal ──
  const ws = wb.addWorksheet('Productos', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, xSplit: 2, showGridLines: false }],
    properties: { tabColor: { argb: C.sol } },
  })
  COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width))
  const last = COLUMNS.length

  ws.mergeCells(1, 1, 1, last)
  Object.assign(ws.getCell(1, 1), { value: 'DragoToY · Carga de productos' })
  ws.getCell(1, 1).font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } }
  ws.getRow(1).height = 34
  ws.mergeCells(2, 1, 2, last)
  ws.getCell(2, 1).value = 'Completá una fila por producto desde la fila 6. Las columnas amarillas (*) son obligatorias; las verdes, opcionales. No cambies los títulos de la fila 5.'
  ws.getCell(2, 1).font = { size: 11, color: { argb: C.white } }
  ws.getRow(2).height = 22
  for (const r of [1, 2]) {
    for (let c = 1; c <= last; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.rail } }
    ws.getCell(r, 1).alignment = { vertical: 'middle', indent: 1 }
  }

  // Leyenda de colores (fila 3)
  const legend: [string, string, string][] = [
    ['Obligatoria', C.sol, C.ink],
    ['Opcional', C.turq, C.turqInk],
    ['Ver hoja «Instrucciones»', C.ground, C.soft],
  ]
  legend.forEach(([text, bg, fg], i) => {
    const cell = ws.getCell(3, i * 2 + 1)
    ws.mergeCells(3, i * 2 + 1, 3, i * 2 + 2)
    cell.value = text
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    cell.font = { bold: true, size: 10, color: { argb: fg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws.getRow(3).height = 20
  ws.getRow(4).height = 8

  // Encabezados con nota de ayuda en cada uno
  const header = ws.getRow(HEADER_ROW)
  header.height = 30
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? C.sol : C.turq } }
    cell.font = { bold: true, size: 11, color: { argb: c.required ? C.ink : C.turqInk } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: C.rail } } }
    cell.note = { texts: [{ text: `${c.help}\nEj.: ${c.example}` }] }
  })
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: last } }

  // Filas de datos: bandas suaves, formatos y validaciones
  for (let r = HEADER_ROW + 1; r <= HEADER_ROW + ROWS; r++) {
    const row = ws.getRow(r)
    row.height = 20
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      if (c.numFmt) cell.numFmt = c.numFmt
      if ((r - HEADER_ROW) % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ground } }
      cell.border = { bottom: { style: 'hair', color: { argb: C.line } } }
      if (c.key === 'sku') cell.numFmt = '@' // texto: que Excel no convierta el código en 7,79E+12
    })
  }

  const idx = (key: string) => COLUMNS.findIndex((c) => c.key === key) + 1
  type Rule = NonNullable<ReturnType<typeof ws.getCell>['dataValidation']>
  const dv = (key: string, rule: Rule) => {
    for (let r = HEADER_ROW + 1; r <= HEADER_ROW + ROWS; r++) ws.getCell(r, idx(key)).dataValidation = rule
  }
  dv('cat', {
    type: 'list',
    allowBlank: true,
    formulae: [`Listas!$A$1:$A$${Math.max(1, categories.length)}`],
    showErrorMessage: false, // se permite escribir una nueva: se resuelve al importar
    showInputMessage: true,
    promptTitle: 'Categoría',
    prompt: 'Elegí una de la lista o escribí una nueva.',
  })
  dv('seasons', { type: 'list', allowBlank: true, formulae: [`Listas!$B$1:$B$${Math.max(1, seasons.length)}`], showErrorMessage: false })
  dv('bat', { type: 'list', allowBlank: true, formulae: ['Listas!$C$1:$C$2'], showErrorMessage: true, errorTitle: 'Baterías', error: 'Elegí Sí o No.' })
  for (const key of ['cost', 'price'])
    dv(key, { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: 'Precio', error: 'Escribí un número mayor o igual a 0, sin el signo $.' })
  for (const key of ['qty', 'age'])
    dv(key, { type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 99999], showErrorMessage: true, errorTitle: 'Número entero', error: 'Escribí un número entero, sin decimales.' })

  // ── Hoja de instrucciones ──
  const help = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: C.rail } }, views: [{ showGridLines: false }] })
  help.getColumn(1).width = 24
  help.getColumn(2).width = 70
  help.getColumn(3).width = 28
  help.mergeCells('A1:C1')
  help.getCell('A1').value = 'Cómo completar la plantilla'
  help.getCell('A1').font = { size: 16, bold: true, color: { argb: C.white } }
  help.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.rail } }
  help.getRow(1).height = 30
  const steps = [
    '1. Completá la hoja «Productos» desde la fila 6: una fila por producto.',
    '2. Las columnas amarillas son obligatorias. Las verdes podés dejarlas vacías.',
    '3. Guardá el archivo y en DragoToY andá a Carga Rápida → Desde archivo, y arrastralo.',
    '4. Antes de guardar, el sistema te muestra qué filas están bien y cuáles tienen problemas.',
    '5. Si escribiste una categoría nueva, el sistema te pregunta si crearla o usar una existente.',
  ]
  steps.forEach((s, i) => {
    help.mergeCells(i + 3, 1, i + 3, 3)
    help.getCell(i + 3, 1).value = s
    help.getCell(i + 3, 1).font = { size: 11, color: { argb: C.ink } }
  })
  const top = steps.length + 4
  ;['Columna', 'Qué poner', 'Ejemplo'].forEach((t, i) => {
    const cell = help.getCell(top, i + 1)
    cell.value = t
    cell.font = { bold: true, color: { argb: C.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.ink } }
  })
  COLUMNS.forEach((c, i) => {
    const r = top + 1 + i
    help.getCell(r, 1).value = c.header
    help.getCell(r, 1).font = { bold: true, color: { argb: c.required ? C.ink : C.turqInk } }
    help.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? C.solWash : C.turq } }
    help.getCell(r, 2).value = c.help
    help.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' }
    help.getCell(r, 3).value = c.example
    help.getCell(r, 3).font = { italic: true, color: { argb: C.soft } }
    help.getRow(r).height = 32
  })
  const catRow = top + COLUMNS.length + 2
  help.getCell(catRow, 1).value = 'Categorías actuales'
  help.getCell(catRow, 1).font = { bold: true }
  help.getCell(catRow, 2).value = categories.map((c) => c.name).join(' · ')
  help.getCell(catRow + 1, 1).value = 'Temporadas'
  help.getCell(catRow + 1, 1).font = { bold: true }
  help.getCell(catRow + 1, 2).value = seasons.map((s) => s.name).join(' · ')

  // ── Hoja de listas (oculta, al final) para los desplegables ──
  const lists = wb.addWorksheet('Listas', { state: 'veryHidden' })
  categories.forEach((c, i) => (lists.getCell(i + 1, 1).value = c.name))
  seasons.forEach((s, i) => (lists.getCell(i + 1, 2).value = s.name))
  lists.getCell(1, 3).value = 'Sí'
  lists.getCell(2, 3).value = 'No'

  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  Object.assign(document.createElement('a'), { href: url, download: 'plantilla-productos-dragotoy.xlsx' }).click()
  URL.revokeObjectURL(url)
}
