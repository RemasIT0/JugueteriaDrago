---
name: DragoToY Inventario
description: Inventory for a toy store, built as a board game where every saved product moves the lote's token one space.
colors:
  ground: "#FAF7F0"
  surface: "#FFFFFF"
  sunken: "#F3EFE6"
  line: "#E9E3D6"
  ink: "#24303A"
  ink-soft: "#5A666F"
  on-fill: "#24303A"
  rail: "#1E4D57"
  rail-ink: "#D5E7E4"
  rail-hover: "#29606B"
  sol: "#F6C945"
  sol-ink: "#7A5700"
  sol-wash: "#FFF4CF"
  coral: "#F07C6B"
  coral-ink: "#A63B2C"
  coral-wash: "#FDE5E0"
  turquesa: "#3DB4A8"
  turquesa-ink: "#146E65"
  turquesa-wash: "#DAF3EF"
  lila: "#9C8CE8"
  lila-ink: "#5846B3"
  lila-wash: "#ECE8FC"
  hoja: "#7CC46B"
  hoja-ink: "#377329"
  hoja-wash: "#E4F4DE"
  cielo: "#5AA9E6"
  cielo-ink: "#1A629C"
  cielo-wash: "#DEEEFB"
  peligro: "#CD4034"
  peligro-wash: "#FCE4E0"
typography:
  display:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "'ss01'"
  headline:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.55
  body:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.5
  body-small:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  label:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.33
  micro:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 900
    lineHeight: "1rem"
  figures:
    fontFamily: "Nunito Variable, Nunito, ui-rounded, system-ui, sans-serif"
    letterSpacing: "0.01em"
    fontFeature: "'tnum'"
rounded:
  md: "6px"
  lg: "8px"
  xl: "14px"
  2xl: "20px"
  3xl: "28px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.2xl}"
    padding: "0 20px"
    height: "48px"
  button-accent:
    backgroundColor: "{colors.sol}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  button-danger:
    textColor: "{colors.peligro}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.peligro-wash}"
    textColor: "{colors.peligro}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 14px"
    height: "48px"
  category-chip:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-small}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "40px"
  category-chip-selected:
    backgroundColor: "{colors.lila}"
    textColor: "{colors.on-fill}"
  category-tag:
    backgroundColor: "{colors.turquesa-wash}"
    textColor: "{colors.turquesa-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.3xl}"
    padding: "20px"
  stack-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "10px 14px"
  nav-rail:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    width: "240px"
  nav-item-active:
    backgroundColor: "{colors.sol}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.xl}"
    height: "44px"
  track-space:
    backgroundColor: "{colors.sunken}"
    rounded: "10px"
    height: "32px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.2xl}"
    padding: "12px 16px"
---

# Design System: DragoToY Inventario

## Overview

**Creative North Star: "Tablero de juego"**

Every incoming shipment is a game in progress. The lote is a track of flat, category-coloured board spaces; each saved product fills the next space with its category's colour and the token hops forward toward the sun-yellow goal flag. The rest of the app is the same table seen from other angles: warm off-white card stock on which rounded surfaces rest, a deep teal rail along the edge like the side of the box, flat colour casillas that always mean a category, and figures that never jiggle.

Density is operational, not playful-loose: the employee is loading fifty products in five minutes with a scanner and the keyboard. Playfulness lives in material and motion (heavy rounded type, flat fills, spring hops, cards dropping onto a stack), never in extra steps or decorative chrome. Controls are standard web controls in board-game clothing.

The confirmed anti-reference is the category default: a grey data table with one blue accent and a generic progress bar.

**Key Characteristics:**
- Warm paper ground (ground) with white rounded surfaces resting on it; deep teal rail as the frame.
- Six flat category colours used as board spaces, chips, tags and card bands, always with a dark ink and a pale wash partner.
- Nunito at heavy weights only (600 to 900); tabular figures for every number.
- Soft teal-tinted drop shadows with a 1px line lip; the token is the only piece with a solid base shadow.
- Spring motion: the token hops, the selected chip and active nav slide, cards drop and their colour band snaps shut.
- Fixed 3-pip stock ramp (Bajo / Medio / Alto) wherever stock appears.

## Colors

A warm paper table, a teal frame, and a box of six flat board-game colours that each carry a fill, an ink and a wash.

All colours are CSS variables holding RGB channels in `src/index.css`, consumed through Tailwind as `rgb(var(--name) / alpha)`. Dark mode (`.dark`) redefines only the variables; class names never change. Hex values in the frontmatter are exact conversions of the light-mode channels; dark-mode values live in `.impeccable/design.json` (`colorMeta.<token>.dark`).

### Primary
- **Sol (Sun Yellow)** (sol): the "you are here" colour. Active nav item background, the goal space and flag on the track, the accent button, the mobile nav active pill, text selection (55% alpha), and the Bajo-to-Medio middle pip. Text on it is always on-fill ink.
- **Deep Teal Rail** (rail): the frame. Desktop side rail (240px), mobile top bar, track-space fill in the rail's mini track. Paired with rail-ink for resting text and rail-hover for hover and the lote mini-card.

### Secondary
- **Turquesa** (turquesa): the system's interaction colour beyond category use. Focus outline (3px), input focus border and 4px focus halo at 28% alpha, the Alto stock pip, toast success icon.
- **Coral** (coral): the text caret colour in every field, the sold series in product charts, toast warning icon.

### Tertiary (the board spaces)
- **Lila, Hoja, Cielo** (lila, hoja, cielo) together with sol, coral and turquesa form the six category families. Each family has three roles: fill (track spaces, selected chip, card band, tag dot), ink (tag text, icon tint; meets text contrast on its wash and on surface), and wash (tag background, soft panels).

### Neutral
- **Warm Paper** (ground): page background in light mode.
- **White Card** (surface): every resting surface: cards, inputs, drawer, track panel.
- **Sunken Felt** (sunken): empty track spaces, secondary buttons, segmented-control trough, metric pills, unselected chips, skeleton base.
- **Board Line** (line): 2px input borders, table dividers, milestone spaces on the track, empty pips, the 1px lip under shadows, scrollbars.
- **Ink** (ink): text, primary button fill, toast fill, the token.
- **Soft Ink** (ink-soft): labels, meta lines, secondary text, placeholders (at 80%).
- **On-fill Ink** (on-fill): text and icons placed on any category fill or on sol. Identical in both themes because fills do not change.
- **Peligro** (peligro, peligro-wash): errors, invalid-field border, the Bajo pip, the danger button outline and hover wash, retry pills.

### Named Rules
**The Board Space Rule.** A category colour as a flat fill means exactly one thing: this product belongs to that category. Fills are never gradients, never decorative, never reused for status (status has peligro and the pip ramp).

**The Fixed Board Rule.** Category fills and sol are the same in light and dark mode; only their ink and wash partners shift. Anything sitting on a fill uses on-fill ink.

**The Sol Marks Here Rule.** Sun yellow is reserved for current position and goal: active section, the goal flag, the one accent action. If two sol elements compete on screen, one is wrong.

## Typography

**Display Font:** Nunito Variable (with Nunito, ui-rounded, system-ui)
**Body Font:** Nunito Variable, same family
**Label/Mono Font:** none distinct; figures use Nunito with tabular numerals

**Character:** One rounded humanist family worn heavy, like printed game-box type: friendly terminals, dense black headings, and stylistic set `ss01` applied globally.

### Hierarchy
- **Display** (900, 1.875rem on sm and up, 1.5rem on phones, tracking -0.025em): page titles (Carga Rápida, Inventario, Proveedores, Categorías, Reportes) and the lote counter ("18 / 50", leading 1).
- **Headline** (900, 1.5rem, leading tight): product name at the top of the drawer.
- **Title** (900, 1.125rem): supplier and category card names; section headings at body size in black weight.
- **Body** (700 to 800, 0.9375rem): input text, button labels (800), product names in the stack and table (800).
- **Body small** (600 to 800, 0.875rem): meta lines under titles, chip labels, table secondary columns.
- **Label** (800, 0.75rem, sentence case, ink-soft): field labels and table column headers. No uppercase, no tracking.
- **Micro** (900, 0.6875rem / 1rem): keyboard hints (Kbd), milestone numbers on the track, mobile nav labels, chip shortcut hints.

### Named Rules
**The Heavy Ink Rule.** No weight below 600 anywhere. Labels and controls are 800, headings and counts 900.

**The Still Figures Rule.** Every SKU, stock count, price, goal, pace and time uses tabular figures (`font-variant-numeric: tabular-nums`, letter-spacing 0.01em). Counters that change in place flip digit by digit (FlipNumber) rather than re-rendering.

## Layout

App shell is a fixed 240px teal side rail plus a main column capped at 1400px, padded 16px / 24px / 32px at base / sm / lg, with extra bottom padding (112px) on phones for the bottom nav. Below lg (1024px) the rail becomes a 56px teal top bar and a five-item bottom nav (64px items, surface at 95% with backdrop blur, 2px top line).

Pages stack vertically with a 20px gap: header row (title plus meta, controls right-aligned and wrapping), then the main panel. Carga Rápida at xl (1280px) splits into the form column and a fixed 22rem "Recién guardados" column; below xl the stack falls under the form. The lote track shows up to 25 columns of 32px spaces with 6px gaps on sm and up; on phones it compresses to a ~10-segment rounded bar ending in a small sol flag. The lote setup fields fold into one tappable summary line on phones.

Spacing follows Tailwind's 4px grid, with 8px, 12px and 20px as the working rhythm (gap-2, gap-3, gap-5); card interiors are 16px on phones and 20px from sm. Targets are 40 to 48px tall (chips 40, buttons 44, inputs 48, large primary 48).

## Elevation & Depth

Hybrid: surfaces rest on the table with soft, downward, teal-tinted shadows and a 1px line-coloured lip, never floating glows. Inside surfaces, depth is tonal: sunken felt for troughs, empty spaces and secondary controls. Dark mode keeps the same structure with a black shadow colour.

### Shadow Vocabulary
- **Card** (`0 1px 0 rgb(var(--line)), 0 14px 30px -20px rgb(var(--shadow) / 0.45)`): every resting card, the track panel, stack cards, primary and accent buttons, the selected segmented tab.
- **Lift** (`0 2px 0 rgb(var(--line)), 0 22px 40px -22px rgb(var(--shadow) / 0.55)`): floating things above the page: toasts and the camera-scanner dialog.
- **Drawer** (`-24px 0 60px -30px rgb(var(--shadow) / 0.6)`): the right-side product drawer casting onto the list.
- **Focus** (`0 0 0 4px rgb(var(--turquesa) / 0.28)`): input focus halo, paired with a turquesa border.
- **Token** (`0 3px 0 rgb(var(--shadow) / 0.35), 0 8px 14px -4px rgb(var(--shadow) / 0.5)`): the game piece only.

### Named Rules
**The Table-Top Rule.** Shadows fall down and are tinted by the teal shadow channel; nothing glows, nothing floats sideways except the drawer.

**The One Piece Rule.** A solid zero-blur base shadow belongs to the token, because it is a physical piece standing on a space. Cards and buttons never get a hard offset slab.

## Shapes

Generously rounded, with the radius rising with surface size: 6px for keycaps, 8px for small inline buttons, 14px for buttons, inputs and nav items, 20px for stack cards, the segmented control and toasts, 28px for main panels, the track panel, empty states and the drawer's leading edge. Pills (full radius) for category chips, tags, pips, the mobile nav active pill and phone track segments. Track spaces are rounded squares (10px) and the rail's mini track uses 4px cells: board spaces stay squarer than the cards they sit in.

Borders are 2px when present (inputs, danger button, Cerrar lote, empty-state dashed outline, table header rule) and line-coloured at rest. Stack cards and product thumbnails clip a flat category band across the top (8px on cards, 6px on thumbs, 16px on the drawer's large thumb).

## Components

### Buttons
Tactile and heavy: they rise 1px on hover and press to 97% on tap with a quick spring.
- **Shape:** 14px radius at sm (36px tall) and md (44px tall); large (48px tall) uses 20px.
- **Primary:** ink fill, ground text, card shadow, 800 weight. The main commit action ("Guardar y siguiente") pairs a turquesa check and an inline Kbd hint.
- **Accent:** sol fill with on-fill ink; brightens 4% on hover. Use for the single most important non-commit action.
- **Secondary:** sunken fill, ink text, hover to line at 70%.
- **Ghost:** ink-soft text, hover to sunken fill and ink text.
- **Danger:** 2px peligro outline at 40%, peligro text, no fill until hover or focus (peligro-wash fill, full-strength border).
- **Disabled:** 45% opacity, no pointer events.
- **Kbd hint:** 20px keycap, 6px radius, micro type, background is currentColor at 16% so it works on any fill.

### Chips (category picker)
- **Style:** 40px pill, sunken fill, ink-soft text, a 10px dot in the category fill, a micro "Alt n" hint at xl.
- **State:** selected chip takes the full category fill with on-fill ink; the fill slides between chips as a shared layout element (spring 600/34). Invalid group shows a 2px peligro ring at 50%. Single tab stop, arrow keys move.

### Category Tag
Pill on the category wash with category-ink text and an 8px fill dot; 28px (sm) or 24px (xs, micro type).

### Cards / Containers
- **Corner Style:** 28px for panels, 20px for stack cards.
- **Background:** surface.
- **Shadow Strategy:** Card shadow (see Elevation).
- **Border:** none; empty states use a 2px dashed line border instead of a shadow.
- **Internal Padding:** 16px, 20px from sm. The quick-add form card closes with a sunken footer band holding the template hint.

### Inputs / Fields
- **Style:** 48px tall, surface fill, 2px line border, 14px radius, body type at 700, coral caret; placeholder 600 at ink-soft 80%.
- **Focus:** border turns turquesa plus 4px turquesa halo at 28%; hover darkens border to ink-soft 40%.
- **Error / Disabled:** aria-invalid sets a peligro border and a peligro halo at 20%; the error line (label type, peligro, 700) replaces the hint with a short fade-down.
- **Label:** label type above the control, 6px gap; hint below in 600 ink-soft.

### Navigation
- **Desktop rail:** 240px teal column, logo at top, 44px items with 2.4-stroke icons and 800 labels in rail-ink; hover fills rail-hover with white text; the active item is a sol pill (14px radius) that slides between items (spring 500/38) with on-fill ink. The lote mini-card (rail-hover at 70%, 20px radius) sits at the bottom with a 10-cell mini track and its own token.
- **Mobile:** teal top bar with logo and theme toggle; bottom nav of five icon-over-label items, the active icon sitting in a 32x48px sol pill.

### Lote Track (signature)
The board itself, inside a 28px surface panel. Header: lote counter in display type with flipping digits, "faltan n" at 800, metric pills on sunken (Gauge in turquesa-ink, Timer in coral-ink), and an outlined "Cerrar lote" button set apart from the fields. Spaces: 32px tall, 10px radius; empty = sunken, every tenth = line with its micro milestone number, last = sol with a flag. Filled spaces take the saved product's category fill and pop in (scale 0.6 to 1.12 to 1). The token is an ink disc with a 3px surface ring that hops between spaces (spring 460/20). On reaching the goal every space ripples up 6px in sequence.

### Recién guardados Stack (signature)
Cards drop in from above with a slight rotation (spring 520/30), newest on top; the 8px category band at the top snaps from 3x height to 1x with a bouncy spring (700/14). Each card shows name, StockPips, and a tabular meta line (SKU · qty · time). The top card carries the undo control; cards past the fifth fade to 50%.

### Stock Pips
Three 8px dots, 3px apart. Bajo = 1 peligro pip, Medio = 2 sol pips, Alto = 3 turquesa pips; unlit pips are line. Label is visually hidden unless requested.

### Toast
Ink pill-card (20px radius, lift shadow) with ground text, turquesa success or coral warning icon, and a sol text action. Springs up from bottom centre, above the mobile nav.

## Do's and Don'ts

### Do:
- **Do** colour a track space, chip, card band or tag dot only with the product's category fill, and pair text on it with on-fill ink.
- **Do** set every number (SKU, stock, price, goal, pace, time) in tabular figures, and flip digits in place when a counter changes.
- **Do** show stock with the 3-pip ramp (peligro / sol / turquesa) everywhere stock appears: table, stack, drawer.
- **Do** keep type at 600 or heavier: 800 for labels and controls, 900 for headings and counts.
- **Do** rest surfaces on the Card shadow and use sunken felt for troughs and empty states inside them.
- **Do** keep destructive actions outlined, separated from the data fields, and confirmed (Cerrar lote, Eliminar).
- **Do** use spring motion for things that move between places (token, active nav, selected chip, stack cards) and honour reduced motion.

### Don't:
- **Don't** build the category default: a grey table with one blue accent and a generic progress bar.
- **Don't** put category colours in gradients or use them for status or decoration.
- **Don't** give cards or buttons a hard zero-blur offset shadow; that base belongs to the token alone.
- **Don't** set labels in uppercase with letter-spacing or add eyebrow labels above page titles; labels are sentence-case 800.
- **Don't** use a second display face or weights below 600.
- **Don't** let sol mark anything other than current position, goal, or the one accent action.
