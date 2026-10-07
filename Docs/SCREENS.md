# Screen guide

There are 26 designed screens. Each has a PNG in `Design/screens/` and an HTML file of the same name in `Design/html/`. They are numbered in the order a player meets them.

The mockups show one frozen moment each. Names, numbers and prizes in them are examples. The rules behind each screen are in `BUILD-BRIEF.md`.

## The flow

```
Welcome -> (New player -> How to play -> Test your shout) -> Home
Home -> Tonight's game -> Play
Play -> Call bingo -> Shout -> Checking -> False call -> Sitting out -> Play
                                        -> Stage won -> Play (next stage)
                                        -> End of the night
End of the night -> Who wants what -> Prize table -> Table closed -> Home or a new night
```

## Part 1: getting in and playing

| File | Screen | What it is for |
|---|---|---|
| `01-welcome` | Welcome | Asks who is playing. Shows each saved player with their face and credits, and a tile to add a new player. Has slots for the logo and the caller. |
| `02-new-player` | New player | Name, a choice of eight faces and a choice of six colours. Also used to change an existing player's name or face. |
| `03-how-to-play` | How to play | Four rules, introduced by the caller. Shown once to a new player and reachable from Settings. |
| `04-test-your-shout` | Test your shout | Sets how loud the player must be. Shows a live loudness bar with the required level marked. Offers hold-to-call for people who cannot shout. Explains that the microphone only turns on when Call bingo is tapped. |
| `05-home` | Home | The hub. Shows the player, their credits, the club scene art, a line from the caller, the big Play button, an update on a rival, and tiles for peeking at prizes, sets, the cabinet and settings. Tapping the face switches player. |
| `06-tonights-game` | Tonight's game | Choose the length of the night and the calling speed. Shows who is at the table tonight. Each speed shows its credit multiplier. |
| `07-play` | Play | The main game screen. See the notes below. |
| `07b-lock-moment` | Lock moment | The top of the play screen in the instant a call ends: the ring is empty, the ball shows a padlock, and the caller says "Marks locked!". It lasts a moment, then the next number appears. |
| `08-paused` | Paused | Covers the whole game. The caller has his eyes shut. Shows that this is the one pause for the game. Resume, or quit the game. |
| `09-shout` | Shout | Opens when Call bingo is tapped. The microphone is live. Shows a loudness bar with the required level, a warning about who is close to winning, the hold-to-call button and a way back to the cards. |
| `10-checking` | Checking | The caller checks the claimed pattern one number at a time in random order. Ticked numbers are done, the enlarged one is being checked, dimmed ones are waiting. The caller reads each number in his bubble. |
| `11-false-call` | False call | The check failed. The headline gives the reason. The failed number has an X and unchecked numbers stay dim. A live ball shows the next number is already running. One big button returns to the cards. |
| `12-sitting-out` | Sitting out | The play screen during the two-call penalty. Cards are faded and cannot be tapped. A dark banner replaces the Call bingo button and counts down. |

### Notes on the play screen

From top to bottom:

- **The called number** in a glossy ball, inside the timer ring.
- **The caller and his speech bubble.** Tapping the caller mutes his voice.
- **The pause button.**
- **The target pill**, showing the stage and pattern, with a small picture of the pattern.
- **The last four calls.**
- **The column letters** B I N G O, shared by both cards.
- **Two cards.** Purple squares are locked marks. The aqua square with the darker outline is this call's pending mark.
- **The regulars**, in one white pill, each with a face, a name and how many squares they still need. A magenta tag marks anyone one square from winning.
- **The Call bingo button.**

No square on the player's cards is ever highlighted by the game.

## Part 2: after the game

| File | Screen | What it is for |
|---|---|---|
| `13-stage-won` | Stage won | Shown when a stage is won but the night continues. The same celebration as a win, the credits banked, then the next target with a countdown ring. No breakdown and no prize table button. Returns to the cards. |
| `14-end-of-the-night-you-won` | End of the night, won | Shown after the final stage when the player won it. One row per stage with who won and what it paid, the speed multiplier and the total. Shows what each regular earned. Leads only to the prize round. |
| `15-end-of-the-night-you-lost` | End of the night, lost | The same layout when a regular won the final stage. Includes the consolation for getting close and any false-call deduction. |
| `16-who-wants-what` | Who wants what | The calm planning screen before the prize table. One card per player with their face, credits and closest set. Tapping a card opens that player's cabinet. |
| `16b-ring-in-night` | Ring-in night | The same screen on a night when a regular is away. A notice explains the absence. The ring-in's card has a dashed outline and a tag, and shows the one prize they want and why. |
| `17-prize-table` | Prize table | The timed shopping screen. See the notes below. |
| `18-prize-detail` | Prize detail | Opens when a prize is tapped. Shows the prize large, all its tags, what it would do for the player's set, and every other player who wants it, with whoever is closest to finishing a set listed first. |
| `19-bought-it` | Bought it | Celebrates a purchase. If it finished a set, shows the badge and whether it is gold. A beaten rival reacts. |
| `20-table-closed` | Table closed | The summary after the player taps "I'm done": what they took home, what each regular did, what stays on the table, and how many new prizes will arrive. Offers another night or home. |
| `21-sets` | Sets | All 17 sets with progress toward each target. Tabs filter by family: Things, Colours and Feels. Unearned badges are faint. Sets the player has not started show which regular is ahead. |
| `22-my-cabinet` | My cabinet | The player's own collection: street cred, sets in progress, finished sets with their badges, and prizes won. |
| `23-rivals-cabinet` | Rival's cabinet | The same layout for a regular, opened from "Who wants what" or the home screen. Includes a line about how they shop. |
| `24-settings` | Settings | Sound switches, usual speed, shout level, hold-to-call mode, and links to the rules, player switching, editing the player and starting again. |

### Notes on the prize table

- **Header:** the player's credits and the "I'm done" button. There is no back arrow, because leaving closes the table.
- **The caller's bubble** carries his running commentary.
- **Set chips** show the player's three closest sets.
- **Six prize tiles** in two columns. Each shows the prize art on a tinted circle, its name, up to two tags and a price button. A prize the player cannot afford shows how many credits they are short.
- **Regulars' rings** sit in the top-left corner of the tile they are eyeing, stacked if more than one wants it. A ring turns magenta when nearly out.
- **A badge** marks a prize that would finish one of the player's sets.
- **The sold moment:** a just-sold slot briefly shows who bought it before a new prize drops in.

## Colour moods

- Screens 9, 10, 11 and 8 use the dimmed background. They are the tense moments.
- Every other screen uses the bright background.

## Placeholders still in the mockups

Dashed boxes mark art that had not been made when the screens were drawn: the logo, the club scene, some prizes and some badges. Use the real files from `Images/` where they exist.
