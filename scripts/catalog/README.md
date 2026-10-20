# Loading a Eurobrass catalogue PDF (D30)

How the 2025 catalogue (48 pages, 469 products) was loaded on 15 Oct 2026. The everyday path for REDUX
is **Admin → Catalog → Import CSV**; these scripts are for a whole new catalogue PDF.

1. `python -I extract.py <pymupdf-dir> <catalog.pdf> <out>` — reads every product code, name, series and
   page, and crops each product's own photo from the page (`<out>/img`, `<out>/products.json`).
   The catalogue's font maps digits to other glyphs (ȉȦȶȴȏȍȰȮȁȟ = 0–9); the script decodes them.
   Needs PyMuPDF (`python -m pip install --target <pymupdf-dir> pymupdf`) — not a project dependency.
2. `python -I build_rows.py <out>/products.json <out>/rows.json` — category and rate-card fitting type
   per product, series descriptions from the catalogue, SKUs (a code printed for two different items becomes Version A / B: `<CODE>-A`, `<CODE>-B`).
3. `node --import file:///<repo>/scripts/dev/supabase-dns.mjs --env-file=<repo>/.env.local load-catalog.mjs <out>`
   — categories, photos to the `brand` bucket (`catalog/<sku>.jpg`), products through `import_products`
   as the Super Admin (the same function as the admin screen), then unpublishes the generic `GEN-` entries.

4. Sharper photos from eurobrass.in (19 Oct 2026). Save every image URL from the site's series and
   accessory pages into `<out>/eb-site/all-images.txt` (one per line; the file names carry the product
   code, e.g. `PU0102-Single-Lever-Basin-Mixer-Extended_A3A6994-copy.jpg`), then
   `python -I match_site.py <out>/eb-site/all-images.txt <out>/rows.json <out>/eb-site/matches.json`.
5. `node … site-photos.mjs <out>` — downloads each sure match (score ≥ 0.3), stores it at
   `catalog/eb/<sku>.jpg` and makes it the product's photo. Resumable; it skips products already done.
   2025 result: 360 products upgraded, 109 left on the thumbnail. Three codes print a different
   product on the site than in the catalogue (ST 930, CL 3015-B, LT 4006) and were left alone.
6. `node … series-covers.mjs` — the 15 series covers (`catalog/series/<slug>.jpg`) used on /products.
7. `node … process-photos.mjs <dir>` — the five stage photos on /how-we-restore.

8. `node … studio-photos.mjs <dir>` — REDUX's own studio photos (files named by code, e.g. `ebsen010-a.jpg`)
   → `catalog/studio/<sku>.jpg`. 20 Oct 2026: the 109 products left on thumbnails; every product now has a sharp photo.

Images REDUX generates itself follow `blueprint/05-content/03-image-prompts.md`; website images (hero, before/after,
process, case studies, photo-slot examples) live in `public/site/`, resized to the sizes in that document.

Known limits of the 2025 PDF: product photos are ~80 px thumbnails; two products have none (PU 102,
IV 679); 16 codes are shared by two items (shown as Version A / B; CL 3036 has A/B/C); the GEORGIAN page has placeholder text. See
`blueprint/00-brief/04-assumptions-open-questions.md` A15–A17.
