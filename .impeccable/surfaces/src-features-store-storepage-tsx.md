---
version: 1
slug: "src-features-store-storepage-tsx"
primary_target: "src/features/store/StorePage.tsx"
related_targets: []
---

## Scope

Customer-facing online store at /tienda (Persuade mode). Public, no login. Reads live inventory from Supabase (only in-stock products, no costs), applies promotions, validates coupons server-side, cart + checkout that registers a sale: reservation paid at pickup, or a test purchase. Argentina, ARS, IVA 21% included. Only this route changes world; the staff panel keeps the board-game system. Code-led (no image generation): the hero scene is authored SVG.

## Direction contract

THESIS: The store is a toy valley at dusk seen through a vine-framed window: the DragoToY fire tile rises over the hills like the sun, toys peek over the ridge, and the catalog below reads like a game's world index, with category tabs and framed cards. Refuses the white e-commerce grid with a banner carousel.

OWN-WORLD: Near-black pine ground (#0E1513), pine surfaces (#16201E), 1px hairlines (#263431) broken by a single dot. Display in Lilita One (white for titles, moss green #6BC48A for inactive tabs and the footer wordmark), body Nunito in sage (#8FA89B). Fire gradient lives only on the logo tile; the one accent action is fire orange (#FF8A2B) with dark ink. Category fills appear only as small dots and icon tint. Cards: image wells with irregular rounded corners and a 2px dark-moss rim; actions read as "Agregar al carrito →" rows.

STORY: A family lands, sees the logo glowing over a dusk valley with rising embers, reads "Juguetes con fuego de dragón" and the next-season countdown, follows "Ver juguetes", switches category tabs, adds toys, reviews a dark cart with coupon, reserves for pickup or makes a test purchase, and prints the receipt.

FIRST VIEWPORT: Dark top bar: logo tile + Lilita wordmark left, search pill, outlined cart pill right. Below, a framed illustration panel inset from the edges with a vine silhouette across its top edge: dusk sky, stars, three mountain ranges, pines, a grassy hill with toy silhouettes. Centered: 96px fire tile with a warm halo and ember canvas (the sun over the valley), Lilita headline ~3.6rem white, one ink line, "Ver juguetes ↓" as a fire-orange pill with dark ink (changed from a white text link for contrast: the sky behind it measured 2.7:1), countdown chip. The sky stays deep blue behind the text band; the dusk light sits on the ranges. Primary action reachable without scrolling.

FORM: user-pinned. The user fixed the direction themselves: the logo replaces the old dragon, in the style of their dark game-site reference image. No concept roll was run, so there is no seed reference to record.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

No payment gateway: online sales are reserved and paid at pickup, or flagged as test purchases. No newsletter or social links until the store has real accounts (user decision).
