"""products.json (from extract.py) -> import rows for import_products(): sku, name, category, fitting_type,
description, specs, image, published. Usage: python -I build_rows.py <products.json> <rows.json>"""
import json, re, sys
from collections import Counter

P = json.load(open(sys.argv[1], encoding='utf-8'))

SERIES_BLURB = {
    'Pure': 'Minimal yet understated modern luxury: contemporary, well-defined straight lines that blend in with any interior style.',
    'Studio': 'Serene and soothing — visual interest and a calming effect without adding clutter to the modern bath or powder room.',
    'Ivy': 'An innovative, modern design for the dynamic, urban lifestyle of today’s millennials.',
    'Sigma': 'A combination of classic and contemporary luxury: chic design and a feather-touch look that blends into any interior.',
    'Time': 'A marriage between classic and modern — modern flows and well-defined mixed lines that fit any interior style.',
    'Aztech': 'West meets East, balancing both aspects beautifully.',
    'Mode': 'Creating a third dimension with modern luxury — a true case of more than meets the eye.',
    'Dune': 'A mix of fine lines and well-defined curves that creates its own special space.',
    'Smart': 'Longer spouts and levers for unmatched comfort, with a finish and detail that stand out.',
    'Neo': 'Back to the modern classic era: the right moulded curves give a solid, functional yet classic look.',
    'Alpha': 'Solid construction with a fine and delicate finish — craftsmanship built for durability.',
    'Classic': 'A modern take on classic design, with a modern twist and a forward stance.',
    'Lite': 'Developed for unmatched functionality, blending in and pairing with other modern faucets.',
}
SENSOR = 'EUROTECH sensor taps let water out automatically when they detect movement — no hand contact, a more hygienic washroom, and up to 70% less water wasted.'

def classify(prefix, name):
    n = name.lower()
    if prefix in ('EBSEN', 'EBNCT') or 'sensor' in n: return 'sensor-taps', 'basin_mixer'
    if prefix == 'EBA' or re.search(r'towe?l|robe|hook|holder|grab rail|soap|rack|dispenser|tumbler|shelf|paper', n): return 'accessories', None
    if 'wall mixer' in n or 'shower mixer' in n: return 'wall-mixers', 'shower_mixer'
    if 'angle cock' in n: return 'valves', 'angle_valve'
    if prefix == 'EB' or prefix == 'D' or 'rain shower' in n or 'hand shower' in n or 'shower set' in n or 'slider' in n:
        return 'showers', 'shower_head'
    if 'health faucet' in n: return 'showers', 'health_faucet'
    if 'diverter' in n: return 'diverters', 'diverter'
    if 'stopcock' in n or 'stop cock' in n: return 'valves', None
    if 'valve' in n: return 'valves', 'angle_valve'
    if 'sink' in n: return 'sink-mixers', None
    if 'bib cock' in n or 'bibcock' in n: return 'bib-cocks', None
    if 'pillar' in n: return 'pillar-taps', 'basin_mixer'
    if n.startswith('spout') or 'bath spout' in n or ('spout' in n and 'swan' not in n and 'basin' not in n): return 'spouts', 'spout'
    if 'wall mixer' in n or 'shower mixer' in n or 'concealed' in n and 'basin' not in n: return 'wall-mixers', 'shower_mixer'
    if 'basin' in n or 'one hole' in n or 'centre hole' in n or 'central hole' in n: return 'basin-mixers', 'basin_mixer'
    return None, None

rows, skus, unknown = [], Counter(), []
for p in P:
    name = re.split(r'\s+(?:EUROTECH|Eurobrass)\b', p['name'])[0].strip()   # drop a paragraph that bled in
    name = re.sub(r'\bmixture\b', 'mixer', name)                         # catalogue typo, consistently
    name = name[0].upper() + name[1:] if name else name
    cat, ft = classify(p['prefix'], name)
    if not cat:
        unknown.append((p['code'], name)); cat = 'accessories'
    base = re.sub(r'[^A-Z0-9]+', '-', p['code'].upper()).strip('-')
    skus[base] += 1
    sku = base if skus[base] == 1 else f'{base}-{chr(64 + skus[base])}'   # same code, different item → -B, -C
    series = p['series'] if p['series'] and p['series'] != 'Medicare' else ('Eurotech' if cat == 'sensor-taps' else None)
    title = f'{series} {name[0].lower() + name[1:]}' if series and series not in ('Eurotech',) else name
    desc = SERIES_BLURB.get(series) or (SENSOR if cat == 'sensor-taps' else None)
    specs = {'Code': p['code'], **({'Series': series} if series else {}), 'Catalogue page': str(p['page'])}
    if skus[base] > 1: specs['Note'] = 'This code is shared by more than one item in the catalogue'
    rows.append({'sku': sku, 'name': title, 'category': cat, 'fitting_type': ft or '', 'description': desc or '',
                 'specs': specs, 'image': f'catalog/{sku.lower()}.jpg' if p['image'] else '', 'src_image': p['image'], 'published': True})

json.dump(rows, open(sys.argv[2], 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(rows), 'rows')
print(Counter(r['category'] for r in rows))
print(Counter(r['fitting_type'] or '-' for r in rows))
print('unclassified', unknown)
print('dup-code SKUs', [r['sku'] for r in rows if r['sku'][-2] == '-' and r['sku'][-1] in 'BCD'])
for r in rows[:4] + rows[-3:]: print(r['sku'], '|', r['name'], '|', r['category'], r['fitting_type'])
