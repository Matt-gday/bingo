"""One-off: multiplies every prize price by a factor (rounded to 5) and recounts the sets' totals and targets.
Usage: python tools/rescale-prices.py 0.7"""
import json, sys
factor = float(sys.argv[1])
prizes = json.load(open('Data/prizes.json', encoding='utf8'))
sets = json.load(open('Data/sets.json', encoding='utf8'))
for p in prizes['prizes']:
    p['price'] = max(20, int(round(p['price'] * factor / 5.0) * 5))
for s in sets['sets']:
    ps = [p for p in prizes['prizes'] if s['id'] in p['tags']]
    s['prizeCount'] = len(ps)
    s['totalValue'] = sum(p['price'] for p in ps)
    s['target'] = int(round(s['totalValue'] * sets['targetShare'] / 10.0) * 10)
json.dump(prizes, open('Data/prizes.json', 'w', encoding='utf8'), indent=2, ensure_ascii=False)
json.dump(sets, open('Data/sets.json', 'w', encoding='utf8'), indent=2, ensure_ascii=False)
print('prices x', factor)
for s in sets['sets']:
    print(f"  {s['id']:14} {s['prizeCount']:2} prizes  value {s['totalValue']:4}  target {s['target']}")
