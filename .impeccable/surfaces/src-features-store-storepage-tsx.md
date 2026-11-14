---
version: 1
slug: "src-features-store-storepage-tsx"
primary_target: "src/features/store/StorePage.tsx"
related_targets: ["src/features/store/HowToBuy.tsx","src/features/store/ToyDetail.tsx","src/features/store/store.css","src/features/store/Castle.tsx"]
---

## Scope

Customer-facing online store at /tienda (Persuade mode). Public, no login. Reads live inventory from Supabase (only in-stock products, no costs), applies promotions, validates coupons server-side, cart + checkout that creates a reservation paid at pickup (or a test reservation). Argentina, ARS, IVA 21% included. The hero (dusk valley with the fire tile) stays as built; everything below it, plus the toy page, cart drawer and confirmation, moves into the old castle ruins under the same night. The staff panel keeps the board-game system. Code-led: no image generation; ornaments (ruins, fangs, banners) are authored SVG, product imagery is real photos by URL.

## Direction contract

THESIS: Below the dusk valley the same night continues into the ruins of an old dragon's castle: weathered dark stone, broken battlements, moss, a few windows still lit by embers. Every toy sits in an arched ruin window set in the dragon's jaw, fangs along its edges. Refuses both the flat equal-box grid and a bright fairy-tale daytime castle (rejected by the user for breaking with the hero).

OWN-WORLD: The hero's own tokens: pine ground #0E1513, pine surfaces #16201E / #1E2C29, moss rim #2A4A35, sage text, moss tabs, fire orange #FF8A2B as the one action. Added material only: dark weathered stone (#2B3431 to #3A4440) with cracks, ember-lit window glow (#FFB45A), bone fangs (#E6DAC0 with pine ink), tattered banners (crimson #7E2A20 active). Almendra for tabs, section titles and toy names; Lilita stays for prices and actions; Nunito for reading. No flowers, no light ground.

STORY: A family scrolls from the dusk valley into the castle ruins without the light changing, picks a tattered banner (category), browses toys in fanged ruin windows with real photos, opens one, reserves, and gets the reservation sealed with its pickup code.

FIRST VIEWPORT: Unchanged dusk-valley hero with the fire "Ver juguetes" action. Directly below, under the same night sky, the silhouette of the old castle: broken towers, a collapsed wall and a ruined bridge, rim-lit warm toward the center like the hero's ranges, a few ember-lit windows; then the tattered banners hanging from a crumbling battlement.

FORM: user-pinned and user-corrected. The user rejected the bright dawn rendition and asked for colors close to the hero, an old castle, no flowers and dragon teeth on the boxes. No concept roll was run. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Product photos are hotlinked from Wikimedia Commons (free licenses, some CC BY-SA requiring attribution) as sample imagery; the owner replaces them with real shots. No payment gateway. No newsletter or social links until the store has real accounts.
