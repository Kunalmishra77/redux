# Loading a Eurobrass catalogue PDF (D30)

How the 2025 catalogue (48 pages, 469 products) was loaded on 15 Oct 2026. The everyday path for REDUX
is **Admin → Catalog → Import CSV**; these scripts are for a whole new catalogue PDF.

1. `python -I extract.py <pymupdf-dir> <catalog.pdf> <out>` — reads every product code, name, series and
   page, and crops each product's own photo from the page (`<out>/img`, `<out>/products.json`).
   The catalogue's font maps digits to other glyphs (ȉȦȶȴȏȍȰȮȁȟ = 0–9); the script decodes them.
   Needs PyMuPDF (`python -m pip install --target <pymupdf-dir> pymupdf`) — not a project dependency.
2. `python -I build_rows.py <out>/products.json <out>/rows.json` — category and rate-card fitting type
   per product, series descriptions from the catalogue, SKUs (a code used twice gets `-B`, `-C`).
3. `node --import file:///<repo>/scripts/dev/supabase-dns.mjs --env-file=<repo>/.env.local load-catalog.mjs <out>`
   — categories, photos to the `brand` bucket (`catalog/<sku>.jpg`), products through `import_products`
   as the Super Admin (the same function as the admin screen), then unpublishes the generic `GEN-` entries.

Known limits of the 2025 PDF: product photos are ~80 px thumbnails; two products have none (PU 102,
IV 679); 16 codes are shared by two items; the GEORGIAN page has placeholder text. See
`blueprint/00-brief/04-assumptions-open-questions.md` A15–A17.
