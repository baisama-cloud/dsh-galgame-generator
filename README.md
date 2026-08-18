# dsh-galgame-generator

DeepSeek Harness (DSH) 的 **Galgame 生成器**：提供一份剧本文档 + 立绘/背景/音乐素材，即可生成一个可玩的视觉小说（Galgame）网页。
新增一个GalGame生成模式，在这个模式的工作区下提供一份剧本文档 + 立绘/CG/背景/音乐素材等，即可生成Galgame网页。

剧本可根据格式md文件由ai直接生成。

生成物：

- **`<标题>.galgame.html`** —— 自包含独立网页：双击即可在浏览器游玩，立绘/背景/音乐全部内嵌，**9 槽位存档读档**（localStorage），可发给别人玩；
- **🎮 Galgame 侧边栏按钮** —— 在 DSH Web GUI 界面内直接游玩（刷新页面后出现）。

## 功能

- **剧本解析**：角色/背景/台词/旁白/选项分支/跳转/结局/**变量与 if 条件线**（`[if 变量 >= 1] … [else] … [endif]`）
- **立绘自动跟随说话人**：谁说话显示谁、旁白全隐藏、切换 0.35s 淡入淡出不闪；`[show 名字]` / `[hide 名字]` 可显式锁定
- **角色多张立绘**：`名字·表情: 文件.png` 定义变体，剧本里 `[表情 名字 表情名]` 切换（表情随存档保存）
- **背景音乐**：`[bgm 音乐.mp3]` 播放（循环）、`[bgm off]` / `[bgm stop]` 停止、`[bgm 音乐.mp3 0.5]` 可调音量
- **动画与 CG**：`[op]` 开局动画、`[ed]` 结束动画、`[cg]` CG 插图动画（`img_cg/`，支持 gif / svg / mp4 / webm / avi）
- **可配置存档数**：`[存档 N]` 设置槽位数（1–20，默认 9）；进度、立绘、表情、背景、BGM、变量全保存；标题页可直接进入读档
- **播放器**：打字机、自动/快进、历史记录、结局画面
- **两个模型工具**：`galgame_scan`（扫描素材）、`galgame_build`（解析生成）

## 素材约定（工作区根目录）

| 放什么 | 位置 |
| --- | --- |
| 剧本文档 | 工作区根目录任意 `.md` / `.txt`（如 `夏日回忆.md`） |
| 人物立绘 | `img_human/`（如 `img_human/mei.png`） |
| 背景图片 | `img_bg/`（如 `img_bg/classroom.png`） |
| 背景音乐 | `audio/`（如 `audio/bgm.mp3`） |
| 开局/结束动画、CG 插图 | `img_cg/`（如 `img_cg/opening.gif`、`img_cg/cg1.gif`、`img_cg/ending.mp4`） |

剧本示例：

```md
# 夏日回忆

## 角色
小美: img_human/mei.png @ right
小明: img_human/ming.png @ left

## 背景
教室: img_bg/classroom.png
天台: img_bg/rooftop.png

## 剧本
[bg 教室]
[bgm audio/bgm.mp3]
小美: 今天天气真好。
（旁白：立绘自动隐藏）
[选项]
- 一起去天台 → 天台线

### 天台线
[bg 天台]
[bgm audio/bgm2.mp3 0.5]
[变量 好感度 + 1]
[if 好感度 >= 1]
小美: 你果然愿意来。
[endif]
[结束 结局·天台上的诗]
```

支持图片 png/jpg/jpeg/webp/gif/svg，音乐 mp3/ogg/wav/m4a/mp4/flac。完整语法见 [docs/剧本格式.md](docs/剧本格式.md)，可直接套用的示例剧本见 [examples/夏日回忆.md](examples/夏日回忆.md)（把 `img_human/`、`img_bg/`、`audio/` 换成你的素材即可）。

## 自检

```bash
node scripts/check.mjs   # 语法 + manifest + bundle 契约自检
```

## 安装

打包 tarball 后安装到你的 DSH web profile（与其他 `dsh-*` 插件一致）：

```bash
pnpm pack
# 把 dsh-galgame-generator-*.tgz 复制到 web profile 并添加依赖：
#   例如在 ~/.dsh/profiles/web 下：pnpm add ../path/to/dsh-galgame-generator-0.1.0.tgz
# 然后重启 `dsh web`。
```

安装后刷新页面，侧边栏底部出现 **🎮 Galgame** 按钮。在对话中让助手调用 `galgame_build` 生成游戏（剧本与素材按上述约定放好即可），然后打开播放器游玩。

## 剧本语法速查

| 写法 | 含义 |
| --- | --- |
| `名字: 台词` | 角色台词（自动显示该角色立绘） |
| `（旁白）` 或纯文本行 | 旁白（立绘全部淡出） |
| `[bg 背景名]` | 切换背景 |
| `[show 名字 @ left/center/right]` / `[hide 名字]` | 显式显示/隐藏并锁定立绘 |
| `[bgm 文件.mp3]` / `[bgm off]` / `[bgm 文件.mp3 0.5]` | 音乐播放/停止/音量 |
| `[变量 名字 = 值]` / `[变量 名字 + 1]` | 变量赋值/增减 |
| `[if 变量 >= 2]` … `[else]` … `[endif]` | 条件分支（支持 = == != > >= < <= 及中文） |
| `[选项]` + `- 文本 → 标签` | 分支选项 |
| `### 标签名` / `[跳转 标签]` | 跳转点与跳转 |
| `[结束 结局名]` | 结束游戏 |

## License

MIT
