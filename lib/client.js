/* dsh-galgame-generator — client bundle (web platform).
 *
 * A full visual-novel player for the DSH web GUI:
 *   - a 🎮 Galgame button in the sidebar footer (sidebar.footer.action),
 *   - a full-screen overlay player (shell.overlay) with:
 *       title screen / dialogue / speaker-following sprites (smooth fade,
 *       narration hides everyone, [show]/[hide] locks) / choices / endings,
 *       BGM with per-scene volume, auto & skip, backlog, and a 9-slot
 *       save/load panel (localStorage, includes vars).
 *
 * Game data is fetched from the host route /galgame/api/load (lib/index.js);
 * sprites/backgrounds/BGM are served under /galgame/assets/*.
 */
window.__ModuleLoader__.load({
  id: 'dsh-galgame-generator',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');

    var CSS =
      '.gg-overlay{position:fixed;inset:0;z-index:9999;background:#0b0e14;color:#e8eaf0;font-family:\'PingFang SC\',\'Microsoft YaHei\',system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;pointer-events:auto}' +
      '.gg-stage{position:relative;flex:1;overflow:hidden}' +
      '.gg-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '.gg-bg-empty{background:linear-gradient(160deg,#1a2332 0%,#2d3b52 55%,#4a5d7a 100%)}' +
      '.gg-sprites{position:absolute;inset:0;pointer-events:none}' +
      '.gg-sprite{position:absolute;bottom:0;height:76%;max-height:86vh;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.45));opacity:1;transition:opacity .35s ease;pointer-events:none}' +
      '.gg-sprite.gg-hidden{opacity:0}' +
      '.gg-pos-left{left:8%}' +
      '.gg-pos-center{left:50%;transform:translateX(-50%)}' +
      '.gg-pos-right{right:8%}' +
      '.gg-avatar{display:flex;align-items:center;justify-content:center;width:200px;height:200px;border-radius:50%;background:linear-gradient(145deg,#3a4a68,#232e44);color:#cfe0ff;font-size:64px;font-weight:700}' +
      '.gg-dialog{position:absolute;left:4%;right:4%;bottom:2.5%;min-height:132px;padding:16px 22px;background:rgba(10,14,22,.88);border:1px solid rgba(255,255,255,.12);border-radius:14px;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 10px 30px rgba(0,0,0,.4)}' +
      '.gg-speaker{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
      '.gg-speaker-name{color:#ffd28a;font-weight:700;font-size:18px}' +
      '.gg-speaker-caret{color:#ffd28a;font-size:12px}' +
      '.gg-line{font-size:19px;line-height:1.7;min-height:40px;white-space:pre-wrap;word-break:break-word}' +
      '.gg-choices{position:absolute;left:50%;top:34%;transform:translateX(-50%);display:flex;flex-direction:column;gap:12px;width:min(520px,88%)}' +
      '.gg-choice{padding:14px 22px;background:rgba(15,20,32,.92);border:1px solid rgba(255,255,255,.18);border-radius:12px;color:#fff;font-size:17px;cursor:pointer;text-align:center;transition:all .15s}' +
      '.gg-choice:hover{background:#2b3f66;transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.4)}' +
      '.gg-topbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;background:rgba(8,11,18,.85);border-bottom:1px solid rgba(255,255,255,.08);z-index:5}' +
      '.gg-title-mini{font-weight:700;color:#ffd28a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.gg-topbar-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}' +
      '.gg-tbtn{background:transparent;border:1px solid transparent;color:#c9d2e0;padding:5px 10px;border-radius:8px;cursor:pointer;font-size:13px}' +
      '.gg-tbtn:hover{background:rgba(255,255,255,.1)}' +
      '.gg-tbtn.gg-on{background:rgba(255,210,138,.18);color:#ffd28a}' +
      '.gg-title{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:30px;text-align:center;background:radial-gradient(1200px 600px at 50% -10%,#2a3b5c 0%,#0b0e14 65%)}' +
      '.gg-title-text{font-size:44px;margin:0;letter-spacing:4px;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.6)}' +
      '.gg-intro{color:#aab6c8;max-width:560px;line-height:1.8;font-size:15px;margin:0}' +
      '.gg-cast{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:6px}' +
      '.gg-cast-item{display:flex;flex-direction:column;align-items:center;gap:8px}' +
      '.gg-cast-img{width:96px;height:96px;object-fit:cover;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:#1c2536}' +
      '.gg-cast-avatar{display:flex;align-items:center;justify-content:center;font-size:40px;color:#cfe0ff}' +
      '.gg-cast-name{font-size:14px;color:#dbe4f0}' +
      '.gg-title-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:10px}' +
      '.gg-btn{padding:11px 26px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#1d2a40;color:#fff;font-size:16px;cursor:pointer;transition:all .15s}' +
      '.gg-btn:hover{transform:translateY(-2px)}' +
      '.gg-btn-primary{background:linear-gradient(135deg,#e88a3a,#ffb95c);border-color:transparent;color:#231303;font-weight:700}' +
      '.gg-btn-ghost{background:transparent}' +
      '.gg-end{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(900px 500px at 50% 20%,#2b2540 0%,#0b0e14 70%)}' +
      '.gg-end-mark{font-size:18px;letter-spacing:10px;color:#b9a6ff}' +
      '.gg-end-title{font-size:38px;color:#ffe9c9;margin:0;letter-spacing:3px}' +
      '.gg-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#c9d2e0;padding:30px;text-align:center}' +
      '.gg-error{color:#ff9d9d}' +
      '.gg-hint{font-size:13px;color:#8a94a8}' +
      '.gg-modal{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:20;padding:20px}' +
      '.gg-modal-box{width:min(640px,92%);max-height:80%;background:#141a26;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}' +
      '.gg-modal-title{font-weight:700;font-size:17px;color:#ffd28a}' +
      '.gg-log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:6px}' +
      '.gg-log-item{font-size:14px;line-height:1.7;color:#dbe4f0;border-bottom:1px dashed rgba(255,255,255,.08);padding-bottom:6px}' +
      '.gg-log-speaker{color:#ffd28a;font-weight:600}' +
      '.gg-log-empty{color:#8a94a8}' +
      '.gg-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;overflow:auto;max-height:52vh}' +
      '.gg-slot{padding:12px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#1a2233;color:#dbe4f0;font-size:12px;cursor:pointer;text-align:left;line-height:1.5}' +
      '.gg-slot:hover{background:#2b3f66}' +
      '.gg-slot-empty{color:#8a94a8}' +
      '.gg-slot-disabled{opacity:.45;cursor:not-allowed}' +
      '.gg-slot-disabled:hover{background:#1a2233}' +
      '.gg-slot-num{color:#ffd28a;font-weight:700}' +
      '.gg-flash{position:absolute;left:50%;top:12%;transform:translateX(-50%);background:rgba(20,28,44,.95);border:1px solid rgba(255,255,255,.2);color:#ffe9c9;padding:8px 18px;border-radius:20px;font-size:14px;z-index:30;animation:gg-fadein .25s ease}' +
      '.gg-cg{position:absolute;inset:0;z-index:15;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '.gg-cg-media{max-width:100%;max-height:100%;object-fit:contain}' +
      '.gg-cg-hint{position:absolute;bottom:6%;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.78);font-size:13px;background:rgba(0,0,0,.5);padding:6px 16px;border-radius:999px}' +
      '.gg-action{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:none;background:transparent;color:inherit;cursor:pointer;border-radius:8px;font-size:13px;text-align:left}' +
      '.gg-action:hover{background:rgba(128,128,128,.16)}' +
      '.gg-action.gg-on,.gg-action .gg-action-icon{color:#ffb95c}' +
      '.gg-action-icon{font-size:15px}' +
      '.gg-action-label{white-space:nowrap}' +
      '@keyframes gg-fadein{from{opacity:0}to{opacity:1}}';

    // ---------- shared open-state ----------
    var store = {
      open: false,
      subs: [],
      get: function () { return store.open; },
      set: function (v) {
        if (store.open === v) return;
        store.open = v;
        for (var i = 0; i < store.subs.length; i++) { try { store.subs[i](); } catch (e) {} }
      },
      sub: function (fn) {
        store.subs.push(fn);
        return function () { var i = store.subs.indexOf(fn); if (i >= 0) store.subs.splice(i, 1); };
      },
    };

    function useOpen() {
      var s = React.useState(store.get());
      React.useEffect(function () { return store.sub(function () { s[1](store.get()); }); }, []);
      return s[0];
    }

    function SidebarAction(props) {
      var open = useOpen();
      return React.createElement('button', {
        className: 'gg-action' + (open ? ' gg-on' : ''),
        onClick: function () { store.set(!store.get()); },
        title: 'Galgame 播放器（打开/关闭）',
      },
        React.createElement('span', { className: 'gg-action-icon' }, '🎮'),
        props.wide ? React.createElement('span', { className: 'gg-action-label' }, 'Galgame') : null);
    }

    function GalgamePlayer(props) {
      var onClose = props.onClose;
      var phase = React.useState('loading');
      var setPhase = phase[1];
      var game = React.useState(null);
      var setGame = game[1];
      var error = React.useState('');
      var setError = error[1];
      var tick = React.useState(0);
      var setTick = tick[1];
      var eng = React.useRef({ bg: null, sprites: {}, locked: {}, faces: {}, positions: {}, bgm: null, bgmVol: 1, backlog: [], vars: {} });
      var line = React.useState(null);
      var setLine = line[1];
      var typed = React.useState('');
      var setTyped = typed[1];
      var lineDone = React.useState(true);
      var setLineDone = lineDone[1];
      var choices = React.useState(null);
      var setChoices = choices[1];
      var ending = React.useState('');
      var setEnding = ending[1];
      var auto = React.useState(false);
      var setAuto = auto[1];
      var fast = React.useState(false);
      var setFast = fast[1];
      var muted = React.useState(false);
      var setMuted = muted[1];
      var showLog = React.useState(false);
      var setShowLog = showLog[1];
      var slotModal = React.useState(null);
      var setSlotModal = slotModal[1];
      var cgState = React.useState(null);
      var setCgState = cgState[1];
      var flash = React.useState('');
      var setFlash = flash[1];
      var idxRef = React.useRef(0);
      var typeDisposer = React.useRef(null);
      var autoDisposer = React.useRef(null);
      var advanceRef = React.useRef(function () {});

      function rerender() { setTick(function (t) { return t + 1; }); }

      React.useEffect(function () {
        var alive = true;
        fetch('/galgame/api/load').then(function (r) { return r.json(); }).then(function (res) {
          if (!alive) return;
          if (res && res.ok && res.game) {
            setGame(res.game);
            setPhase('title');
          } else {
            setError((res && res.error) || '加载失败');
            setPhase('error');
          }
        }).catch(function (e) {
          if (!alive) return;
          setError(String((e && e.message) || e));
          setPhase('error');
        });
        return function () { alive = false; };
      }, []);

      function savesKey() { return game[0] ? 'dsh.galgame.saves.' + game[0].id : ''; }
      function readSaves() {
        try { var r = localStorage.getItem(savesKey()); return (r && JSON.parse(r)) || {}; } catch (e) { return {}; }
      }
      function hasAnySave() { return Object.keys(readSaves()).length > 0; }

      function variantOf(name) {
        var ch = game[0].characters && game[0].characters[name];
        if (!ch) return null;
        var face = eng.current.faces[name] || '';
        var v = ch.variants ? (ch.variants[face] || ch.variants[''] || null) : null;
        return v || ch;
      }

      function syncSprites(speaker) {
        var locked = eng.current.locked;
        var autoOn = (speaker && game[0].characters && game[0].characters[speaker]) ? {} : {};
        if (speaker && game[0].characters && game[0].characters[speaker]) autoOn[speaker] = true;
        for (var name in game[0].characters) {
          var want = !!autoOn[name] || !!locked[name];
          var cur = eng.current.sprites[name];
          if (want) {
            var c = variantOf(name);
            eng.current.sprites[name] = { url: (c && c.url) || null, pos: eng.current.positions[name] || (c && c.pos) || 'center', visible: true, name: name };
          } else if (cur) {
            eng.current.sprites[name].visible = false;
          }
        }
      }

      function applySayAt(i) {
        var n = game[0].nodes[i];
        if (!n) return;
        idxRef.current = i;
        eng.current.backlog.push({ speaker: n.speaker, text: n.text });
        if (eng.current.backlog.length > 600) eng.current.backlog.shift();
        syncSprites(n.speaker);
        setChoices(null);
        setLine({ speaker: n.speaker, text: n.text });
        rerender();
      }

      function applyEndAt(name) {
        eng.current.bgm = null;
        setChoices(null);
        setEnding(name || '结局');
        setPhase('end');
        rerender();
      }

      function runFrom(start) {
        if (!game[0]) return;
        var nodes = game[0].nodes;
        var i = start;
        var guard = 0;
        while (i >= 0 && i < nodes.length && guard++ < 8000) {
          var n = nodes[i];
          if (n.type === 'say') { applySayAt(i); return; }
          if (n.type === 'choice') { idxRef.current = i; setChoices(n.options || []); setLine(null); rerender(); return; }
          if (n.type === 'end') { applyEndAt(n.name || ''); return; }
          if (n.type === 'bg') {
            var b = game[0].backgrounds && game[0].backgrounds[n.bg];
            eng.current.bg = (b && b.url) ? b.url : ((game[0].assetUrls && game[0].assetUrls[n.bg]) ? game[0].assetUrls[n.bg] : null);
            i++; continue;
          }
          if (n.type === 'sprite') {
            if (n.action === 'hide') { delete eng.current.locked[n.char]; if (eng.current.sprites[n.char]) eng.current.sprites[n.char].visible = false; }
            else {
              eng.current.locked[n.char] = true;
              var c2 = variantOf(n.char);
              eng.current.sprites[n.char] = { url: (c2 && c2.url) || null, pos: n.pos || eng.current.positions[n.char] || (c2 && c2.pos) || 'center', visible: true, name: n.char };
            }
            i++; continue;
          }
          if (n.type === 'pos') {
            eng.current.positions[n.char] = n.pos;
            var curp = eng.current.sprites[n.char];
            if (curp) curp.pos = n.pos;
            i++; continue;
          }
          if (n.type === 'face') {
            eng.current.faces[n.char] = n.variant || '';
            var cur3 = eng.current.sprites[n.char];
            if (cur3) { var c3 = variantOf(n.char); cur3.url = (c3 && c3.url) || null; }
            i++; continue;
          }
          if (n.type === 'bgm') {
            eng.current.bgm = n.file ? ((game[0].assetUrls && game[0].assetUrls[n.file]) || null) : null;
            if (n.vol != null) eng.current.bgmVol = n.vol;
            i++; continue;
          }
          if (n.type === 'op' || n.type === 'cg' || n.type === 'ed') {
            idxRef.current = i;
            setCgState({ type: n.type, url: n.file ? ((game[0].assetUrls && game[0].assetUrls[n.file]) || null) : null });
            rerender();
            return;
          }
          if (n.type === 'jump') {
            if (n.target === null || n.target === undefined) { eng.current.bgm = null; setEnding('（剧情中断）'); setPhase('end'); rerender(); return; }
            i = n.target; continue;
          }
          if (n.type === 'jumpIf') {
            var v = eng.current.vars[n.var];
            var pass = false;
            if (n.op === 'truthy') pass = !!v;
            else if (n.op === '=') pass = v == n.val;
            else if (n.op === '!=') pass = v != n.val;
            else if (n.op === '>') pass = v > n.val;
            else if (n.op === '>=') pass = v >= n.val;
            else if (n.op === '<') pass = v < n.val;
            else if (n.op === '<=') pass = v <= n.val;
            if (!pass) {
              if (n.target === null || n.target === undefined) { i++; continue; }
              i = n.target; continue;
            }
            i++; continue;
          }
          if (n.type === 'var') {
            var cur = eng.current.vars[n.name];
            if (n.op === '=') eng.current.vars[n.name] = n.val;
            else if (n.op === '+') eng.current.vars[n.name] = (typeof cur === 'number' ? cur : 0) + n.val;
            else if (n.op === '-') eng.current.vars[n.name] = (typeof cur === 'number' ? cur : 0) - n.val;
            else eng.current.vars[n.name] = n.val;
            i++; continue;
          }
          i++;
        }
        eng.current.bgm = null;
        setEnding('');
        setPhase('end');
        rerender();
      }

      function completeTyping() {
        if (typeDisposer.current) { clearInterval(typeDisposer.current); typeDisposer.current = null; }
        setTyped(line[0] ? line[0].text : '');
        setLineDone(true);
      }

      function advance() {
        if (!game[0] || phase[0] !== 'play') return;
        if (!lineDone[0]) { completeTyping(); return; }
        runFrom(idxRef.current + 1);
      }
      advanceRef.current = advance;

      function choose(opt) {
        if (!game[0] || phase[0] !== 'play') return;
        var target = (opt && opt.target !== null && opt.target !== undefined) ? opt.target : idxRef.current + 1;
        setChoices(null);
        runFrom(target);
      }

      function startGame() { setPhase('play'); setAuto(false); eng.current.vars = {}; eng.current.sprites = {}; eng.current.locked = {}; eng.current.faces = {}; eng.current.positions = {}; eng.current.bgmVol = 1; runFrom(0); }

      function closeCg() {
        setCgState(null);
        rerender();
        runFrom(idxRef.current + 1);
      }

      function saveToSlot(n) {
        try {
          var saves = readSaves();
          saves[String(n)] = { idx: idxRef.current, bg: eng.current.bg, sprites: eng.current.sprites, locked: eng.current.locked, faces: eng.current.faces, positions: eng.current.positions, bgm: eng.current.bgm, bgmVol: eng.current.bgmVol, backlog: eng.current.backlog, vars: eng.current.vars, time: Date.now(), label: (line[0] && line[0].text ? line[0].text.slice(0, 12) : '') };
          localStorage.setItem(savesKey(), JSON.stringify(saves));
          setSlotModal(null);
          setFlash('已存入槽位 ' + n);
        } catch (e) { setFlash('存档失败'); }
      }

      function loadFromSlot(n) {
        var save = readSaves()[String(n)];
        if (!save) return;
        eng.current.bg = save.bg || null;
        eng.current.sprites = (save.sprites && typeof save.sprites === 'object') ? save.sprites : {};
        eng.current.locked = (save.locked && typeof save.locked === 'object') ? save.locked : {};
        eng.current.faces = (save.faces && typeof save.faces === 'object') ? save.faces : {};
        eng.current.positions = (save.positions && typeof save.positions === 'object') ? save.positions : {};
        eng.current.bgm = save.bgm || null;
        eng.current.bgmVol = save.bgmVol || 1;
        eng.current.backlog = Array.isArray(save.backlog) ? save.backlog : [];
        eng.current.vars = (save.vars && typeof save.vars === 'object') ? save.vars : {};
        setSlotModal(null);
        setAuto(false);
        setPhase('play');
        runFrom(save.idx);
      }

      // typewriter
      React.useEffect(function () {
        if (phase[0] !== 'play' || !line[0]) { setTyped(''); setLineDone(true); return; }
        setTyped('');
        setLineDone(false);
        var full = line[0].text || '';
        if (!full) { setLineDone(true); return; }
        var totalMs = Math.max(150, full.length * (fast[0] ? 6 : 22));
        var started = Date.now();
        var disp = setInterval(function () {
          var el = Date.now() - started;
          if (el >= totalMs) {
            setTyped(full);
            setLineDone(true);
            if (typeDisposer.current) { clearInterval(typeDisposer.current); typeDisposer.current = null; }
          } else {
            setTyped(full.slice(0, Math.floor(full.length * (el / totalMs))));
          }
        }, 40);
        typeDisposer.current = disp;
        return function () { if (typeDisposer.current) { clearInterval(typeDisposer.current); typeDisposer.current = null; } };
      }, [line[0], phase[0], fast[0]]);

      // auto advance
      React.useEffect(function () {
        if (autoDisposer.current) { clearTimeout(autoDisposer.current); autoDisposer.current = null; }
        if (!auto[0] || phase[0] !== 'play' || !lineDone[0] || !line[0] || choices[0] || slotModal[0]) return;
        autoDisposer.current = setTimeout(function () { autoDisposer.current = null; advanceRef.current(); }, fast[0] ? 350 : 1100);
        return function () { if (autoDisposer.current) { clearTimeout(autoDisposer.current); autoDisposer.current = null; } };
      }, [auto[0], phase[0], lineDone[0], line[0], choices[0], slotModal[0], fast[0]]);

      // flash
      React.useEffect(function () {
        if (!flash[0]) return;
        var d = setTimeout(function () { setFlash(''); }, 1300);
        return function () { clearTimeout(d); };
      }, [flash[0]]);

      // keyboard
      React.useEffect(function () {
        function onKey(e) {
          if (phase[0] !== 'play') return;
          if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advanceRef.current(); }
        }
        window.addEventListener('keydown', onKey);
        return function () { window.removeEventListener('keydown', onKey); };
      }, [phase[0]]);

      function mkBtn(key, label, fn, title, active) {
        return React.createElement('button', { key: key, className: 'gg-tbtn' + (active ? ' gg-on' : ''), onClick: fn, title: title }, label);
      }

      function renderSprite(name, s) {
        var cls = 'gg-sprite gg-pos-' + (s.pos || 'center') + (s.visible === false ? ' gg-hidden' : '');
        if (s.url) return React.createElement('img', { key: name, className: cls, src: s.url, alt: name });
        return React.createElement('div', { key: name, className: cls + ' gg-avatar' }, String(name || '?').slice(0, 1));
      }

      var dialog = line[0] ? React.createElement('div', { className: 'gg-dialog', onClick: advance },
        line[0].speaker ? React.createElement('div', { className: 'gg-speaker' },
          React.createElement('span', { className: 'gg-speaker-name' }, line[0].speaker),
          React.createElement('span', { className: 'gg-speaker-caret' }, '▼')) : null,
        React.createElement('div', { className: 'gg-line' }, typed[0])) : null;

      var choiceBox = choices[0] ? React.createElement('div', { className: 'gg-choices' },
        choices[0].map(function (o, i) { return React.createElement('button', { key: i, className: 'gg-choice', onClick: function () { choose(o); } }, o.text); })) : null;

      var topbar = React.createElement('div', { className: 'gg-topbar' },
        React.createElement('span', { className: 'gg-title-mini' }, game[0] ? game[0].title : ''),
        React.createElement('div', { className: 'gg-topbar-actions' },
          mkBtn('save', '💾 存档', function () { setSlotModal({ mode: 'save', saves: readSaves() }); }, '保存到槽位'),
          mkBtn('load', '📂 读档', function () { setSlotModal({ mode: 'load', saves: readSaves() }); }, '从槽位读取'),
          mkBtn('log', '📜 历史', function () { setShowLog(true); }, '查看已读内容'),
          mkBtn('auto', auto[0] ? '⏸ 自动' : '▶ 自动', function () { setAuto(!auto[0]); }, '自动播放', auto[0]),
          mkBtn('fast', '⏩ 快进', function () { setFast(!fast[0]); }, '快进模式', fast[0]),
          mkBtn('mute', muted[0] ? '🔇 音乐' : '🔊 音乐', function () { setMuted(!muted[0]); }, '背景音乐开关', muted[0]),
          mkBtn('close', '✖', onClose, '关闭播放器')));

      var logModal = showLog[0] ? React.createElement('div', { className: 'gg-modal', onClick: function () { setShowLog(false); } },
        React.createElement('div', { className: 'gg-modal-box gg-logbox', onClick: function (e) { e.stopPropagation(); } },
          React.createElement('div', { className: 'gg-modal-title' }, '历史记录'),
          React.createElement('div', { className: 'gg-log' },
            eng.current.backlog.length ? eng.current.backlog.map(function (b, i) {
              return React.createElement('div', { key: i, className: 'gg-log-item' },
                b.speaker ? React.createElement('span', { className: 'gg-log-speaker' }, b.speaker + '：') : null,
                React.createElement('span', null, b.text));
            }) : React.createElement('div', { className: 'gg-log-empty' }, '（暂无记录）')),
          React.createElement('button', { className: 'gg-btn gg-btn-primary', onClick: function () { setShowLog(false); } }, '关闭'))) : null;

      var slotModalEl = slotModal[0] ? React.createElement('div', { className: 'gg-modal', onClick: function () { setSlotModal(null); } },
        React.createElement('div', { className: 'gg-modal-box', onClick: function (e) { e.stopPropagation(); } },
          React.createElement('div', { className: 'gg-modal-title' }, slotModal[0].mode === 'save' ? '选择存档槽位' : '选择读档槽位'),
          React.createElement('div', { className: 'gg-slots' },
            (function () { var arr = []; var cnt = (game[0] && game[0].saveSlots) || 9; for (var s = 1; s <= cnt; s++) arr.push(s); return arr; }()).map(function (n) {
              var s = slotModal[0].saves[String(n)];
              var has = !!s;
              var disabled = slotModal[0].mode === 'load' && !has;
              return React.createElement('button', {
                key: n,
                className: 'gg-slot' + (has ? '' : ' gg-slot-empty') + (disabled ? ' gg-slot-disabled' : ''),
                onClick: function () { if (slotModal[0].mode === 'save') saveToSlot(n); else if (has) loadFromSlot(n); },
              },
                React.createElement('span', { className: 'gg-slot-num' }, '槽位 ' + n),
                React.createElement('br', null),
                has ? ('第' + (s.label || '') + ' · ' + new Date(s.time).toLocaleString()) : '（空）');
            })),
          React.createElement('button', { className: 'gg-btn gg-btn-primary', onClick: function () { setSlotModal(null); } }, '关闭'))) : null;

      var body = null;
      if (phase[0] === 'loading') {
        body = React.createElement('div', { className: 'gg-center' }, '正在加载游戏…');
      } else if (phase[0] === 'error') {
        body = React.createElement('div', { className: 'gg-center gg-error' },
          React.createElement('p', null, error[0] || '加载失败'),
          React.createElement('p', { className: 'gg-hint' }, '先在对话中让助手调用 galgame_build 生成游戏，再打开播放器'),
          React.createElement('button', { className: 'gg-btn', onClick: onClose }, '关闭'));
      } else if (phase[0] === 'title') {
        var cast = Object.keys((game[0] && game[0].characters) || {}).map(function (name) {
          var c = game[0].characters[name];
          return React.createElement('div', { key: name, className: 'gg-cast-item' },
            c.url ? React.createElement('img', { src: c.url, alt: name, className: 'gg-cast-img' }) : React.createElement('div', { className: 'gg-cast-img gg-cast-avatar' }, String(name).slice(0, 1)),
            React.createElement('span', { className: 'gg-cast-name' }, name));
        });
        body = React.createElement('div', { className: 'gg-title' },
          React.createElement('h1', { className: 'gg-title-text' }, game[0] ? game[0].title : '未命名游戏'),
          game[0] && game[0].intro ? React.createElement('p', { className: 'gg-intro' }, game[0].intro) : null,
          cast.length ? React.createElement('div', { className: 'gg-cast' }, cast) : null,
          React.createElement('div', { className: 'gg-title-btns' },
            React.createElement('button', { key: 'start', className: 'gg-btn gg-btn-primary', onClick: startGame }, '▶ 开始游戏'),
            hasAnySave() ? React.createElement('button', { key: 'cont', className: 'gg-btn', onClick: function () { setSlotModal({ mode: 'load', saves: readSaves() }); } }, '⏵ 继续游戏（读档）') : null,
            React.createElement('button', { key: 'close', className: 'gg-btn gg-btn-ghost', onClick: onClose }, '关闭')));
      } else if (phase[0] === 'end') {
        body = React.createElement('div', { className: 'gg-end' },
          React.createElement('div', { className: 'gg-end-mark' }, '— END —'),
          React.createElement('h2', { className: 'gg-end-title' }, ending[0] || '结局'),
          React.createElement('div', { className: 'gg-title-btns' },
            React.createElement('button', { key: 'again', className: 'gg-btn gg-btn-primary', onClick: function () { setEnding(''); setPhase('title'); } }, '回到标题'),
            React.createElement('button', { key: 'close', className: 'gg-btn gg-btn-ghost', onClick: onClose }, '关闭')));
      } else {
        body = React.createElement('div', { className: 'gg-stage' },
          eng.current.bg ? React.createElement('img', { className: 'gg-bg', src: eng.current.bg, alt: '' }) : React.createElement('div', { className: 'gg-bg gg-bg-empty' }),
          React.createElement('div', { className: 'gg-sprites' }, Object.keys(eng.current.sprites).map(function (n) { return renderSprite(n, eng.current.sprites[n]); })),
          choiceBox,
          dialog);
      }

      var audioEl = (phase[0] === 'play' && eng.current.bgm) ? React.createElement('audio', {
        key: eng.current.bgm,
        src: eng.current.bgm,
        loop: true,
        autoPlay: true,
        muted: muted[0],
        volume: eng.current.bgmVol || 1,
        style: { display: 'none' },
      }) : null;

      var cgLayer = cgState[0] ? React.createElement('div', { className: 'gg-cg', onClick: closeCg },
        cgState[0].url && /\.(mp4|webm|ogg|m4a|avi)$/i.test(cgState[0].url)
          ? React.createElement('video', { className: 'gg-cg-media', src: cgState[0].url, autoPlay: true, muted: true, loop: cgState[0].type === 'cg', onEnded: function () { if (cgState[0].type !== 'cg') closeCg(); } })
          : React.createElement('img', { className: 'gg-cg-media', src: cgState[0].url || '', alt: '' }),
        React.createElement('div', { className: 'gg-cg-hint' }, cgState[0].type === 'cg' ? '点击继续' : '点击跳过')) : null;

      return React.createElement('div', { className: 'gg-overlay' },
        phase[0] === 'play' ? topbar : null,
        body,
        logModal,
        slotModalEl,
        cgLayer,
        flash[0] ? React.createElement('div', { className: 'gg-flash' }, flash[0]) : null,
        audioEl);
    }

    function PlayerOverlay() {
      var open = useOpen();
      if (!open) return null;
      return React.createElement(GalgamePlayer, { onClose: function () { store.set(false); } });
    }

    // ---------- plugin ----------
    var inject = ['slots'];

    function apply(ctx) {
      try {
        var style = document.createElement('style');
        style.setAttribute('data-plugin', 'dsh-galgame-generator');
        style.textContent = CSS;
        document.head.appendChild(style);
        if (typeof ctx.effect === 'function') {
          ctx.effect(function () {
            return function () { if (style.parentNode) style.parentNode.removeChild(style); };
          });
        }
      } catch (e) {}

      function register(name, id, order, component, extra) {
        ctx.slots.inject(name, function () {
          var opts = { name: name, id: id, order: order };
          if (extra) for (var k in extra) opts[k] = extra[k];
          return ctx.slots.register(opts, component);
        });
      }

      register('sidebar.footer.action', 'galgame-open', 5, function (props) {
        return React.createElement(SidebarAction, { wide: Boolean(props && props.wide) });
      }, { label: function () { return 'Galgame'; } });

      register('shell.overlay', 'galgame-player', 20, function () {
        return React.createElement(PlayerOverlay);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = 'dsh-galgame-generator';
    return module.exports;
  },
});
