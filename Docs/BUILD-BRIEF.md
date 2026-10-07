# Build brief

This document describes how the game works and the order to build it in. Screen layouts are in `SCREENS.md` and `Design/`. Content and numbers are in `Data/`. Every number mentioned here is a placeholder that lives in `Data/config.json` or another data file.

## 1. The game in one page

The player sits down at a bingo club with three computer-controlled regulars. A caller, who is a friendly bingo-ball character, calls numbers one at a time. The player holds two bingo cards and marks them by hand. When they think they have the winning pattern they tap a button and shout "BINGO!" into the phone. The caller checks their card number by number. If it is right they win credits. If it is wrong they sit out two calls.

A night can have up to three stages on the same cards: a line, then two lines, then a full house. After the night, everyone takes their credits to the prize table, where the player races the regulars to buy collectable prizes. Prizes belong to sets, and finishing a set earns a badge.

Three ideas make the game what it is. Protect them.

- **No automation.** The player does all their own marking and decides for themselves when to shout. They can miss numbers and mark wrong ones.
- **Every call is a choice.** With two cards and only one mark per call, the player keeps deciding which card to back.
- **The regulars are characters.** They have faces, moods, habits and things they want, and the player learns to read them.

## 2. Cards and calling

- 75-ball bingo on 5 x 5 cards. Column B holds 1 to 15, I holds 16 to 30, N holds 31 to 45, G holds 46 to 60 and O holds 61 to 75. The centre square is free and always counts as marked.
- The player has **two cards**. Deal them so they share several numbers (about seven), because shared numbers are what create the choice.
- The caller draws numbers at random without repeats.
- Each call has a **timer ring** around the called number. It empties clockwise. When it runs out, the next number is called.
- Three speeds set the length of the ring and multiply the credits earned: Relaxed, Steady and Quick. On Quick the caller drops the nicknames and just says the number, so it truly feels fast.
- The screen shows the current number and the last four numbers called. Nothing else about past calls is shown, so paying attention matters. (A setting for how many past calls to show could come later.)

## 3. Marking

- **One mark per call.** During a call the player may place one mark on either card.
- **The mark can go anywhere.** Usually it goes on the number just called. It can also go on a number called earlier that the player skipped, which is how they catch up. Nothing stops the player marking a number that has not been called. That is a mistake they will pay for later.
- **The mark is movable until it locks.** The mark for the current call is shown in aqua with a darker outline. While the ring is running the player can tap it again to remove it, or tap another square on either card to move it there.
- **When the ring runs out the mark locks.** It turns purple like the others and can never be changed. If no mark was placed, that call's mark is lost. A brief lock moment shows a padlock in the ball and the caller says "Marks locked!" before the next number appears.
- **Each number can only be used once.** If a number is on both cards, a mark on one card is the only valid mark for that number. The app does not prevent a second mark on the other card. It is simply invalid when the card is checked.
- **Nothing is highlighted or checked while playing.** A wrong mark looks exactly like a right one.

Internally, record each locked mark with its card, its square, its number and the call it was made on. Keep a single "pending mark" slot for the current call. Do no validation until a card is checked.

## 4. Shouting bingo

- The player taps **Call bingo** whenever they believe they hold the current pattern. This opens the shout screen and turns the microphone on. The microphone is never on at any other time.
- The game detects **loudness only**. It does not need to recognise the word. Any sound above the player's calibrated level counts.
- The shout must come **before the next number is called**. The ring keeps running during the shout screen.
- There is always a way to claim without shouting: a **hold to call** button on the shout screen, and a setting that makes hold-to-call the default. Use hold-to-call automatically if microphone permission is refused.
- A **Back to my cards** button lets the player change their mind at no cost.
- The loudness level is set on the "Test your shout" screen, shown the first time and reachable from Settings.

## 5. Checking a card

When a claim is made, the game pauses and the caller checks the card.

- Find the completed pattern the player is claiming. If more than one candidate exists, a claim wins if **any** complete candidate is fully valid. If no complete pattern exists on either card, it is a false call straight away ("I can't see a line there").
- A mark is **valid** if its number has been called and it was the first mark made for that number.
- Reveal the numbers of the pattern **one at a time in random order**. A valid number gets a green tick. The caller reads each one aloud.
- The wait before each reveal grows a little each time. If four are ticked and one remains, the last reveal is slow and dramatic, like the final slow-motion moment in Peggle: dim everything else, enlarge the last number, build the sound, then cut to silence before the result.
- **Stop at the first invalid number.** It gets an X, the remaining numbers are left unchecked, and the caller says why: the number was not called, or it was already used on the other card. A failure can come on the very first reveal.

## 6. False calls

- The player **sits out the next two calls**. They cannot mark during them.
- **The game restarts the moment the X appears.** The next number is already running behind the false call screen, shown as a small live ball with its ring. The player has to tap "Back to my cards" quickly to see the numbers they are missing, because they can catch those up later with spare marks.
- On the cards screen during a sit-out, the cards are visible but faded and cannot be tapped, and a banner counts down the calls remaining.
- Each false call also takes a quarter off the credits the player earns that night.
- Shouting for a pattern that is not the current stage is a false call.
- Regulars can make false calls too. They are told off by the caller and sit out in the same way.

## 7. Stages and the length of a night

At the start the player chooses how long the night is:

| Choice | Stages |
|---|---|
| Just a line | One line |
| A line, then two lines | One line, then two lines |
| The full night | One line, then two lines, then full house |

- **One line** is any complete row, column or diagonal on one card.
- **Two lines** is any two complete lines on the same card.
- **Full house** is every square on one card.
- Stages run from easiest to hardest and later stages pay more.
- All stages are played on the **same cards with the same marks**. Calling carries on from where it stopped.
- The play screen always shows the current target, for example "Stage 1 of 3: one line", with a small picture of the pattern.
- **When a stage is won**, show the "Stage won" screen: the same celebration as a full win, a note of the credits banked, then the next target with a three-second countdown ring. There is no credits breakdown and no prize table button. When the countdown ends, return to the cards. If a regular won the stage, show the same screen with their face and no credits for the player.
- **A pattern completed early can be claimed the moment its stage opens.** If the player already holds two lines when that stage begins, they can shout immediately. This creates a race to shout first.
- **After the final stage**, show the end-of-night results with one row per stage, who won it and what it paid. Only this screen leads on to the prize table.
- Patterns are defined in `Data/patterns.json`. Other shapes such as four corners, a postage stamp or a heart are listed there for later use as a "pattern of the night". Larger or rarer patterns pay more.

## 8. Pausing

- One pause per game.
- The pause screen **covers everything**: cards, called number and recent calls. Pausing must never give extra thinking time.
- On resume there is a 3, 2, 1 countdown with the screen still covered, then the ring continues from exactly where it stopped.
- The game pauses itself with the same cover if the player switches apps or a call comes in. This automatic pause does not use up the player's one pause.
- Pausing is not available during a shout or a card check.

## 9. The regulars

- There is a pool of five regulars in `Data/regulars.json`. **Three sit at the table each night.**
- Each has a face colour, a personality, a chance of missing a mark, a chance of making a false call, a shopping style and a list of sets they collect.
- **Their bingo is simulated.** Give each regular their own cards and have them mark called numbers with a small chance of missing one. Show how many squares each still needs for the current pattern ("2 to go"), and highlight anyone who gets down to one. When a regular completes the pattern they shout after a short reaction delay, so the player can sometimes beat them to it.
- **Faces are drawn in code**, as a coloured circle with eyes and a mouth. They change expression with what is happening: content, smug when close, shocked when someone else shouts, sulky when they lose a prize, cheering when they win. The player should be able to read the table at a glance.
- **There is no fixed rival.** For each player profile, the rival is whichever regular is competing hardest for the same sets. It can change over time.
- **Absences and ring-ins.** On about one night in five, one regular is away for a stated reason and a ring-in takes the seat for that night only. A ring-in has a name, some credits and one prize they want, with a reason ("Needs the meat tray for a party on Saturday"). Prefer a prize that belongs to a set the player is working on. A ring-in keeps no history.

## 10. Credits

- Credits are **earned only**. They can never be bought.
- Winning a stage pays that pattern's payout.
- **Consolation.** Everyone earns a small amount for playing. When a regular wins a stage, the player earns a share of its payout scaled by how close they were, counting valid marks only.
- The night's total is multiplied by the speed multiplier, then reduced by a quarter for each false call.
- Regulars earn credits by the same rules, so even when the player wins, the regulars creep closer to what they want.
- Keep consolation small compared with a win, so careless play is never the best way to earn.
- The results screens show the working, one line per item.

## 11. Prizes and sets

- There are 54 prizes in `Data/prizes.json`. Each has a price, tags, a size and a room.
- Tags come from three families: **what it is** (Art & Craft, Stationery, Music, Sport, Soft Toys, Food, Home, Garden, Tools), **its colour** (Pink, Purple, Aqua, Rainbow) and **its feel** (Fluffy, Sparkly, Mini, Animals). Each tag is a set, giving 17 sets in `Data/sets.json`.
- A prize counts its **full price toward every set it belongs to**. Prizes with three or four tags are the most contested.
- **A set is finished when the prices of the prizes you own with that tag reach the set's target.** Targets are about 60 percent of the set's total value, so a set can never become impossible.
- **One of each prize per player.** The player and each regular can own a given prize once.
- **Prizes come back.** When someone buys a prize it leaves the table and returns to the pool, and can appear again on a later night. Nothing is lost for good.
- **Gold and silver.** The first to finish a set, among the player and the regulars, earns a gold badge. Anyone finishing it later earns silver. Show this as a gold or silver glow that follows the shape of the badge art. Each finished set adds to the player's street cred.
- The `size` and `room` fields are not used yet. They are there for the room-decorating feature described in section 17.

## 12. The prize round

The prize round follows every night. It has a calm part and a timed part.

1. **Results.** No time pressure.
2. **Who wants what.** No time pressure. One card per player shows their face, credits and the set they are closest to finishing. Tapping a card opens that player's cabinet, which lists everything they own, every set they are working on and every set they have finished. The player can see the prizes left on the table from last time, but new arrivals stay covered.
3. **Open the prize table.** The timed part begins.
4. **I'm done.** The player ends their visit. The table cannot be reopened until after their next night.
5. **Table closed.** A summary of what everyone bought and what remains for next time.

Rules for the table:

- The table has six slots. Unsold prizes stay on the table between nights.
- The player may buy **anything they can afford**, and as many prizes as their credits allow.
- **Regulars shop at the same time.** When a regular decides to buy something, their face appears on that prize's tile inside a countdown ring. When the ring closes they buy it. If the player buys it first, the regular's ring disappears, their face reacts, and after a moment they pick something else they can afford or leave.
- **Ring speed shows character.** Each regular has their own range of ring times. A ring runs faster if the prize would finish one of their sets. Rings also follow the night's speed setting, so Relaxed shopping is gentle.
- Two regulars can eye the same prize, each with their own ring. A ring turns magenta when it is nearly out.
- Regulars only eye prizes they can afford and do not already own. They arrive a few seconds apart, not all at once.
- **When a prize sells**, its slot shows "Sold to Rex!" for about a second, then a new prize drops in.
- The caller comments throughout in his speech bubble: hints about who wants what, reactions to sales, nudges about the player's own sets, and banter. He announces when each regular leaves.
- If the player stays, they can watch the regulars finish. If they leave early, the regulars finish in the background and the summary reports it. The table never closes on its own.
- From the home screen the player can peek at the table at any time, but cannot buy.

Display rules for prize art:

- Prize images have transparent backgrounds and sit directly on the tile with no frame, overlapping its top edge slightly.
- Behind each prize is a soft tinted circle. Choose a tint that **contrasts** with the prize, so a pink prize never sits on a pink circle.
- Always show the whole image, scaled to fit, never cropped. Trim empty margins automatically so every prize appears the same size.
- On a tile, show at most two tags and then "+2" for the rest. The detail screen shows them all.

## 13. The caller

- The caller is a round white bingo-ball character with a bow tie and headset. His art is in `Images/characters/` in five expressions: talking, smile, cheer, wince and no-peeking. Because he is white, always place him on a coloured background.
- **Everything he says appears in a speech bubble**, so the game is fully playable with the sound off.
- He speaks the calls aloud. Start with the device's built-in speech. Pre-recorded audio files for the 75 numbers and stock lines can replace it later for a better voice with no running cost.
- Tapping the caller mutes or unmutes his voice. There is also a switch in Settings.
- He uses traditional bingo nicknames such as "Legs eleven". These and his other lines are in `Data/caller-lines.json`, with placeholders for names, prizes and sets.
- He reacts in character: cheering a win, wincing sympathetically at a false call, eyes shut on the pause screen.

## 14. Players and saving

- Several people can play on one phone. The welcome screen asks who is playing and offers to add a new player.
- A player has a name, a face chosen from eight and a colour chosen from six.
- **Each player has a completely separate save**: credits, prizes, sets, badges, the state of the prize table, and the regulars' own credits and collections.
- Save automatically after every meaningful event. Nothing should be lost if the app is closed mid-game, though an unfinished night can simply be abandoned.
- New prizes, sets and patterns will be added over time by editing the data files. Existing saves must keep working when that happens.

## 15. Look and feel

Use `Design/screens/` for layout and `Design/html/` for exact values. In summary:

- **Mood:** bright, cute, chunky and friendly, with a little depth.
- **Typefaces:** Fredoka for headings, numbers and buttons. Nunito for small text.
- **Everyday screens** use a purple-to-pink gradient from `#5236D6` through `#7B45E6` to `#C257D9`, with large soft circles in the background.
- **Tense moments** use a dimmed version of the same gradient, from `#2C1A8A` through `#45208F` to `#7A2A96`. These are the shout, the card check, the false call and the pause.
- **Key colours:** deep purple `#2B1B6B` for text on white, purple `#6A3DF0` for locked marks, aqua `#2EE6D6` for the main action and the pending mark, magenta `#C92A86` for urgency, green `#4ADE80` for ticks.
- **Depth:** white cards and buttons have a solid darker edge underneath so they look raised and pressable.
- **Credits** are shown with an aqua gem.
- **Motion and sound:** marks pop in with a small bounce, locks land with a thud, wins burst with confetti, new prizes drop in with a bounce. Use short sounds and a light buzz on taps, each with a switch in Settings. Respect the device's reduced-motion setting.

### Layout

- The design is drawn at 390 x 844.
- The play screen is the tightest. On shorter phones, scale the two cards down to fit the height. Keep the squares as large as the screen allows, because the player taps them under time pressure.
- Keep clear of the notch and the home indicator.
- Lock the game to portrait.

## 16. Build order

Build in phases. Each phase must leave the game playable, and Matt tests it before the next begins.

| Phase | What to build | Done when |
|---|---|---|
| 1 | The core game for a single line: two cards, calling with the ring, one movable mark per call, locking, the claim button with hold-to-call, the card check with its suspense, false calls and sitting out, and a plain win or lose result. | Matt can play a full game of bingo by himself and it already feels tense. |
| 2 | The microphone shout and "Test your shout", the caller's voice and speech bubble, and the covered pause. | He can win by shouting. |
| 3 | Three regulars who play, with faces and reactions, and the staged night with the "Stage won" screen. | He can lose to Dot and play a full night. |
| 4 | Player profiles, saving, credits and the two results screens. | Two people can each keep their own progress. |
| 5 | Prizes, sets and badges, "Who wants what", the timed prize table with the regulars' rings, prize detail, the bought-it celebration, cabinets and "Table closed". | He can win credits and race Dot for a prize. |
| 6 | The pool of five regulars, absences and ring-ins, the caller's commentary, the home screen, settings, and polish: sound, buzz, animation, small-phone layout, offline install. | It feels finished. |

Small things without a mockup, to build where they fall:

- A regular winning a stage, using the "Stage won" screen with their face.
- The look-only prize table reached from "Peek at prizes".
- Confirmation prompts before quitting a game and before resetting progress.
- A friendly message if microphone permission is refused, switching to hold-to-call.

## 17. Planned for later

Do not build these yet, but do not design anything that blocks them.

- **Rooms.** A home with rooms such as a bedroom, kitchen, bathroom, garden, garage and playroom, where the player places their prizes and drags them around. Each prize already has a `size` and a suggested `room` for this. The player may put anything anywhere, and a prize could sparkle when placed in a room that suits it. It grows out of "My cabinet".
- **More patterns**, offered as a pattern of the night.
- **Livelier banter** written on the fly by an AI model. This would be optional and online-only, and any key must stay out of the code.
- **A setting for past calls shown**, from the full board down to only the current number.
- **Recorded voice files** for the caller.

## 18. Glossary

| Term | Meaning |
|---|---|
| Call | One number being announced, with its ring. |
| Pending mark | The one movable mark placed during the current call. |
| Locked mark | A mark made permanent when its call ended. |
| Valid mark | A mark on a called number that was the first mark for that number. |
| Claim | Tapping Call bingo and shouting or holding. |
| False call | A claim that fails the check. |
| Stage | One target pattern within a night. |
| Night | One full game, of one to three stages, followed by the prize round. |
| Regular | A computer-controlled player with a saved history. |
| Ring-in | A one-night stand-in for an absent regular. |
| Set | All prizes sharing one tag. |
| Street cred | The number of sets a player has finished. |
