# Quiz audio assets

All files are self-hosted and must be **CC0 / royalty-free**. Paths below are
referenced by `src/lib/audioManifest.ts` — keep the exact filenames.

> **Music** is real (`ludiq-calm.mp3`, `ludiq-intense.mp3`). **SFX** are still
> **silent placeholders** (~1s of MPEG silence) so nothing 404s — replace them.

## Music (shared beds)
`audio/`
- `ludiq-calm.mp3`    — calm bed, used for `lobby` + `results` phases
- `ludiq-intense.mp3` — driving bed, used for `question` + `victory` phases

All three ambiances (arcade/chill/epic) currently reference these same two files
via `sharedTracks` in `src/lib/audioManifest.ts` — they sound identical for now.
To give each ambiance a distinct sound, add per-ambiance files (e.g.
`audio/arcade/lobby.mp3`) and point each ambiance's `tracks` at them.

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
