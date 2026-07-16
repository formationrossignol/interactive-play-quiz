# Quiz audio assets

All files are self-hosted and must be **CC0 / royalty-free**. Paths below are
referenced by `src/lib/audioManifest.ts` — keep the exact filenames.

> **Music** is real (`ludiq-calm.mp3`, `ludiq-intense.mp3`). **SFX** are
> **synthesized at runtime** (Web Audio oscillators, `src/lib/sfxSynth.ts`) — no
> SFX files needed. To use recorded SFX instead, add files and switch
> `playSfx` in `src/hooks/useGameAudio.ts` back to an `<audio>` source.

## Music (shared beds)
`audio/`
- `ludiq-calm.mp3`    — calm bed, used for `lobby` + `results` phases
- `ludiq-intense.mp3` — driving bed, used for `question` + `victory` phases

All three ambiances (arcade/chill/epic) currently reference these same two files
via `sharedTracks` in `src/lib/audioManifest.ts` — they sound identical for now.
To give each ambiance a distinct sound, add per-ambiance files (e.g.
`audio/arcade/lobby.mp3`) and point each ambiance's `tracks` at them.

## SFX
Synthesized in `src/lib/sfxSynth.ts` (no files): `tick` (timer), `answer-correct`,
`answer-wrong`, `reveal` (answer distribution), `podium` (final).

## Where to get CC0 audio (music)
- https://pixabay.com/music/ and https://pixabay.com/sound-effects/ (CC0)
- https://mixkit.co/free-sound-effects/ and https://mixkit.co/free-stock-music/ (free license — check terms)

Keep each music loop < ~1 MB (trim/compress to ~128 kbps mono) to stay light.
