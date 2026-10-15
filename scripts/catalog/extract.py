"""Pull every product (code, name, page, series, photo) out of the Eurobrass catalogue PDF.
Usage: python -I extract.py <pylib> <catalog.pdf> <outdir>"""
import json, re, sys
sys.path.insert(0, sys.argv[1])
import pymupdf

DIG = str.maketrans('ȉȦȶȴȏȍȰȮȁȟ', '0123456789')
CODE = re.compile(r'^([A-Z]{1,5})\s?([A-Z]{0,2}\d{2,5}[A-Z]{0,3})$')
src, out = sys.argv[2], sys.argv[3]
doc = pymupdf.open(src)
products, seen = [], set()

for pno, page in enumerate(doc):
    d = page.get_text('dict')
    lines = []  # (bbox, text)
    for b in d['blocks']:
        if b.get('type') != 0:
            continue
        for l in b['lines']:
            txt = ''.join(s['text'] for s in l['spans']).translate(DIG).strip()
            if txt:
                lines.append((pymupdf.Rect(l['bbox']), txt))
    header = ' '.join(t for _, t in lines)
    series = next((m.group(1).title() for m in [re.search(r'\b([A-Z]{3,12}) SERIES\b', header)] if m), None)
    imgs = [pymupdf.Rect(i['bbox']) for i in page.get_image_info() if i['bbox'][2] - i['bbox'][0] < page.rect.width * 0.4]
    for idx, (r, t) in enumerate(lines):
        m = CODE.match(t)
        if not m:
            continue
        if m.group(1) == 'P' and m.group(2).isdigit():
            continue  # page numbers (P13)
        code = f'{m.group(1)} {m.group(2)}'.replace('  ', ' ')
        # description: the lines just below the code, in the same column
        desc = []
        for r2, t2 in lines[idx + 1:idx + 5]:
            if CODE.match(t2) or abs(r2.x0 - r.x0) > 6 or r2.y0 - r.y1 > 30 or t2.isupper():
                break
            desc.append(t2)
            r = pymupdf.Rect(r.x0, r.y0, max(r.x1, r2.x1), r2.y1)
        name = ' '.join(desc).strip()
        # the photo: the nearest image above, overlapping the code's column
        best, best_gap = None, 1e9
        code_r = lines[idx][0]
        for ir in imgs:
            overlap = min(ir.x1, code_r.x1 + 60) - max(ir.x0, code_r.x0 - 10)
            gap = code_r.y0 - ir.y1
            if overlap > 10 and -5 < gap < 90 and gap < best_gap:
                best, best_gap = ir, gap
        key = (code, name)
        if key in seen:
            continue
        seen.add(key)
        fname = None
        if best is not None:
            fname = re.sub(r'[^a-z0-9]+', '-', code.lower()).strip('-') + f'-p{pno + 1}.jpg'
            pix = page.get_pixmap(clip=best, dpi=220)
            pix.save(f'{out}/img/{fname}', jpg_quality=85)
        products.append({'code': code, 'prefix': m.group(1), 'name': name, 'page': pno + 1, 'series': series, 'image': fname})

json.dump(products, open(f'{out}/products.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(products), 'products;', sum(1 for p in products if p['image']), 'with a photo')
