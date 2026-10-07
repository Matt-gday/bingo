# Bingo App

A cute single-player bingo game for phones. The player competes against computer-controlled regulars at a friendly bingo club, shouts "BINGO!" into the microphone to win, and spends the credits they earn on collectable prizes.

The working title is **Solo Bingo**. The final name is not chosen yet. Read the name from `Data/config.json` wherever it appears so it can be changed in one place.

## Who this is for

Matt designed this game with Claude and will direct the build. He will play it with his family, including a 12-year-old who loves collecting things, drawing and making. It needs to be fun and friendly for her and still interesting for an adult.

Matt is a designer, not a professional programmer. Explain what you are doing in plain language, work in small steps, and ask him to test on his phone often.

## Read these before writing any code

1. `Docs/BUILD-BRIEF.md` holds every rule of the game and the order to build it in. It is the source of truth for how the game behaves.
2. `Docs/SCREENS.md` describes each of the 26 designed screens and how they connect.
3. `Data/*.json` holds the game's content and every tunable number.

## What is in this folder

| Folder or file | What it holds |
|---|---|
| `CLAUDE.md` | This file. |
| `Docs/` | The build brief and the screen guide. |
| `Data/` | Prizes, sets, regulars, patterns, caller lines and settings, as JSON. |
| `Design/screens/` | A PNG of every final screen, numbered in play order. These are the source of truth for how the game looks. |
| `Design/html/` | The same screens as HTML files with inline styles. Open them to read exact colours, sizes, spacing and fonts. They are static pictures of a single moment, not working code, so do not reuse their structure. |
| `Images/` | Artwork made for the game, in the subfolders `prizes`, `characters`, `badges`, `scenes`, `logo` and `icons`. Some may still be in progress. Ignore `Images/_drafts` and the report and prompt files in that folder; they are the image generator's working notes. |
| `IMAGE-BRIEF.md`, `AGENTS.md`, `art-batch.json` and the `.py` files at the top level | Instructions and tools belonging to the image generator. They are not part of the game. Leave them alone and do not build on them. `IMAGE-BRIEF.md` is useful to read, because it lists every image and its file name. |
| `Mockups/` | Reference images kept for the image generator. Ignore this folder and use `Design/screens/`. |

## How to work

- **Build in the phases listed in the brief.** Each phase ends with something Matt can play. Stop and ask him to test before starting the next phase.
- **Do not invent rules.** If the brief does not cover something, ask Matt. The rules were worked out carefully and several are unusual on purpose.
- **Never automate the player's bingo.** Nothing is marked for the player, nothing is highlighted on their cards, and the app never tells them they have a winning pattern. This is the heart of the game.
- **Keep content and numbers in `Data/`.** Adding a prize, a set, a pattern or a regular must be possible by editing JSON and adding an image, with no code changes. Do not hard-code prices, timings or payouts.
- **Match the design.** Use `Design/screens/` and `Design/html/` for layout, colour and type. The numbers shown in the mockups are placeholders and do not always agree with each other or with `Data/`. When they differ, `Data/` wins.
- **No secrets in code.** The game needs no accounts, server or API keys. If an optional online feature is added later, a key must never be placed in the code or the repository.
- **Commit often**, with plain messages that say what changed.

## Technical shape

- An installable web app (a PWA) that runs in a phone browser and can be added to the home screen, like Matt's other apps. It will be hosted as a static site, for example on GitHub Pages.
- No backend. All progress is saved on the device.
- It should keep working offline once installed.
- The microphone needs a secure (HTTPS) page and the player's permission.
- Designed at 390 x 844. It must adapt to other phone sizes; see "Layout" in the brief.
- Choose the simplest tools that do the job and explain the choice to Matt before starting. Avoid heavy frameworks unless they earn their place.

## First step

Read the three items above, then give Matt a short summary of your plan for Phase 1 and any questions you have. Do not start building until he agrees.
