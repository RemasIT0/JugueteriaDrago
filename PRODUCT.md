# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

User-specified: React + Vite, TypeScript, Tailwind CSS, Framer Motion, React Hook Form + Zod, Zustand, Lucide React. No backend yet: data access goes through a service layer with mocked async calls, ready to point at a real API later.

## Users

Store employees of DragoToY, a toy store. Primary scene: a supplier shipment just arrived and an employee must register dozens of products fast, usually at a desktop/laptop with a USB barcode scanner, sometimes from a tablet or phone using the camera as a scanner. They want to finish the load and get on with their shift.

## Product Purpose

Inventory management for a toy store: register incoming stock, browse and filter the catalogue, check stock levels, suppliers and categories. Success means an employee can load ~50 products in about 5 minutes without errors.

## Positioning

Obsessive focus on "Carga Rápida" (Quick-Add): continuous entry without page reloads, scanner detection, keyboard-first shortcuts, category-based smart defaults, and a CSV/Excel bulk-import fallback.

## Operating Context

- Shipment arrival: continuous entry, scanner bursts, keyboard shortcuts (Ctrl+N new, Ctrl+Enter save and next, Tab between logical fields).
- Supplier spreadsheets (CSV/Excel) imported in bulk.
- Inventory review: table with quick filters by category and stock state (Bajo, Medio, Alto); product detail in a side drawer.
- Sections: Inventario, Carga Rápida, Proveedores, Categorías, Reportes.

## Capabilities and Constraints

- UI language: Spanish.
- Must work on desktop and on tablet/phone (responsive is a real requirement, not an afterthought).
- Currency: not yet specified; kept configurable in one place (inferred default "$").
- No real sales history data exists yet; any shown is mock data and must be labelled as such in code.

## Brand Commitments

- Name: DragoToY.
- Brief-pinned feel: professional but friendly, fitting a toy store without becoming childish. Light, low-fatigue base with soft vibrant accents (soft yellow, coral, turquoise), rounded sans-serif, rounded cards with soft shadows, optional dark mode.

## Evidence on Hand

No logo, product photos, or real catalogue. Do not fabricate customers, sales figures or suppliers as if real; sample data is placeholder.

## Product Principles

1. Speed of the shipment workflow beats everything: no wait, no lost focus, no extra click.
2. Keyboard and scanner first; mouse and touch fully supported.
3. Never lose entered data; errors are shown inline and immediately.
4. Friendly in the details, calm in the structure.
