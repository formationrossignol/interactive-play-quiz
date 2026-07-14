# Quiz audio assets

All files are self-hosted and must be **CC0 / royalty-free**. Paths below are
referenced by `src/lib/audioManifest.ts` — keep the exact filenames.

> The files currently committed here are **silent placeholders** (~1s of MPEG
> silence) so nothing 404s. Replace each with real audio before shipping.

## Music (loops), per ambiance
`audio/{arcade,chill,epic}/`
- `lobby.mp3`    — light loop while players join
- `question.mp3` — driving loop during questions
- `results.mp3`  — upbeat loop for leaderboard/transition
- `victory.mp3`  — celebratory loop for the final screen

Ambiance vibes: **arcade** = chiptune/synth, **chill** = lo-fi, **epic** = cinematic.

## SFX (one-shots)
`audio/sfx/`
- `tick.mp3`    — last 5s of the timer (host screen)
- `correct.mp3` — right answer
- `wrong.mp3`   — wrong answer
- `reveal.mp3`  — answer distribution appears
- `podium.mp3`  — final podium stinger

## Where to get CC0 audio
- https://pixabay.com/music/ and https://pixabay.com/sound-effects/ (CC0)
- https://mixkit.co/free-sound-effects/ and https://mixkit.co/free-stock-music/ (free license — check terms)

Keep each music loop < ~1 MB (trim/compress to ~128 kbps mono) to stay light.
