# dsh-galgame-generator

A Galgame (visual novel) generator for DeepSeek Harness (DSH). Give it a script document plus character/background/BGM assets and it builds a playable visual-novel web page.

## Features

- **Script parser**: characters / backgrounds / dialogue / narration / choices / jumps / endings / variables & if-lines (`[if 好感度 >= 1] … [else] … [endif]`)
- **Speaker-following sprites**: the current speaker's portrait shows, narration hides everyone, 0.35s fade (no flicker); `[show name]` / `[hide name]` lock explicitly
- **Multi-pose characters**: `名字·表情: 文件.png` defines variant sprites; `[表情 名字 表情名]` switches them in-script (saved with the save data)
- **BGM control**: `[bgm file.mp3]` play (loop), `[bgm off]` / `[bgm stop]` stop, `[bgm file.mp3 0.5]` volume
- **Animations & CG**: `[op]` opening, `[ed]` ending, `[cg]` CG illustration animations (`img_cg/`, gif / svg / mp4 / webm / avi)
- **Configurable save slots**: `[存档 N]` sets the count (1–20, default 9); progress, sprites, expressions, background, BGM and variables are saved
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

## 🎬 Galgame Generation Mode

After install and a page refresh, the plugin also registers a **「Galgame 生成模式」** agent preset in DSH. Pick it in the new-session preset chip (or set it as default under Settings → Agent Presets). Sessions in this mode get an injected persona that tells the model to auto-run `galgame_scan` then `galgame_build` when you simply say "generate", so you only need to place the assets and say **生成**. The preset is a full copy of `standard` with the generation-guidance persona added; you can tweak `~/.dsh/.agent-presets/galgame/` to customize it.

## Install

```bash
pnpm pack
# copy dsh-galgame-generator-*.tgz into your web profile, e.g. under ~/.dsh/profiles/web:
#   pnpm add ../path/to/dsh-galgame-generator-0.1.0.tgz
# then restart `dsh web`.
```

## License

MIT
