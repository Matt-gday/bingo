"""Prepares the game's artwork for the phone: trims the empty edges of each prize picture and badge, shrinks them,
and saves them as small WebP files in public/art/. Run it again whenever you add or change artwork in Images/.
Usage: python tools/make-art.py
"""
import json, os
from PIL import Image

def prepare(src, dst, size):
    image = Image.open(src).convert('RGBA')
    box = image.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox()  # where the picture really is
    if box:
        image = image.crop(box)
    image.thumbnail((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    image.save(dst, 'WEBP', quality=86, method=6)
    return os.path.getsize(dst)

prizes = json.load(open('Data/prizes.json', encoding='utf8'))['prizes']
sets = json.load(open('Data/sets.json', encoding='utf8'))['sets']
total = 0
made = 0
missing = []
for p in prizes:
    src = p['image']
    if not os.path.exists(src):
        missing.append(p['id'])
        continue
    total += prepare(src, f"public/art/prizes/{p['id']}.webp", 360)
    made += 1
for s in sets:
    src = s['badge']
    if os.path.exists(src):
        total += prepare(src, f"public/art/badges/{s['id']}.webp", 200)
        made += 1
    else:
        missing.append(s['id'] + ' (badge)')
for name in ('gem',):
    src = f'Images/icons/{name}.png'
    if os.path.exists(src):
        total += prepare(src, f'public/art/{name}.webp', 96)
print(f'{made} pictures, {total // 1024} KB in all')
print('No picture yet for:', ', '.join(missing) if missing else 'nothing')
