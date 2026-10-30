---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

## Scope

DragoToY inventory app shell (React SPA): Inventario, Carga Rápida, Proveedores, Categorías, Reportes. Mode: Operate. Primary job: load a supplier shipment fast (keyboard + scanner first, also tablet/phone). Code-led build.

## Direction contract

THESIS: Each incoming shipment is a game in progress: every saved product moves the lote's token one space along a track of category-coloured spaces toward the declared goal. Refuses the category default of a grey table with one blue accent and a generic progress bar.

OWN-WORLD: Board-game graphic tradition held to type, palette, density, signature move. Warm off-white ground #FAF7F0, deep teal shell rail #1E4D57, ink #24303A; category colours as flat board-space fills: sun yellow, coral, turquoise, lilac, leaf. Nunito, heavy weights for headings, tabular figures for SKU/stock/price. Rounded-2xl surfaces with soft offset shadows; product "cards" carry a category colour band; stock read on a fixed 3-pip ramp (Bajo/Medio/Alto) everywhere. Standard web controls only.

STORY: The employee opens Carga Rápida, sets the lote goal, scans or types, hits Ctrl+Enter, sees the card drop onto the stack and the token advance, and keeps going without touching the mouse until the goal space is reached.

FIRST VIEWPORT: Teal side rail left (nav, lote shortcut). Main: page title + lote meta row; full-width lote track (25–50 spaces, coloured by category of each saved product, token on the current space, "18 / 50 · faltan 32" in tabular figures). Below, two columns: quick-add form (SKU first and focused, category chips, smart-defaults hint, price/stock/age/batteries, primary "Guardar y siguiente Ctrl+Enter") and right column "Recién guardados" card stack. Phone: track compresses to a segmented bar, stack moves below form.

FORM: Board game (tablero de juego), position 5 of 7 on the ordered list; raises kept: tabular figures updating in place (split-flap), explicit lote goal (j-card), fixed stock ramp (star atlas), isolated destructive actions (console). seed:0fbc1db2daa12f0f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Currency symbol unconfirmed (configurable, default "$"). Real API endpoints unknown; service layer mocks them.
