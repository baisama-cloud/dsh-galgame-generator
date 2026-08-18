/**
 * dsh-galgame-generator — host half.
 *
 * Builds a playable Galgame (visual novel) from a script document plus
 * character/background/BGM assets, and serves it to the web player:
 *
 *   - galgame_scan  : list script candidates and image/audio assets in a dir.
 *   - galgame_build : parse the script (chars/bgs/lines/choices/jumps/vars/if),
 *                     register assets under /galgame/assets/*, keep the game in
 *                     memory, and export a self-contained <title>.galgame.html
 *                     (embedded assets, 9-slot save/load, speaker-following
 *                     sprites, BGM control, if-line branching).
 *   - GET /galgame/api/load : the web player fetches the latest game JSON.
 *
 * The player UI itself lives in lib/client.js (sidebar 🎮 Galgame button +
 * full-screen overlay), registered via the shell slots.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-galgame-generator'
export const inject = ['tools']

const EXT_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  mp4: 'audio/mp4', flac: 'audio/flac', webm: 'video/webm', avi: 'video/x-msvideo',
}
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp']
const AUD_EXT = ['mp3', 'ogg', 'wav', 'm4a', 'mp4', 'flac', 'webm', 'avi']
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const ASSET_PREFIX = '/galgame/assets'

const games = new Map()
let latestGameId = null

function extOf(name) { const m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : '' }
function mimeOf(name) { return EXT_MIME[extOf(name)] || 'application/octet-stream' }
function isImg(name) { return IMG_EXT.indexOf(extOf(name)) >= 0 }
function isAud(name) { return AUD_EXT.indexOf(extOf(name)) >= 0 }
function isAsset(name) { return isImg(name) || isAud(name) }
function dirOf(p) { const s = String(p).replace(/[\\/]+$/, ''); const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')); return i >= 0 ? s.slice(0, i) : '' }
function joinPath(dir, name) { const d = String(dir || '').replace(/[\\/]+$/, ''); const n = String(name || '').replace(/^[\\/]+/, ''); return d ? d + '/' + n : n }
function baseOf(p) { const s = String(p).replace(/[\\/]+$/, ''); const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')); return i >= 0 ? s.slice(i + 1) : s }
function normRel(p) { return String(p).replace(/\\/g, '/').replace(/^\.\//, '') }
function encPath(p) { return normRel(p).split('/').filter(Boolean).map((s) => encodeURIComponent(s)).join('/') }
function posOf(s) { if (!s) return 'center'; if (s === '左' || s === 'left') return 'left'; if (s === '右' || s === 'right') return 'right'; return 'center' }

async function readText(fs, absPath, signal) {
  const target = await fs.resolve(absPath, { signal })
  const info = await fs.stat(target, signal)
  if (!info || info.type !== 'file') throw new Error('不是文件：' + absPath)
  return fs.readText(target, signal)
}

function parseVal(s) {
  const t = String(s == null ? '' : s).trim()
  if (t === '') return null
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  const q = /^(['"])(.*)\1$/.exec(t)
  if (q) return q[2]
  if (t === 'true') return true
  if (t === 'false') return false
  return t
}

function parseCond(arg) {
  const t = String(arg || '').trim()
  if (!t) return null
  const m = /^(.*?)\s*(>=|<=|!=|==|=|>|<|不等于|等于|大于等于|小于等于|大于|小于)\s*(.+)$/.exec(t)
  if (m) {
    const name = m[1].trim()
    if (!name) return null
    const raw = m[2]
    let op = '='
    if (raw === '>=' || raw === '大于等于') op = '>='
    else if (raw === '<=' || raw === '小于等于') op = '<='
    else if (raw === '!=' || raw === '不等于') op = '!='
    else if (raw === '>' || raw === '大于') op = '>'
    else if (raw === '<' || raw === '小于') op = '<'
    const val = parseVal(m[3])
    if (val === null) return null
    return { var: name, op, val }
  }
  if (/^[^\s=<>!]+$/.test(t)) return { var: t, op: 'truthy', val: true }
  return null
}

function parseVarAssign(arg) {
  const t = String(arg || '').trim()
  if (!t) return null
  const m = /^(.*?)\s*(\+\+|--|\+=|-=|=|\+|-|加|减|增加|减少|设为|赋值)\s*(.*)$/.exec(t)
  if (m) {
    const name = m[1].trim()
    if (!name) return null
    const raw = m[2]
    let op = '='
    if (raw === '+' || raw === '加' || raw === '增加' || raw === '++' || raw === '+=') op = '+'
    else if (raw === '-' || raw === '减' || raw === '减少' || raw === '--' || raw === '-=') op = '-'
    let valRaw = m[3] !== undefined ? m[3].trim() : ''
    if ((raw === '++' || raw === '--') && valRaw === '') valRaw = '1'
    const val = parseVal(valRaw)
    if (val === null) return null
    return { name, op, val }
  }
  const parts = t.split(/\s+/)
  if (parts.length >= 2) {
    const name = parts[0].trim()
    const val = parseVal(parts.slice(1).join(' '))
    if (name && val !== null) return { name, op: '=', val }
  }
  if (/^[^\s=<>!]+$/.test(t)) return { name: t, op: '=', val: true }
  return null
}

function parseScript(text) {
  const lines = String(text).split(/\r?\n/)
  const result = { title: '', intro: '', characters: {}, backgrounds: {}, labels: {}, nodes: [], warnings: [], errors: [], saveSlots: null, output: null }
  let section = null
  let pendingChoices = null
  let firstContent = true
  const ifStack = []

  const push = (inst) => { result.nodes.push(inst); return result.nodes.length - 1 }

  function parseInline(content) {
    const t = String(content || '').trim()
    if (!t) return []
    const dlg = /^([^\[\]:：]+)\s*[:：]\s*(.+)$/.exec(t)
    if (dlg) return [{ type: 'say', speaker: dlg[1].trim(), text: dlg[2].trim() }]
    const narr = /^[（(](.+)[)）]$/.exec(t)
    if (narr) return [{ type: 'say', speaker: '', text: narr[1].trim() }]
    return [{ type: 'say', speaker: '', text: t }]
  }

  function flushChoices() {
    if (!pendingChoices || !pendingChoices.length) { pendingChoices = null; return }
    const choiceIdx = push({ type: 'choice', options: [], line: 0 })
    for (const o of pendingChoices) {
      let opt = { text: o.text, target: o.target !== undefined ? o.target : null }
      if (o.inline) {
        const start = result.nodes.length
        const insts = parseInline(o.inline)
        for (const inst of insts) push(inst)
        if (insts.length) opt = { text: o.text, target: start }
        else result.warnings.push('第' + o.line + '行：选项内联内容无法解析：「' + o.inline + '」')
      }
      result.nodes[choiceIdx].options.push(opt)
    }
    pendingChoices = null
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const lineNo = i + 1
    if (!trimmed || trimmed.startsWith('//')) continue
    if (trimmed.startsWith('# ')) {
      if (firstContent && !result.title) result.title = trimmed.slice(2).trim()
      firstContent = false
      continue
    }
    firstContent = false

    const mh3 = /^###\s+(.+)$/.exec(trimmed)
    if (mh3) { flushChoices(); section = 'script'; const name = mh3[1].trim(); if (result.labels[name] === undefined) result.labels[name] = result.nodes.length; continue }
    const mh2 = /^##\s+(.+)$/.exec(trimmed)
    if (mh2) { flushChoices(); const sec = mh2[1].trim(); if (/角色|人物|char/i.test(sec)) section = 'char'; else if (/背景|场景|bg/i.test(sec)) section = 'bg'; else section = 'script'; continue }

    const kv = /^(标题|游戏名|简介|描述|副标题)\s*[:：]\s*(.+)$/.exec(trimmed)
    if (kv) { flushChoices(); if (/标题|游戏名/.test(kv[1])) result.title = kv[2].trim(); else result.intro = kv[2].trim(); continue }

    const mcmd = /^\[([^\]]+)\]$/.exec(trimmed)
    if (mcmd) {
      flushChoices()
      const body = mcmd[1].trim()
      const sp = body.split(/\s+/)
      const verb = sp[0].toLowerCase()
      const arg = sp.slice(1).join(' ').trim()
      if (verb === '选项' || verb === 'option' || verb === 'choices') { pendingChoices = []; continue }
      if (verb === '变量' || verb === '设置' || verb === 'var' || verb === 'set') {
        const v = parseVarAssign(arg)
        if (v) push({ type: 'var', name: v.name, op: v.op, val: v.val, line: lineNo })
        else result.warnings.push('第' + lineNo + '行：变量指令格式应为「[变量 名字 = 值] / [变量 名字 + 1]」，已忽略')
        continue
      }
      if (verb === 'if' || verb === '如果' || verb === '条件') {
        const c = parseCond(arg)
        if (!c) { result.warnings.push('第' + lineNo + '行：if 条件格式应为「[if 变量 >= 2]」，已忽略'); continue }
        const ci = push({ type: 'jumpIf', var: c.var, op: c.op, val: c.val, target: null, line: lineNo })
        ifStack.push({ condIdx: ci, elseJumpIdx: null, line: lineNo })
        continue
      }
      if (verb === 'else' || verb === '否则') {
        if (!ifStack.length) { result.warnings.push('第' + lineNo + '行：[else] 没有对应的 [if]，已忽略'); continue }
        const top = ifStack[ifStack.length - 1]
        if (top.elseJumpIdx !== null) { result.warnings.push('第' + lineNo + '行：重复的 [else]，已忽略'); continue }
        const jIdx = push({ type: 'jump', target: null, line: lineNo })
        result.nodes[top.condIdx].target = jIdx + 1
        top.elseJumpIdx = jIdx
        continue
      }
      if (verb === 'endif' || verb === '结束if' || verb === 'fi') {
        if (!ifStack.length) { result.warnings.push('第' + lineNo + '行：[endif] 没有对应的 [if]，已忽略'); continue }
        const top = ifStack.pop()
        if (top.elseJumpIdx !== null) result.nodes[top.elseJumpIdx].target = result.nodes.length
        else result.nodes[top.condIdx].target = result.nodes.length
        continue
      }
      if (verb === 'bg' || verb === '背景') { push({ type: 'bg', bg: arg, line: lineNo }); continue }
      if (verb === 'bgm' || verb === '音乐' || verb === 'music') {
        let f = arg
        const sp2 = f.split(/\s+/)
        if (sp2[0] === 'play' || sp2[0] === '播放') { f = sp2.slice(1).join(' ').trim() }
        else if (sp2[0] === 'off' || sp2[0] === 'stop' || sp2[0] === '停止' || sp2[0] === '无' || sp2[0] === 'none') { f = '' }
        if (!f) { push({ type: 'bgm', file: null, vol: null, line: lineNo }); continue }
        let vol = null
        const parts2 = f.split(/\s+/)
        if (parts2.length >= 2 && /^\d+(\.\d+)?$/.test(parts2[parts2.length - 1])) vol = Number(parts2.pop())
        push({ type: 'bgm', file: parts2.join(' '), vol: vol, line: lineNo })
        continue
      }
      if (verb === 'op' || verb === 'opening' || verb === '开局动画') { push({ type: 'op', file: arg, line: lineNo }); continue }
      if (verb === 'cg' || verb === 'cg动画' || verb === '插图') { push({ type: 'cg', file: arg, line: lineNo }); continue }
      if (verb === 'ed' || verb === 'ending' || verb === '结束动画') { push({ type: 'ed', file: arg, line: lineNo }); continue }
      if (verb === '存档' || verb === '存档数' || verb === '槽位' || verb === 'slots') {
        const n = Number(arg)
        if (n >= 1 && n <= 20) result.saveSlots = Math.floor(n)
        else result.warnings.push('第' + lineNo + '行：存档数应为 1-20 的数字，已忽略（默认 9）')
        continue
      }
      if (verb === '输出' || verb === '打包' || verb === 'export' || verb === 'package') {
        const t = String(arg || '').toLowerCase()
        if (t === 'exe' || t === 'html') result.output = t
        else result.warnings.push('第' + lineNo + '行：[输出] 只能是 exe 或 html，已忽略（默认 html）')
        continue
      }
      if (verb === 'show' || verb === '显示') { const m = /^(.+?)(?:\s*@\s*(left|center|right|左|中|右))?\s*$/.exec(arg); push({ type: 'sprite', char: m ? m[1].trim() : arg, action: 'show', pos: posOf(m && m[2]), line: lineNo }); continue }
      if (verb === 'hide' || verb === '隐藏') { push({ type: 'sprite', char: arg, action: 'hide', line: lineNo }); continue }
      if (verb === '表情' || verb === '立绘' || verb === 'face') {
        const spf = arg.split(/\s+/)
        let ch = spf[0]
        let variant = spf[1] || ''
        const dot = ch.indexOf('·')
        if (dot > 0 && !variant) { variant = ch.slice(dot + 1).trim(); ch = ch.slice(0, dot) }
        push({ type: 'face', char: ch, variant: variant, line: lineNo })
        continue
      }
      if (verb === '位置' || verb === '站位' || verb === '换位' || verb === 'pos' || verb === 'move') {
        const spf = arg.split(/\s+/)
        if (spf.length >= 2 && spf[0]) push({ type: 'pos', char: spf[0], pos: posOf(spf[1]), line: lineNo })
        else result.warnings.push('第' + lineNo + '行：[位置] 格式应为「[位置 名字 左|右|中]」，已忽略')
        continue
      }
      if (verb === '跳转' || verb === '跳' || verb === 'jump' || verb === 'goto') { push({ type: 'jump', target: arg, line: lineNo }); continue }
      if (verb === '结束' || verb === 'end' || verb === '结局') { push({ type: 'end', name: arg, line: lineNo }); continue }
      if (verb === '旁白' || verb === 'narration') { push({ type: 'say', speaker: '', text: arg, line: lineNo }); continue }
      result.warnings.push('第' + lineNo + '行：无法识别的指令 [ ' + body + ' ]（已忽略）')
      continue
    }

    if (pendingChoices) {
      const mo = /^[-*•]\s+(.+)$/.exec(trimmed)
      if (mo) {
        const rawText = mo[1].trim()
        const arrow = /^(.*?)\s*(?:→|->|=>)\s*(.+)$/.exec(rawText)
        const colon = /^(.*?)\s*[:：]\s*(.+)$/.exec(rawText)
        if (arrow) pendingChoices.push({ text: arrow[1].trim(), target: arrow[2].trim(), line: lineNo })
        else if (colon) pendingChoices.push({ text: colon[1].trim(), inline: colon[2].trim(), line: lineNo })
        else pendingChoices.push({ text: rawText, line: lineNo })
        continue
      }
      flushChoices()
    }

    if (section === 'script') {
      const m = /^([^\[\]:：]+)\s*[:：]\s*(.+)$/.exec(trimmed)
      if (m) { push({ type: 'say', speaker: m[1].trim(), text: m[2].trim(), line: lineNo }); continue }
      const mn = /^[（(](.+)[)）]$/.exec(trimmed)
      if (mn) { push({ type: 'say', speaker: '', text: mn[1].trim(), line: lineNo }); continue }
      push({ type: 'say', speaker: '', text: trimmed, line: lineNo })
      continue
    }
    if (section === 'char') {
      const m = /^(.+?)\s*[:：=]\s*(.+)$/.exec(trimmed)
      if (m) { const name = m[1].trim(); const fp = m[2].trim(); const pm = /^(.+?)(?:\s*@\s*(left|center|right|左|中|右))?\s*$/.exec(fp); result.characters[name] = { name, file: pm ? pm[1].trim() : fp, pos: posOf(pm && pm[2]) } }
      else result.warnings.push('第' + lineNo + '行：角色行格式应为「名字: 立绘文件.png」（变体用「名字·表情: 文件.png」），已忽略')
      continue
    }
    if (section === 'bg') {
      const m = /^(.+?)\s*[:：=]\s*(.+)$/.exec(trimmed)
      if (m) result.backgrounds[m[1].trim()] = { name: m[1].trim(), file: m[2].trim() }
      else result.warnings.push('第' + lineNo + '行：背景行格式应为「名字: 背景文件.png」，已忽略')
      continue
    }
    result.warnings.push('第' + lineNo + '行：内容在分区之外，已忽略')
  }
  flushChoices()
  for (const s of ifStack) result.errors.push('第' + s.line + '行：[if] 缺少对应的 [endif]')

  // 角色变体分组：名字含 · 或 @ 的条目归属同一角色的变体立绘
  const grouped = {}
  for (const full of Object.keys(result.characters)) {
    const c = result.characters[full]
    let base = full
    let variant = ''
    const dot = full.indexOf('·')
    const at = full.indexOf('@')
    if (dot > 0) { base = full.slice(0, dot); variant = full.slice(dot + 1).trim() }
    else if (at > 0 && !full.slice(at + 1).includes('/')) { base = full.slice(0, at); variant = full.slice(at + 1).trim() }
    if (!grouped[base]) grouped[base] = { name: base, pos: c.pos, variants: {} }
    grouped[base].variants[variant || ''] = { file: c.file, pos: c.pos || grouped[base].pos }
    if (!variant) grouped[base].pos = c.pos
  }
  result.characters = grouped

  result.nodes = result.nodes.map((n) => {
    if (n.type === 'jump') {
      if (typeof n.target === 'number') return n
      const t = n.target !== null && n.target !== undefined && result.labels[n.target] !== undefined ? result.labels[n.target] : null
      if (n.target !== null && n.target !== undefined && t === null) result.errors.push('跳转目标「' + n.target + '」不存在（第' + n.line + '行）')
      return { ...n, target: t }
    }
    if (n.type === 'choice') {
      return { ...n, options: n.options.map((o) => {
        if (typeof o.target === 'number') return o
        if (o.target === null || o.target === undefined) return o
        const t = result.labels[o.target]
        if (t === undefined) { result.errors.push('选项「' + o.text + '」的跳转目标「' + o.target + '」不存在（第' + n.line + '行）'); return { ...o, target: null } }
        return { ...o, target: t }
      }) }
    }
    return n
  })
  return result
}

async function collectAssets(fs, scriptDir, signal) {
  const assets = new Map()
  const byBase = new Map()
  const dirNorm = normRel(scriptDir).replace(/\/+$/, '')
  const pushFile = (abs, name) => {
    if (!isAsset(name)) return
    const absNorm = normRel(abs)
    const rel = absNorm.indexOf(dirNorm + '/') === 0 ? absNorm.slice(dirNorm.length + 1) : name
    if (assets.has(rel)) return
    assets.set(rel, { absPath: abs, mime: mimeOf(name) })
    const key = name.toLowerCase()
    if (!byBase.has(key)) byBase.set(key, rel)
  }
  let rootEntries = []
  try { const t = await fs.resolve(scriptDir, { signal }); const info = await fs.stat(t, signal); if (info && info.type === 'directory') rootEntries = await fs.listDir(t, signal) } catch { rootEntries = [] }
  for (const e of rootEntries) if (e.type === 'file') pushFile(joinPath(scriptDir, e.name), e.name)
  for (const e of rootEntries) {
    if (e.type !== 'directory') continue
    const sub = joinPath(scriptDir, e.name)
    let subEntries = []
    try { const t = await fs.resolve(sub, { signal }); subEntries = await fs.listDir(t, signal) } catch { continue }
    if (subEntries.length > 400) continue
    for (const se of subEntries) {
      if (se.type === 'file') pushFile(joinPath(sub, se.name), se.name)
      else if (se.type === 'directory') {
        const lname = String(se.name).toLowerCase()
        if (!/^(sprites?|images?|imgs?|bg|backgrounds?|characters?|audio|music|assets?|img_human|img_bg|img_cg|立绘|背景|音频|音乐)$/.test(lname)) continue
        const sub2 = joinPath(sub, se.name)
        let sub2Entries = []
        try { const t2 = await fs.resolve(sub2, { signal }); sub2Entries = await fs.listDir(t2, signal) } catch { continue }
        if (sub2Entries.length > 400) continue
        for (const s2e of sub2Entries) if (s2e.type === 'file') pushFile(joinPath(sub2, s2e.name), s2e.name)
      }
    }
  }
  return { assets, byBase }
}

function resolveRef(ref, scan) {
  const r = normRel(ref)
  if (scan.assets.has(r)) return r
  const key = baseOf(ref).toLowerCase()
  if (scan.byBase.has(key)) return scan.byBase.get(key)
  return null
}

function bytesToBase64(bytes) {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  }
  return btoa(bin)
}

// Standalone web page template: embedded assets + player (9-slot save/load,
// speaker-following sprites, BGM with volume, if-line branching).
const STANDALONE_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>@@TITLE@@</title>
<style>
html,body{margin:0;padding:0;height:100%;background:#0b0e14;color:#e8eaf0;font-family:'PingFang SC','Microsoft YaHei',system-ui,sans-serif}
#gg{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden}
.gg-stage{position:relative;flex:1;overflow:hidden}
.gg-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.gg-bg-empty{background:linear-gradient(160deg,#1a2332 0%,#2d3b52 55%,#4a5d7a 100%)}
.gg-sprites{position:absolute;inset:0;pointer-events:none}
.gg-sprite{position:absolute;bottom:0;height:76%;max-height:86vh;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.45));opacity:1;transition:opacity .35s ease;pointer-events:none}
.gg-sprite.gg-hidden{opacity:0}
.gg-pos-left{left:8%}
.gg-pos-center{left:50%;transform:translateX(-50%)}
.gg-pos-right{right:8%}
.gg-avatar{display:flex;align-items:center;justify-content:center;width:200px;height:200px;border-radius:50%;background:linear-gradient(145deg,#3a4a68,#232e44);color:#cfe0ff;font-size:64px;font-weight:700}
.gg-dialog{position:absolute;left:4%;right:4%;bottom:2.5%;min-height:132px;padding:16px 22px;background:rgba(10,14,22,.88);border:1px solid rgba(255,255,255,.12);border-radius:14px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.gg-speaker{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.gg-speaker-name{color:#ffd28a;font-weight:700;font-size:18px}
.gg-speaker-caret{color:#ffd28a;font-size:12px}
.gg-line{font-size:19px;line-height:1.7;min-height:40px;white-space:pre-wrap;word-break:break-word}
.gg-choices{position:absolute;left:50%;top:34%;transform:translateX(-50%);display:flex;flex-direction:column;gap:12px;width:min(520px,88%)}
.gg-choice{padding:14px 22px;background:rgba(15,20,32,.92);border:1px solid rgba(255,255,255,.18);border-radius:12px;color:#fff;font-size:17px;cursor:pointer;text-align:center;transition:all .15s}
.gg-choice:hover{background:#2b3f66;transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.4)}
.gg-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;background:rgba(8,11,18,.85);border-bottom:1px solid rgba(255,255,255,.08);z-index:5}
.gg-title-mini{font-weight:700;color:#ffd28a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gg-topbar-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.gg-tbtn{background:transparent;border:1px solid transparent;color:#c9d2e0;padding:5px 10px;border-radius:8px;cursor:pointer;font-size:13px}
.gg-tbtn:hover{background:rgba(255,255,255,.1)}
.gg-tbtn.gg-on{background:rgba(255,210,138,.18);color:#ffd28a}
.gg-title{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:30px;text-align:center;background:radial-gradient(1200px 600px at 50% -10%,#2a3b5c 0%,#0b0e14 65%)}
.gg-title-text{font-size:44px;margin:0;letter-spacing:4px;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.6)}
.gg-intro{color:#aab6c8;max-width:560px;line-height:1.8;font-size:15px;margin:0}
.gg-cast{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:6px}
.gg-cast-item{display:flex;flex-direction:column;align-items:center;gap:8px}
.gg-cast-img{width:96px;height:96px;object-fit:cover;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:#1c2536}
.gg-cast-avatar{display:flex;align-items:center;justify-content:center;font-size:40px;color:#cfe0ff}
.gg-cast-name{font-size:14px;color:#dbe4f0}
.gg-title-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:10px}
.gg-btn{padding:11px 26px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#1d2a40;color:#fff;font-size:16px;cursor:pointer;transition:all .15s}
.gg-btn:hover{transform:translateY(-2px)}
.gg-btn-primary{background:linear-gradient(135deg,#e88a3a,#ffb95c);border-color:transparent;color:#231303;font-weight:700}
.gg-end{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(900px 500px at 50% 20%,#2b2540 0%,#0b0e14 70%)}
.gg-end-mark{font-size:18px;letter-spacing:10px;color:#b9a6ff}
.gg-end-title{font-size:38px;color:#ffe9c9;margin:0;letter-spacing:3px}
.gg-modal{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:20;padding:20px}
.gg-modal-box{width:min(640px,92%);max-height:80%;background:#141a26;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}
.gg-modal-title{font-weight:700;font-size:17px;color:#ffd28a}
.gg-log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:6px}
.gg-log-item{font-size:14px;line-height:1.7;color:#dbe4f0;border-bottom:1px dashed rgba(255,255,255,.08);padding-bottom:6px}
.gg-log-speaker{color:#ffd28a;font-weight:600}
.gg-log-empty{color:#8a94a8}
.gg-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;overflow:auto;max-height:52vh}
.gg-slot{padding:12px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#1a2233;color:#dbe4f0;font-size:12px;cursor:pointer;text-align:left;line-height:1.5}
.gg-slot:hover{background:#2b3f66}
.gg-slot-empty{color:#8a94a8}
.gg-slot-disabled{opacity:.45;cursor:not-allowed}
.gg-slot-disabled:hover{background:#1a2233}
.gg-slot-num{color:#ffd28a;font-weight:700}
.gg-flash{position:absolute;left:50%;top:12%;transform:translateX(-50%);background:rgba(20,28,44,.95);border:1px solid rgba(255,255,255,.2);color:#ffe9c9;padding:8px 18px;border-radius:20px;font-size:14px;z-index:30;animation:gg-fadein .25s ease}
.gg-cg{position:absolute;inset:0;z-index:15;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer}
.gg-cg-media{max-width:100%;max-height:100%;object-fit:contain}
.gg-cg-hint{position:absolute;bottom:6%;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.78);font-size:13px;background:rgba(0,0,0,.5);padding:6px 16px;border-radius:999px}
@keyframes gg-fadein{from{opacity:0}to{opacity:1}}
</style>
</head>
<body>
<div id="gg"></div>
<script>
var GAME = @@GAME_JSON@@;
(function () {
  'use strict';
  var app = document.getElementById('gg');
  var S = { phase: 'title', idx: 0, vars: {}, bg: null, sprites: {}, locked: {}, faces: {}, positions: {}, bgm: null, bgmVol: 1, backlog: [], line: null, typed: '', done: true, choices: null, ending: '', cgState: null, auto: false, fast: false, muted: false };
  var audioEl = null, typeTimer = null, autoTimer = null, flashTimer = null, flashMsg = '', showLog = false, slotMode = null, saves = {};
  var SAVE_KEY = 'galgame.saves.' + (GAME.id || 'game');
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { return typeof v === 'number' ? v : 0; }
  function flash(m) { flashMsg = m; render(); clearTimeout(flashTimer); flashTimer = setTimeout(function () { flashMsg = ''; render(); }, 1300); }
  function readSaves() { try { var r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
  function saveToSlot(n) {
    try {
      var sv = readSaves();
      sv[String(n)] = { idx: S.idx, bg: S.bg, sprites: S.sprites, locked: S.locked, faces: S.faces, positions: S.positions, bgm: S.bgm, bgmVol: S.bgmVol, backlog: S.backlog, vars: S.vars, time: Date.now(), label: (S.line && S.line.text ? S.line.text.slice(0, 12) : '') };
      localStorage.setItem(SAVE_KEY, JSON.stringify(sv));
      saves = sv; slotMode = null; flash('已存入槽位 ' + n);
    } catch (e) { flash('存档失败（浏览器限制）'); }
  }
  function loadFromSlot(n) {
    var sv = readSaves();
    var save = sv[String(n)];
    if (!save) return;
    S.bg = save.bg || null; S.sprites = save.sprites || {}; S.locked = save.locked || {}; S.faces = save.faces || {}; S.positions = save.positions || {}; S.bgm = save.bgm || null; S.bgmVol = save.bgmVol || 1;
    S.backlog = Array.isArray(save.backlog) ? save.backlog : []; S.vars = save.vars || {};
    slotMode = null; S.phase = 'play'; S.auto = false; runFrom(save.idx);
  }
  function openSlots(mode) { saves = readSaves(); slotMode = mode; render(); }
  function closeCg() {
    S.cgState = null;
    render();
    runFrom(S.idx + 1);
  }
  function cgHtml() {
    var c = S.cgState;
    if (!c) return '';
    var inner = '<img class="gg-cg-media" src="' + esc(c.url || '') + '" alt="">';
    if (/\.(mp4|webm|ogg|m4a|avi)$/i.test(c.url || '')) inner = '<video class="gg-cg-media" src="' + esc(c.url) + '" autoplay muted' + (c.type === 'cg' ? ' loop' : '') + '></video>';
    return '<div class="gg-cg" data-act="closecg">' + inner + '<div class="gg-cg-hint">' + (c.type === 'cg' ? '点击继续' : '点击跳过') + '</div></div>';
  }
  function variantOf(name) {
    var ch = GAME.characters && GAME.characters[name];
    if (!ch) return null;
    var face = S.faces[name] || '';
    var v = ch.variants ? (ch.variants[face] || ch.variants[''] || null) : null;
    return v || ch;
  }
  function syncSprites(speaker) {
    var autoOn = {};
    if (speaker && GAME.characters && GAME.characters[speaker]) autoOn[speaker] = true;
    for (var name in GAME.characters) {
      var want = !!autoOn[name] || !!S.locked[name];
      var cur = S.sprites[name];
      if (want) {
        var c = variantOf(name);
        S.sprites[name] = { url: (c && c.url) || null, pos: S.positions[name] || (c && c.pos) || 'center', visible: true, name: name };
      } else if (cur) {
        S.sprites[name].visible = false;
      }
    }
  }
  function runFrom(start) {
    var nodes = GAME.nodes, i = start, guard = 0;
    while (i >= 0 && i < nodes.length && guard++ < 8000) {
      var n = nodes[i];
      if (n.type === 'say') {
        S.idx = i; S.backlog.push({ speaker: n.speaker, text: n.text });
        if (S.backlog.length > 600) S.backlog.shift();
        syncSprites(n.speaker);
        S.choices = null; S.line = { speaker: n.speaker, text: n.text }; startTyping(); render(); return;
      }
      if (n.type === 'choice') { S.idx = i; S.choices = n.options || []; S.line = null; render(); return; }
      if (n.type === 'end') { S.bgm = null; S.ending = n.name || '结局'; S.phase = 'end'; render(); return; }
      if (n.type === 'bg') { var b = GAME.backgrounds[n.bg]; S.bg = (b && b.url) || (GAME.assetUrls[n.bg] || null); i++; continue; }
      if (n.type === 'sprite') {
        if (n.action === 'hide') { delete S.locked[n.char]; if (S.sprites[n.char]) S.sprites[n.char].visible = false; }
        else { S.locked[n.char] = true; var c2 = variantOf(n.char); S.sprites[n.char] = { url: (c2 && c2.url) || null, pos: n.pos || S.positions[n.char] || (c2 && c2.pos) || 'center', visible: true, name: n.char }; }
        i++; continue;
      }
      if (n.type === 'pos') {
        S.positions[n.char] = n.pos;
        var curp = S.sprites[n.char];
        if (curp) curp.pos = n.pos;
        i++; continue;
      }
      if (n.type === 'face') {
        S.faces[n.char] = n.variant || '';
        var cur = S.sprites[n.char];
        if (cur) { var c3 = variantOf(n.char); cur.url = (c3 && c3.url) || null; }
        i++; continue;
      }
      if (n.type === 'bgm') { S.bgm = n.file ? (GAME.assetUrls[n.file] || null) : null; if (n.vol != null) S.bgmVol = n.vol; i++; continue; }
      if (n.type === 'op' || n.type === 'cg' || n.type === 'ed') {
        S.idx = i;
        S.cgState = { type: n.type, url: n.file ? (GAME.assetUrls[n.file] || null) : null };
        render(); return;
      }
      if (n.type === 'jump') {
        if (n.target === null || n.target === undefined) { S.bgm = null; S.ending = '（剧情中断）'; S.phase = 'end'; render(); return; }
        i = n.target; continue;
      }
      if (n.type === 'jumpIf') {
        var v = S.vars[n.var], pass = false;
        if (n.op === 'truthy') pass = !!v;
        else if (n.op === '=') pass = v == n.val;
        else if (n.op === '!=') pass = v != n.val;
        else if (n.op === '>') pass = v > n.val;
        else if (n.op === '>=') pass = v >= n.val;
        else if (n.op === '<') pass = v < n.val;
        else if (n.op === '<=') pass = v <= n.val;
        if (!pass) { i = (n.target === null || n.target === undefined) ? i + 1 : n.target; continue; }
        i++; continue;
      }
      if (n.type === 'var') {
        var cur = S.vars[n.name];
        if (n.op === '=') S.vars[n.name] = n.val;
        else if (n.op === '+') S.vars[n.name] = num(cur) + n.val;
        else if (n.op === '-') S.vars[n.name] = num(cur) - n.val;
        else S.vars[n.name] = n.val;
        i++; continue;
      }
      i++;
    }
    S.bgm = null; S.phase = 'end'; S.ending = ''; render();
  }
  function startTyping() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
    if (!S.line) return;
    S.typed = ''; S.done = false;
    var full = S.line.text || '';
    if (!full) { S.typed = ''; S.done = true; render(); return; }
    var total = Math.max(150, full.length * (S.fast ? 6 : 22));
    var started = Date.now();
    typeTimer = setInterval(function () {
      var el = Date.now() - started;
      if (el >= total) { S.typed = full; S.done = true; clearInterval(typeTimer); typeTimer = null; render(); }
      else { S.typed = full.slice(0, Math.floor(full.length * (el / total))); var ln = document.getElementById('gg-line'); if (ln) ln.textContent = S.typed; }
    }, 40);
  }
  function completeTyping() { if (typeTimer) { clearInterval(typeTimer); typeTimer = null; } S.typed = S.line ? S.line.text : ''; S.done = true; render(); }
  function advance() { if (S.phase !== 'play') return; if (!S.done) { completeTyping(); return; } runFrom(S.idx + 1); }
  function choose(o) { var t = (o.target !== null && o.target !== undefined) ? o.target : S.idx + 1; S.choices = null; runFrom(t); }
  function startGame() { S.phase = 'play'; S.auto = false; S.vars = {}; S.sprites = {}; S.locked = {}; S.faces = {}; S.positions = {}; S.bgmVol = 1; runFrom(0); }
  function goTitle() { S.ending = ''; S.phase = 'title'; render(); }
  function ensureAudio() {
    if (!S.bgm) { if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); } return; }
    if (!audioEl) { audioEl = document.createElement('audio'); audioEl.loop = true; document.body.appendChild(audioEl); }
    if (audioEl.getAttribute('src') !== S.bgm) { audioEl.src = S.bgm; audioEl.muted = S.muted; var p = audioEl.play(); if (p && p.catch) p.catch(function () {}); }
    audioEl.muted = S.muted;
    audioEl.volume = S.bgmVol || 1;
  }
  function scheduleAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (S.auto && S.phase === 'play' && S.done && S.line && !S.choices && !slotMode) {
      autoTimer = setTimeout(function () { autoTimer = null; if (S.auto) advance(); }, S.fast ? 350 : 1100);
    }
  }
  function btn(label, act, title, active) { return '<button class="gg-tbtn' + (active ? ' gg-on' : '') + '" data-act="' + act + '" title="' + esc(title || '') + '">' + label + '</button>'; }
  function topbarHtml() {
    var h = '<div class="gg-topbar"><span class="gg-title-mini">' + esc(GAME.title || '') + '</span><div class="gg-topbar-actions">';
    h += btn('💾 存档', 'save', '保存到槽位');
    h += btn('📂 读档', 'load', '从槽位读取');
    h += btn('📜 历史', 'log', '查看已读内容');
    h += btn(S.auto ? '⏸ 自动' : '▶ 自动', 'auto', '自动播放', S.auto);
    h += btn('⏩ 快进', 'fast', '快进模式', S.fast);
    h += btn(S.muted ? '🔇 音乐' : '🔊 音乐', 'mute', '背景音乐开关', S.muted);
    h += '</div></div>';
    return h;
  }
  function spriteHtml(name, s) {
    var cls = 'gg-sprite gg-pos-' + (s.pos || 'center') + (s.visible === false ? ' gg-hidden' : '');
    if (s.url) return '<img class="' + cls + '" src="' + esc(s.url) + '" alt="' + esc(name) + '">';
    return '<div class="' + cls + ' gg-avatar">' + esc(String(name || '?').slice(0, 1)) + '</div>';
  }
  function stageHtml() {
    var h = '<div class="gg-stage">';
    h += S.bg ? '<img class="gg-bg" src="' + esc(S.bg) + '" alt="">' : '<div class="gg-bg gg-bg-empty"></div>';
    h += '<div class="gg-sprites">';
    for (var k in S.sprites) h += spriteHtml(k, S.sprites[k]);
    h += '</div>';
    if (S.choices) {
      h += '<div class="gg-choices">';
      for (var ci = 0; ci < S.choices.length; ci++) h += '<button class="gg-choice" data-act="choose" data-arg="' + ci + '">' + esc(S.choices[ci].text) + '</button>';
      h += '</div>';
    }
    if (S.line) {
      h += '<div class="gg-dialog" data-act="advance">';
      if (S.line.speaker) h += '<div class="gg-speaker"><span class="gg-speaker-name">' + esc(S.line.speaker) + '</span><span class="gg-speaker-caret">▼</span></div>';
      h += '<div class="gg-line" id="gg-line">' + esc(S.typed) + '</div></div>';
    }
    h += '</div>';
    return h;
  }
  function titleHtml() {
    var h = '<div class="gg-title"><h1 class="gg-title-text">' + esc(GAME.title || '未命名游戏') + '</h1>';
    if (GAME.intro) h += '<p class="gg-intro">' + esc(GAME.intro) + '</p>';
    var names = Object.keys(GAME.characters || {});
    if (names.length) {
      h += '<div class="gg-cast">';
      for (var k = 0; k < names.length; k++) {
        var c = GAME.characters[names[k]];
        h += '<div class="gg-cast-item">' + (c.url ? '<img class="gg-cast-img" src="' + esc(c.url) + '" alt="' + esc(names[k]) + '">' : '<div class="gg-cast-img gg-cast-avatar">' + esc(names[k].slice(0, 1)) + '</div>') + '<span class="gg-cast-name">' + esc(names[k]) + '</span></div>';
      }
      h += '</div>';
    }
    h += '<div class="gg-title-btns"><button class="gg-btn gg-btn-primary" data-act="start">▶ 开始游戏</button>';
    if (Object.keys(readSaves()).length) h += '<button class="gg-btn" data-act="openslots-load">⏵ 继续游戏（读档）</button>';
    h += '</div></div>';
    return h;
  }
  function endHtml() {
    var h = '<div class="gg-end"><div class="gg-end-mark">— END —</div><h2 class="gg-end-title">' + esc(S.ending || '结局') + '</h2>';
    h += '<div class="gg-title-btns"><button class="gg-btn gg-btn-primary" data-act="title">回到标题</button></div></div>';
    return h;
  }
  function logHtml() {
    var h = '<div class="gg-modal"><div class="gg-modal-box gg-logbox"><div class="gg-modal-title">历史记录</div><div class="gg-log">';
    if (!S.backlog.length) h += '<div class="gg-log-empty">（暂无记录）</div>';
    for (var i = 0; i < S.backlog.length; i++) {
      var b = S.backlog[i];
      h += '<div class="gg-log-item">' + (b.speaker ? '<span class="gg-log-speaker">' + esc(b.speaker) + '：</span>' : '') + '<span>' + esc(b.text) + '</span></div>';
    }
    h += '</div><button class="gg-btn gg-btn-primary" data-act="log">关闭</button></div></div>';
    return h;
  }
  function slotHtml() {
    var h = '<div class="gg-modal"><div class="gg-modal-box"><div class="gg-modal-title">' + (slotMode === 'save' ? '选择存档槽位' : '选择读档槽位') + '</div><div class="gg-slots">';
    for (var n = 1; n <= (GAME.saveSlots || 9); n++) {
      var s = saves[String(n)];
      var has = !!s;
      var cls = 'gg-slot' + (has ? '' : ' gg-slot-empty') + (slotMode === 'load' && !has ? ' gg-slot-disabled' : '');
      var label = '<span class="gg-slot-num">槽位 ' + n + '</span><br>' + (has ? '第' + esc(s.label || '') + ' · ' + new Date(s.time).toLocaleString() : '（空）');
      h += '<button class="' + cls + '" data-act="slot" data-arg="' + n + '">' + label + '</button>';
    }
    h += '</div><button class="gg-btn gg-btn-primary" data-act="closeslots">关闭</button></div></div>';
    return h;
  }
  function render() {
    var h = '';
    if (S.phase === 'play') h += topbarHtml();
    if (S.phase === 'title') h += titleHtml();
    else if (S.phase === 'end') h += endHtml();
    else h += stageHtml();
    if (showLog) h += logHtml();
    if (slotMode) h += slotHtml();
    if (S.cgState) h += cgHtml();
    if (flashMsg) h += '<div class="gg-flash">' + esc(flashMsg) + '</div>';
    app.innerHTML = h;
    ensureAudio();
    scheduleAuto();
    var v = document.querySelector('.gg-cg-media');
    if (v && v.tagName === 'VIDEO') v.addEventListener('ended', function () { closeCg(); }, { once: true });
  }
  app.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== app && !t.getAttribute('data-act')) t = t.parentNode;
    if (!t || t === app) return;
    var act = t.getAttribute('data-act');
    if (act === 'advance') advance();
    else if (act === 'start') startGame();
    else if (act === 'openslots-load') openSlots('load');
    else if (act === 'title') goTitle();
    else if (act === 'save') openSlots('save');
    else if (act === 'load') openSlots('load');
    else if (act === 'log') { showLog = !showLog; render(); }
    else if (act === 'closeslots') { slotMode = null; render(); }
    else if (act === 'closecg') closeCg();
    else if (act === 'slot') { var n = Number(t.getAttribute('data-arg')); if (slotMode === 'save') saveToSlot(n); else if (saves[String(n)]) loadFromSlot(n); }
    else if (act === 'auto') { S.auto = !S.auto; scheduleAuto(); render(); }
    else if (act === 'fast') { S.fast = !S.fast; render(); }
    else if (act === 'mute') { S.muted = !S.muted; ensureAudio(); render(); }
    else if (act === 'choose') { var o = S.choices[Number(t.getAttribute('data-arg'))]; if (o) choose(o); }
  });
  document.addEventListener('keydown', function (e) {
    if (S.phase !== 'play') return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
  });
  render();
})();
</script>
</body>
</html>`

async function buildStandaloneHtml(fs, game, scan, signal) {
  const g2 = JSON.parse(JSON.stringify(game))
  const dataUrls = {}
  for (const relId of scan.assets.keys()) {
    const a = scan.assets.get(relId)
    try {
      const target = await fs.resolve(a.absPath, { signal })
      const bytes = await fs.readBytes(target, signal, MAX_ASSET_BYTES)
      dataUrls[relId] = 'data:' + a.mime + ';base64,' + bytesToBase64(bytes)
    } catch { dataUrls[relId] = null }
  }
  for (const name of Object.keys(g2.characters)) {
    const c = g2.characters[name]
    const relId = resolveRef(c.file, scan)
    c.url = relId && dataUrls[relId] ? dataUrls[relId] : null
  }
  for (const name of Object.keys(g2.backgrounds)) {
    const b = g2.backgrounds[name]
    const relId = resolveRef(b.file, scan)
    b.url = relId && dataUrls[relId] ? dataUrls[relId] : null
  }
  for (const relId of Object.keys(g2.assetUrls)) {
    if (dataUrls[relId]) g2.assetUrls[relId] = dataUrls[relId]
  }
  const json = JSON.stringify(g2).replace(/</g, '\\u003c')
  const title = String(g2.title || 'Galgame').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return STANDALONE_TEMPLATE.split('@@TITLE@@').join(title).split('@@GAME_JSON@@').join(json)
}

async function buildGame(fs, scriptPath, signal) {
  const text = await readText(fs, scriptPath, signal)
  const parsed = parseScript(text)
  const scriptDir = dirOf(scriptPath)
  const scan = await collectAssets(fs, scriptDir, signal)

  const used = []
  const addUsed = (relId) => { if (relId && scan.assets.has(relId) && used.indexOf(relId) < 0) used.push(relId) }
  const assetUrl = (relId) => relId ? ASSET_PREFIX + '/' + encPath(relId) : null

  const characters = {}
  for (const name of Object.keys(parsed.characters)) {
    const g = parsed.characters[name]
    const variants = {}
    let defUrl = null
    let defFile = null
    for (const v of Object.keys(g.variants)) {
      const c = g.variants[v]
      const relId = resolveRef(c.file, scan)
      if (!relId) parsed.warnings.push('角色「' + name + (v ? '·' + v : '') + '」的立绘文件找不到：' + c.file)
      addUsed(relId)
      variants[v] = { file: c.file, pos: c.pos || g.pos, url: assetUrl(relId), found: !!relId }
      if (!v) { defUrl = assetUrl(relId); defFile = c.file }
    }
    characters[name] = { name, pos: g.pos, variants, url: defUrl, file: defFile }
  }
  const backgrounds = {}
  for (const name of Object.keys(parsed.backgrounds)) {
    const b = parsed.backgrounds[name]
    const relId = resolveRef(b.file, scan)
    if (!relId) parsed.warnings.push('背景「' + name + '」的图片找不到：' + b.file)
    addUsed(relId)
    backgrounds[name] = { name, file: b.file, url: assetUrl(relId), found: !!relId }
  }
  for (const n of parsed.nodes) {
    if ((n.type === 'bgm' || n.type === 'op' || n.type === 'cg' || n.type === 'ed') && n.file) {
      const relId = resolveRef(n.file, scan)
      if (!relId) parsed.warnings.push('媒体文件找不到：' + n.file + '（第' + n.line + '行）')
      n.file = relId || n.file
    }
  }
  const assetUrls = {}
  for (const relId of scan.assets.keys()) assetUrls[relId] = assetUrl(relId)

  const id = 'game-' + Date.now().toString(36)
  const title = parsed.title || baseOf(scriptPath).replace(/\.[^.]+$/, '')
  const endings = []
  for (const n of parsed.nodes) if (n.type === 'end') { const en = n.name || '结局'; if (endings.indexOf(en) < 0) endings.push(en) }
  const game = {
    id, title, intro: parsed.intro, scriptPath,
    characters, backgrounds, nodes: parsed.nodes, assetUrls,
    saveSlots: parsed.saveSlots || 9,
    output: parsed.output || 'html',
    stats: {
      nodes: parsed.nodes.length,
      lines: parsed.nodes.filter((n) => n.type === 'say').length,
      choices: parsed.nodes.filter((n) => n.type === 'choice').length,
      endings,
      vars: parsed.nodes.filter((n) => n.type === 'var').length,
      ifs: parsed.nodes.filter((n) => n.type === 'jumpIf').length,
    },
  }
  const assets = new Map()
  for (const relId of scan.assets.keys()) assets.set(relId, scan.assets.get(relId))
  games.set(id, { game, assets, scriptPath })
  latestGameId = id
  const standaloneHtml = await buildStandaloneHtml(fs, game, scan, signal)
  return { game, parsed, standaloneHtml }
}

export function apply(ctx) {
  const fs = ctx.get('fs')
  const webServer = ctx.get('webServer')
  if (!fs || !webServer) return

  const scanTool = defineTool({
    name: 'galgame_scan',
    description: '扫描一个目录，列出可作为 Galgame 剧本的脚本文件（.md/.markdown/.txt）以及目录里的图片/音频资源，供后续 galgame_build 使用。',
    parameters: {
      dir: { type: 'string', required: true, description: '要扫描的目录的绝对路径' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (args, exec) => {
      const dir = String((args && args.dir) || '').trim()
      if (!dir) return { ok: false, error: '缺少 dir 参数' }
      const scripts = []
      const images = []
      const audio = []
      const subdirs = []
      let entries = []
      try {
        const t = await fs.resolve(dir, { signal: exec.signal })
        const info = await fs.stat(t, exec.signal)
        if (!info || info.type !== 'directory') return { ok: false, error: '目录不存在或不是目录：' + dir }
        entries = await fs.listDir(t, exec.signal)
      } catch (e) { return { ok: false, error: '无法读取目录 ' + dir + '：' + String((e && e.message) || e) } }
      for (const e of entries) {
        if (e.type === 'directory') subdirs.push(e.name)
        else if (/\.(md|markdown|txt)$/i.test(e.name)) scripts.push(e.name)
        else if (isImg(e.name)) images.push(e.name)
        else if (isAud(e.name)) audio.push(e.name)
      }
      return { ok: true, dir, scripts, images, audio, subdirs, hint: '用 galgame_build 传入 scriptPath 即可生成游戏' }
    },
  })
  ctx.tools.register(scanTool)

  const buildTool = defineTool({
    name: 'galgame_build',
    description: '根据剧本文档生成一个可玩的 Galgame：解析剧本（标题/角色/背景/台词/选项分支/跳转/结局/变量与 if 条件线），把立绘与背景图片注册为浏览器可访问资源，游戏存入内存供播放器加载，并导出一个自包含的独立网页（.galgame.html，双击即可玩，9 槽位存档读档）。立绘默认自动跟随说话人（谁说话显示谁、旁白全隐藏、切换淡入淡出），[show]/[hide] 指令可显式锁定。背景音乐用 [bgm 音乐.mp3] 播放（循环）、[bgm off]/[bgm stop] 停止、[bgm 音乐.mp3 0.5] 可带音量。剧本格式：首行 "# 标题"；"## 角色" 区写 "名字: 立绘.png [@ left|center|right]"；"## 背景" 区写 "背景名: 图片.png"；"## 剧本" 区写台词 "名字: 台词"、旁白（纯文本或（括号））、指令 [bg 背景名]、[show 名字]、[hide 名字]、[bgm 音乐.mp3|off]、[变量 名字 = 值] / [变量 名字 + 1]、[if 变量 >= 2] … [else] … [endif]、[选项] 后跟 "- 选项文本 → 标签"、[跳转 标签]、[结束 结局名]，用 "### 标签名" 定义跳转点。素材约定：剧本文档放工作区根目录，人物立绘放 img_human/，背景图片放 img_bg/，音乐放 audio/。生成后可在侧边栏底部点击「🎮 Galgame」在界面内游玩，或直接打开导出的 HTML 网页。',
    parameters: {
      scriptPath: { type: 'string', required: true, description: '剧本文档的绝对路径（.md 或 .txt）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: async (args, exec) => {
      const scriptPath = String((args && args.scriptPath) || '').trim()
      if (!scriptPath) return { ok: false, error: '缺少 scriptPath 参数' }
      try {
        const { game, parsed, standaloneHtml } = await buildGame(fs, scriptPath, exec.signal)
        const writePolicy = { mode: 'workspace-write', workspaceRoot: dirOf(scriptPath) }
        let saved = null
        try {
          const outPath = joinPath(dirOf(scriptPath), (game.title || 'galgame') + '.galgame.json')
          const target = await fs.resolve(outPath, { signal: exec.signal })
          await fs.writeText(target, JSON.stringify({ title: game.title, intro: game.intro, characters: game.characters, backgrounds: game.backgrounds, nodes: game.nodes }, null, 2), undefined, exec.signal, writePolicy)
          saved = outPath
        } catch { saved = null }
        let htmlSaved = null
        try {
          const outPath2 = joinPath(dirOf(scriptPath), (game.title || 'galgame') + '.galgame.html')
          const target2 = await fs.resolve(outPath2, { signal: exec.signal })
          await fs.writeText(target2, standaloneHtml, undefined, exec.signal, writePolicy)
          htmlSaved = outPath2
        } catch { htmlSaved = null }
        if (game.output === 'exe') {
          parsed.warnings.push('[输出 exe] 暂未支持，已按 html 输出')
        }
        return {
          ok: true,
          gameId: game.id,
          title: game.title,
          scriptPath,
          saved,
          htmlSaved,
          standalone: !!htmlSaved,
          output: game.output,
          saveSlots: game.saveSlots,
          stats: game.stats,
          characters: Object.keys(game.characters).map((k) => ({ name: game.characters[k].name, file: game.characters[k].file || (game.characters[k].variants[''] && game.characters[k].variants[''].file) || '', variants: Object.keys(game.characters[k].variants).filter(Boolean), found: !!game.characters[k].url })),
          backgrounds: Object.keys(game.backgrounds).map((k) => ({ name: game.backgrounds[k].name, file: game.backgrounds[k].file, found: game.backgrounds[k].found })),
          assetCount: Object.keys(game.assetUrls).length,
          warnings: parsed.warnings.slice(0, 20),
          errors: parsed.errors.slice(0, 20),
          next: htmlSaved ? '双击打开导出的 ' + (game.title || 'galgame') + '.galgame.html 即可在浏览器游玩；或在侧边栏底部点「🎮 Galgame」在界面内游玩' : '侧边栏底部点击「🎮 Galgame」打开播放器即可游玩',
        }
      } catch (e) {
        return { ok: false, error: '生成失败：' + String((e && e.message) || e) }
      }
    },
  })
  ctx.tools.register(buildTool)

  // The web player fetches the latest game JSON here.
  const disposeLoad = webServer.register({
    kind: 'exact',
    path: '/galgame/api/load',
    handler: async (req, res) => {
      try {
        const entry = latestGameId ? games.get(latestGameId) : undefined
        if (!entry) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'no game built yet' }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: true, game: entry.game }))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }))
      }
    },
  })
  ctx.effect(() => disposeLoad)

  // Asset route: prefix WITHOUT trailing slash (same convention as /plugins).
  const disposeRoute = webServer.register({
    kind: 'prefix',
    path: ASSET_PREFIX,
    handler: async (req, res) => {
      let responded = false
      const fail = (code, msg) => {
        if (responded) return
        responded = true
        try { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(msg || '')) } catch {}
      }
      try {
        const raw = String(req.url || '/')
        const q = raw.indexOf('?')
        const pathname = q >= 0 ? raw.slice(0, q) : raw
        const rest = pathname.slice(ASSET_PREFIX.length).replace(/^\/+/, '')
        if (!rest) return fail(404, 'not found')
        let decoded = ''
        try { decoded = decodeURIComponent(rest) } catch { return fail(400, 'bad path') }
        let found = null
        for (const entry of games.values()) {
          const a = entry.assets.get(decoded)
          if (a) { found = a; break }
        }
        if (!found) return fail(404, 'asset not found')
        const target = await fs.resolve(found.absPath)
        const bytes = await fs.readBytes(target, undefined, MAX_ASSET_BYTES)
        if (responded) return
        responded = true
        res.writeHead(200, {
          'Content-Type': found.mime,
          'Content-Length': bytes.length,
          'Cache-Control': 'public, max-age=3600',
        })
        res.end(bytes)
      } catch (e) {
        fail(500, 'asset error: ' + String((e && e.message) || e))
      }
    },
  })
  ctx.effect(() => disposeRoute)
}
