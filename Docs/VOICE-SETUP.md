# Setting up the caller's recorded voice

The game can play recordings of the caller made with ElevenLabs. Anything without a recording is
spoken by the phone's own voice, so you can record in stages.

## 1. The voice to create (ElevenLabs Voice Design)

Paste this into the voice description:

> A warm, cheerful bingo caller with a friendly, slightly theatrical, old-fashioned club feel, like a much-loved game-show host or a kind uncle running the Friday night bingo. Middle-aged, clear and bright, with a gentle smile in the voice and a bit of playful twinkle. Medium pitch, easy to understand, never shouty or sarcastic. Slight British or Australian lilt, clear diction, lively but unhurried pacing, so numbers are crisp and easy to catch. Suitable for a children's game.

Change "British or Australian" to the accent your family prefers.

## 2. The test paragraphs

Every line here is exactly a line the game will say, so what you hear in the preview is what you will get.
Use one passage at a time, or paste several together if the preview box allows. Listen for numbers that
stay clear and consistent, and for a voice that sounds friendly in every mood.

**The calls (the most common thing he says)**

> One, Kelly's eye! Eight, Garden gate! Legs eleven! Thirteen, Unlucky for some! Seventeen, Dancing queen! Twenty-two, Two little ducks! Four and seven, forty-seven! Five and six, fifty-six! Sixty-six, Clickety click! Seventy-three, Queen bee! Seventy-five, Strive and strive!

**Numbers with no nickname, and quick-speed plain numbers**

> Two and eight, twenty-eight! Three oh, thirty! Six and four, sixty-four! Seven and seven, seventy-seven! Eleven! Forty-seven! Seventy-five!

**The card check, reading each number slowly**

> Forty-five... Sixty-two... Twelve... Thirty-eight... Seventy-one...

**The big moments**

> Eyes down, everyone! Every number checks out. We have a winner! That's a line. Well played! That's two lines. Well played! That's a full house. Well played!

**Sympathy (false calls)**

> Ooh, unlucky. I haven't called thirty-four yet. Not quite. Fifty-two is already on your other card. I can't see a line there, I'm afraid.

**The regulars (names and banter)**

> Dot has it! Well done, Dot. That's a line for Mabel. Sit down, Pearl, that's not a line. Rex has it! Well done, Rex. That's a full house for Gus.

**Short reminders**

> Marks locked! Too slow! The next number is out. No peeking! Your cards are covered.

## 3. Connect it to the game

1. Copy the new voice's **Voice ID** into `Data/voice.json`, next to `"voiceId"`. It is not a secret.
2. In ElevenLabs create an **API key**. Copy `.env.example` to a new file called `.env` and put the key after the equals sign. Never paste the key into a chat, the code or GitHub. The `.env` file is ignored by git.

## 4. Record

Each command is typed in the project folder.

| Command | What it does |
|---|---|
| `npm run voice:list` | Writes every line the caller can say to `Docs/voice-lines.txt` so you can read them. |
| `npm run voice` | Counts what is left to record and how many characters it will use. Spends nothing. |
| `npm run voice:sample` | Records three lines so you can listen first. They land in `public/audio/caller/`. |
| `npm run voice:make -- --only numbers` | Records just the numbers (the most important part). |
| `npm run voice:make` | Records everything that is missing. If it stops, run it again and it carries on. |

If you change a line in `Data/caller-lines.json` or a voice setting in `Data/voice.json`, running the
command again re-records just the lines that changed. Use `--force` to redo everything.

## 5. Remember

- The prize-table lines are not included yet. They come after that part of the game is built.
- Recordings keep working after the ElevenLabs subscription ends. New lines after that fall back to
  the phone's voice. Check ElevenLabs' terms about using generated audio in an app.
