# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-08-17

Initial release — the Galgame generator plugin for DeepSeek Harness:

- Script parser: characters / backgrounds / dialogue / narration / choices /
  jumps / endings / variables & if-lines (`[if] … [else] … [endif]`).
- Speaker-following sprites: the current speaker's portrait shows, narration
  hides everyone, 0.35s fade (no flicker); `[show]` / `[hide]` lock explicitly.
- BGM control: `[bgm file]` play (loop), `[bgm off]` / `[bgm stop]` stop,
  `[bgm file 0.5]` volume.
- 9-slot save/load (localStorage) including progress, sprites, background,
  BGM and variables.
- Player: typewriter, auto/skip, backlog, endings; sidebar 🎮 button +
  full-screen overlay.
- Self-contained `<title>.galgame.html` export with embedded assets.
- Model tools: `galgame_scan` and `galgame_build`.
- Asset convention: script at workspace root, characters in `img_human/`,
  backgrounds in `img_bg/`, BGM in `audio/`.
