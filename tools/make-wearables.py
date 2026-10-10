"""Adds the wearable prizes to Data/prizes.json and the Dress-up set to Data/sets.json.

Run this once (it is safe to run again: it removes and re-adds the wearables). Each wearable is one colourway of an
avatar item from Data/avatar.json. The first colour of the three starter items (see 'starterItems' in avatar.json)
is free to every player, so it is not a prize.
"""
import json

prizes_path = 'Data/prizes.json'
sets_path = 'Data/sets.json'
avatar = json.load(open('Data/avatar.json', encoding='utf8'))
data = json.load(open(prizes_path, encoding='utf8'))
sets = json.load(open(sets_path, encoding='utf8'))

# item id, colour hex, colour name, extra tags, price
WEARABLES = [
    ('party-hat', '#FF8FCB', 'Pink', ['pink'], 60),
    ('party-hat', '#FFD84A', 'Yellow', [], 60),
    ('beanie', '#2EE6D6', 'Aqua', ['fluffy'], 50),
    ('cap', '#2E7CF6', 'Blue', [], 50),
    ('cap', '#FF8A80', 'Coral', [], 50),
    ('top-hat', '#2B1B6B', 'Midnight', [], 80),
    ('crown', '#FFD84A', 'Golden', ['sparkly'], 120),
    ('headband', '#FF8FCB', 'Pink', ['pink'], 40),
    ('headband', '#7B4CF0', 'Purple', ['purple'], 40),
    ('round-glasses', '#FF8FCB', 'Pink', ['mini'], 40),
    ('sunglasses', '#C92A86', 'Magenta', [], 70),
    ('sunglasses', '#2E7CF6', 'Blue', [], 70),
    ('heart-glasses', '#FF3D7F', 'Red', ['sparkly'], 80),
    ('heart-glasses', '#7B4CF0', 'Purple', ['purple'], 80),
    ('bow', '#FF8FCB', 'Pink', ['mini'], 30),
    ('bow', '#2EE6D6', 'Aqua', ['aqua'], 30),
    ('tie', '#C92A86', 'Magenta', [], 40),
    ('tie', '#2E7CF6', 'Blue', [], 40),
    ('scarf', '#FF8A80', 'Coral', ['fluffy'], 60),
    ('scarf', '#7B4CF0', 'Purple', ['purple'], 60),
]

names = {i['id']: i['name'] for i in avatar['items']}
data['prizes'] = [p for p in data['prizes'] if 'wearable' not in p]
for item, colour, colour_name, extra, price in WEARABLES:
    pid = f"wear-{item}-{colour_name.lower()}"
    label = f"{colour_name} {names[item].lower()}"
    label = label[0].upper() + label[1:]
    data['prizes'].append({
        'id': pid,
        'name': label,
        'image': f"Images/prizes/prize-{pid}.png",
        'tags': ['dress-up'] + extra,
        'price': price,
        'size': 'small',
        'room': 'bedroom',
        'wearable': {'item': item, 'colour': colour},
    })
data['note'] = ("Prizes. Prices are placeholders to tune. Add a prize by adding an entry here and an image in Images/prizes. "
                "A prize with a 'wearable' entry (an item id from Data/avatar.json and one of its colours) can be worn on the "
                "avatar once it is owned.")
json.dump(data, open(prizes_path, 'w', encoding='utf8'), indent=2, ensure_ascii=False)

# every set: recount from the prizes
by_tag = {}
for p in data['prizes']:
    for t in p['tags']:
        by_tag.setdefault(t, []).append(p)
sets['sets'] = [s for s in sets['sets'] if s['id'] != 'dress-up']
sets['sets'].append({
    'id': 'dress-up', 'name': 'Dress-up', 'family': 'thing',
    'badge': 'Images/badges/badge-dress-up.png', 'prizeCount': 0, 'totalValue': 0, 'target': 0,
})
for s in sets['sets']:
    prizes = by_tag.get(s['id'], [])
    s['prizeCount'] = len(prizes)
    s['totalValue'] = sum(p['price'] for p in prizes)
    s['target'] = int(round(s['totalValue'] * sets['targetShare'] / 10.0) * 10)
json.dump(sets, open(sets_path, 'w', encoding='utf8'), indent=2, ensure_ascii=False)

# the free starter wardrobe
avatar['starterItems'] = [
    {'item': 'bow', 'colour': '#7B4CF0'},
    {'item': 'round-glasses', 'colour': '#2B1B6B'},
    {'item': 'beanie', 'colour': '#FF8A80'},
]
avatar['note'] += " starterItems are the colourways every player owns from the start; every other colourway is a prize."
json.dump(avatar, open('Data/avatar.json', 'w', encoding='utf8'), indent=2, ensure_ascii=False)

print(len(data['prizes']), 'prizes;', len(sets['sets']), 'sets')
for s in sets['sets']:
    print(f"  {s['id']:14} {s['prizeCount']:2} prizes  value {s['totalValue']:4}  target {s['target']}")
