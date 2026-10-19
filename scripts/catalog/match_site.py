"""Match eurobrass.in product photos (file names carry the code and description) to the catalogue rows.
Usage: python -I match_site.py <all-images.txt> <rows.json> <matches.json>"""
import json, re, sys
from difflib import SequenceMatcher

urls = [u.strip() for u in open(sys.argv[1], encoding='utf-8') if u.strip()]
rows = json.load(open(sys.argv[2], encoding='utf-8'))
NAME = re.compile(r'^([A-Z]{2,5})[-_ ]?0*(\d{2,5})([A-Z]?)[-_ ](.+?)(?:_A3A\d+)?(?:-copy)?(?:-\d+)?\.(?:jpe?g|png|webp)$', re.I)

site = []
for u in urls:
    base = u.rsplit('/', 1)[-1]
    m = NAME.match(base)
    if not m:
        continue
    site.append({'url': u if u.startswith('http') else 'https://eurobrass.in/' + u, 'prefix': m.group(1).upper(), 'num': int(m.group(2)),
                 'desc': re.sub(r'[-_]+', ' ', m.group(4)).lower()})

def words(s):
    return set(re.findall(r'[a-z0-9]+', s.lower())) - {'single', 'lever', 'with', 'the', 'and', 'a'}

def score(a, b):
    wa, wb = words(a), words(b)
    j = len(wa & wb) / max(1, len(wa | wb))
    return 0.6 * j + 0.4 * SequenceMatcher(None, a.lower(), b.lower()).ratio()

matches, used = {}, set()
for r in rows:
    code = r['specs']['Code']
    m = re.match(r'^([A-Z]+)\s?(\d+)', code)
    if not m:
        continue
    prefix, num = m.group(1), int(m.group(2))
    plain = r['name'].split(' ', 1)[1] if r['specs'].get('Series') and ' ' in r['name'] else r['name']
    cands = [s for s in site if s['prefix'] == prefix and s['num'] == num]
    exact = True
    if not cands:  # the catalogue sometimes prints a shortened number (PU 780 ↔ PU7809)
        cands = [s for s in site if s['prefix'] == prefix and str(s['num']).startswith(str(num)) and len(str(s['num'])) == len(str(num)) + 1]
        exact = False
    if not cands:
        continue
    best = max(cands, key=lambda s: score(plain, s['desc']))
    sc = score(plain, best['desc'])
    if (exact and (len(cands) == 1 or sc > 0.3)) or (not exact and sc > 0.55):
        matches[r['sku']] = {'url': best['url'], 'site_desc': best['desc'], 'name': plain, 'score': round(sc, 2), 'exact': exact}
        used.add(best['url'])

json.dump(matches, open(sys.argv[3], 'w', encoding='utf-8'), indent=1)
print(len(site), 'site photos;', len(matches), 'catalogue products matched;', len(site) - len(used), 'site photos unused')
weak = [(k, v['name'], v['site_desc'], v['score']) for k, v in matches.items() if v['score'] < 0.45]
print('weakest matches:'); [print(' ', w) for w in sorted(weak, key=lambda x: x[3])[:25]]
print('unused site photos:', [s['url'].rsplit('/', 1)[-1] for s in site if s['url'] not in used][:30])
