# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-08-18

Third release — Galgame generation mode:

- **New: 🎬 Galgame 生成模式** — an agent preset the plugin installs into
  `~/.dsh/.agent-presets/galgame` on first load. Pick it in the new-session
  preset chip (or set as default in Settings → Agent Presets): sessions in the
  mode get an injected persona that auto-runs `galgame_scan` → `galgame_build`
  when you simply say 「生成」.
- The preset is a full copy of `standard` (full coding agent) with the
  generation-guidance persona; it never clobbers a user-edited preset.
- `agent-preset/` is now shipped in the package (`files`).

## [0.2.0] - 2026-08-18

Second release — stage control, animations, configurable saves and fixes:

- `img_cg/` asset convention: `[op]` opening, `[ed]` ending, `[cg]` CG illustration
  animations (gif / svg / mp4 / webm / avi).
- Configurable save slots: `[存档 N]` (1–20, default 9).
- Multi-pose characters: `名字·表情: 文件.png` variant sprites + `[表情 名字 表情名]`
  switching (saved with save data).
- Multi-character scenes: consecutive `[show 名字 @ 左|右]` lock several characters on
  stage; `[位置 名字 左|右|中]` re-positions them mid-dialogue (saved with save data).
- Hide aliases `[隐藏]`/`[取消显示]`/`[取消]`/`[移除]` and `[退场 名字]` (leave-until-`[show]`).
- Fixed asset scanning: only whitelisted asset dirs are collected, so unrelated
  folders no longer bloat the standalone HTML.
- Fixed binary embedding: manual base64 encoding (btoa in the host sandbox corrupts
  jpg/png/gif/wav by UTF-8 double-encoding bytes >= 0x80).

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
