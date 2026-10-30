---
version: 1
slug: "src-features-store-storepage-tsx"
primary_target: "src/features/store/StorePage.tsx"
related_targets: []
---

## Scope

Customer-facing online store at /tienda (Persuade mode), inside the established DragoToY board-game world (DESIGN.md). Public, no login. Reads live inventory (only in-stock products, no costs), applies promotions, cart + checkout that registers a sale: real sale paid at pickup, or a test purchase. Argentina, ARS, IVA 21% included. Code-led (no image generation).

## Direction contract

THESIS: The store is the dragon's lair: a big friendly dragon head breathes fire over the toy board, and every toy is a game card you add to your cart. Refuses the category default of a white e-commerce grid with a banner carousel.

OWN-WORLD: Deep teal night ground (#1E4D57 family) for the lair, warm off-white (#FAF7F0) for the catalog board, board-space fills (sol, coral, turquesa, lila, hoja, cielo) for categories, prices and stickers. Nunito black for display, tabular figures for prices. Rounded cards with soft offset shadows; discount stickers as rotated coral roundels; cart as a sol button that bounces.

STORY: A family lands on the page, sees the dragon breathe fire and glow, clicks it to make it roar again, scrolls to the catalog filtered by category, age, and season, adds toys (the card jumps into the cart), reviews the cart with coupon, and confirms pickup or a test purchase; gets an order number and a printable receipt.

FIRST VIEWPORT: Top bar (logo SiDragonframe + DragoToY, search, cart with count). Full-width teal hero: authored SVG dragon head centered at ~60% of hero height, eyes glowing turquesa, mouth open emitting a canvas fire particle stream downward-forward; headline below the head in Nunito black, one line of copy, primary CTA "Ver juguetes" and a season countdown chip.

FORM: User-pinned structure ("cabeza de un dragón en el medio escupiendo fuego y le brillen los ojos") beats the dealt structures; position: user steer. seed:18bca66530af1438

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

No payment gateway: online sales are reserved and paid at pickup, or flagged as test purchases. Data lives in this browser (IndexedDB): the store only shows inventory from the same browser/device until a backend exists.
