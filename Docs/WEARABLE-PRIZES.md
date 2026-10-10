# Wearable prize artwork brief

The 20 wearable prizes are things the player can wear on their avatar once they own them. Each prize is **one colourway of an item** that the avatars already wear in the game (drawn live in 3D). The prize picture shown on the prize table and in the cabinet should look like the **same item, in the same colour and shape**, so a prize and the thing on the head clearly match.

Until a picture exists, the game shows the real 3D item on a head instead, so nothing is blocked. When a picture is ready, save it as `Images/prizes/prize-<id>.png` (the file name is in the table below), then run `python tools/make-art.py` and the game picks it up.

A reference sheet showing every wearable on an avatar is in `wearables-sheet-standalone.html` (open it in a browser). It lists each one's name, colour and hex code.

## Look and feel

Exactly the same as the other prize art (see `IMAGE-BRIEF.md`, sections 3 and 4):

- Cute 3D toy-style render, soft rounded chunky shapes, smooth glossy surface, gentle studio light from the **upper left** with a soft highlight on the upper left.
- Transparent background, one item only, whole item visible, 1024 x 1024.
- Three-quarter view from the front and slightly above, as if the item is floating by itself, in the position it would sit on a head. No head, no face, no stand, no shadow.
- Soft and fuzzy for the knitted items (beanie, scarf); smooth and glossy for everything else; a polished gold look for the crown.
- Bright, clean, saturated colours. Use the exact hex colours below for the main colour of each item.

## Keep these things the same as the 3D item

The 3D items are simple. The pictures can be richer and more detailed, but each must keep the item's **silhouette, proportions and colours**.

| Item | Shape to match |
|---|---|
| Party hat | A tall cone with a pointed tip, a thin white ring around the base and a small white pompom on the tip. Slightly tilted. |
| Woolly beanie | A soft dome with a thick folded-up white cuff around the bottom and a white pompom on top. Knitted. |
| Baseball cap | A rounded dome crown with a **wide, curved peak** (visor) at the front, wider than the dome, and a small white button on top. |
| Top hat | A tall straight cylinder with a wide flat brim and a thin yellow band around the bottom of the crown. |
| Golden crown | A band with five pointed spikes around it and one pink-red gem on the front. Polished gold. |
| Headband with a bow | A thin arched band that goes over the top of the head from ear to ear, with a medium bow sitting on top of it, towards one side. |
| Round glasses | Two round thin-framed lenses joined by a short bridge. Clear lenses with a gentle shine. |
| Cool shades | Two dark, rounded, slightly squashed lenses joined by a bar, in a glossy frame. |
| Heart glasses | Two solid glossy heart-shaped lenses joined by a short bridge. |
| Bow tie | A classic bow tie: two puffed wings and a round knot in the middle. |
| Long tie | A small round knot with a long hanging blade: thin under the knot, widening, ending in a point at the bottom. |
| Cosy scarf | A thick, soft, knitted loop with one short tail hanging down at the front. |

## The 20 prizes

| File name | Prize | Item | Main colour |
|---|---|---|---|
| `prize-wear-party-hat-pink.png` | Pink party hat | Party hat | Pink `#FF8FCB` |
| `prize-wear-party-hat-yellow.png` | Yellow party hat | Party hat | Yellow `#FFD84A` |
| `prize-wear-beanie-aqua.png` | Aqua woolly beanie | Woolly beanie | Aqua `#2EE6D6` |
| `prize-wear-cap-blue.png` | Blue baseball cap | Baseball cap | Blue `#2E7CF6` |
| `prize-wear-cap-coral.png` | Coral baseball cap | Baseball cap | Coral `#FF8A80` |
| `prize-wear-top-hat-midnight.png` | Midnight top hat | Top hat | Midnight navy `#2B1B6B` (yellow band `#FFD84A`) |
| `prize-wear-crown-golden.png` | Golden crown | Golden crown | Gold `#FFD84A` (gem `#FF3D7F`) |
| `prize-wear-headband-pink.png` | Pink headband with a bow | Headband with a bow | Pink `#FF8FCB` |
| `prize-wear-headband-purple.png` | Purple headband with a bow | Headband with a bow | Purple `#7B4CF0` |
| `prize-wear-round-glasses-pink.png` | Pink round glasses | Round glasses | Pink `#FF8FCB` |
| `prize-wear-sunglasses-magenta.png` | Magenta cool shades | Cool shades | Magenta `#C92A86` |
| `prize-wear-sunglasses-blue.png` | Blue cool shades | Cool shades | Blue `#2E7CF6` |
| `prize-wear-heart-glasses-red.png` | Red heart glasses | Heart glasses | Red `#FF3D7F` |
| `prize-wear-heart-glasses-purple.png` | Purple heart glasses | Heart glasses | Purple `#7B4CF0` |
| `prize-wear-bow-pink.png` | Pink bow tie | Bow tie | Pink `#FF8FCB` |
| `prize-wear-bow-aqua.png` | Aqua bow tie | Bow tie | Aqua `#2EE6D6` |
| `prize-wear-tie-magenta.png` | Magenta long tie | Long tie | Magenta `#C92A86` |
| `prize-wear-tie-blue.png` | Blue long tie | Long tie | Blue `#2E7CF6` |
| `prize-wear-scarf-coral.png` | Coral cosy scarf | Cosy scarf | Coral `#FF8A80` |
| `prize-wear-scarf-purple.png` | Purple cosy scarf | Cosy scarf | Purple `#7B4CF0` |

The three free starter items, which every player has from the start and which are **not** prizes, are the purple bow tie, the navy round glasses and the coral woolly beanie. They need no prize picture.

## A prompt to start from

> A cute 3D toy-style render of a **[item and colour, for example: pink party hat: a tall cone with a pointed tip, a thin white ring around the base and a small white pompom on the tip]**, floating on its own, seen from the front and slightly above at a three-quarter angle. Soft rounded chunky shapes, smooth glossy surface, gentle studio lighting from the upper left with a soft highlight on the upper left. Bright clean saturated colour **[hex colour]**. Transparent background, the whole item visible, no head, no face, no stand, no shadow. Square image, 1024 x 1024.

## Adding more wearables later

A new wearable needs three things: a shape entry in `Data/avatar.json` (it is built from simple shapes, so no code), a prize entry in `Data/prizes.json` with a `wearable` field naming the item and one of its colours, and a picture. The set totals and targets are recounted by `python tools/rescale-prices.py 1` (or `tools/make-wearables.py` for a fresh set of wearables).
