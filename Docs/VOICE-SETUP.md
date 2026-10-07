# Setting up the caller's recorded voice

The game can play recordings of the caller made with ElevenLabs. Anything without a recording is
spoken by the phone's own voice, so you can record in stages.

## 1. The voice to create (ElevenLabs Voice Design)

Paste this into the voice description:

> A warm, cheerful bingo caller with a friendly, slightly theatrical, old-fashioned club feel, like a much-loved game-show host or a kind uncle running the Friday night bingo. Middle-aged, clear and bright, with a gentle smile in the voice and a bit of playful twinkle. Medium pitch, easy to understand, never shouty or sarcastic. Slight British or Australian lilt, clear diction, lively but unhurried pacing, so numbers are crisp and easy to catch. Suitable for a children's game.

Change "British or Australian" to the accent your family prefers.

## 2. The test paragraphs

Every line here is a real line from the game, so what you hear in the preview is what you will get.
Use one passage at a time, or paste several together if the preview box allows. Listen for numbers that
stay clear and consistent, and for a voice that sounds friendly in every mood.

**The calls (the most common thing he says)**

> Kelly's eye, one! Eight, Garden gate! Legs eleven! Thirteen, Unlucky for some! Twenty-two, Two little ducks! Four and seven, forty-seven! Five and nine, fifty-nine. Seventy-seven. Seventy-five, Strive and strive!

**The big moments**

> Eyes down, everyone! Here we go. Good luck! Let's have a look at that card. Forty-five... Sixty-two... Twelve... Every number checks out. We have a winner! That's a line. Well played!

**Sympathy (false calls)**

> Ooh, unlucky. I haven't called thirty-four yet. Not quite. Fifty-two is already on your other card. I can't see a line there, I'm afraid.

**The regulars (names and banter)**

> Sit down, Dot, that's not two lines. Rex has it! Well done, Rex. That's a full house for Pearl. No peeking! Your cards are covered.

**A tricky mix to test the voice**

> Marks locked! Too slow! The next number is out. Dancing queen, seventeen! Thirty. Seventy-three, Queen bee! Eighty-one is not a number we have. Seventy. Sixty-six, Clickety click!

(That last passage includes one made-up sentence to see how the voice handles a flat statement. Skip it if you
would rather keep to real lines.)

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
