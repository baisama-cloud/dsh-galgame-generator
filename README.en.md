# dsh-galgame-generator

A Galgame (visual novel) generator for DeepSeek Harness (DSH). Give it a script document plus character/background/BGM assets and it builds a playable visual-novel web page.

## Features

- **Script parser**: characters / backgrounds / dialogue / narration / choices / jumps / endings / variables & if-lines (`[if 好感度 >= 1] … [else] … [endif]`)
- **Speaker-following sprites**: the current speaker's portrait shows, narration hides everyone, 0.35s fade (no flicker); `[show name]` / `[hide name]` lock explicitly
- **BGM control**: `[bgm file.mp3]` play (loop), `[bgm off]` / `[bgm stop]` stop, `[bgm file.mp3 0.5]` volume
- **9-slot save/load** (localStorage): progress, sprites, background, BGM and variables
- **Player**: typewriter, auto/skip, backlog, endings; also exports a self-contained `<title>.galgame.html` that runs by double-click
- **Model tools**: `galgame_scan` (scan assets) and `galgame_build` (parse & build)

## Asset convention (workspace root)

| What | Where |
| --- | --- |
| Script document | workspace root, any `.md` / `.txt` (e.g. `夏日回忆.md`) |
| Character sprites | `img_human/` |
| Background images | `img_bg/` |
| BGM audio | `audio/` |

See `README.zh.md` for the script format quick reference and installation steps.

## Install

```bash
pnpm pack
# copy dsh-galgame-generator-*.tgz into your web profile, e.g. under ~/.dsh/profiles/web:
#   pnpm add ../path/to/dsh-galgame-generator-0.1.0.tgz
# then restart `dsh web`.
```

## License

MIT
