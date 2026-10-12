// Page UI: landing → editor (Automático / Personalizado tabs). The engine (editor.js) exposes window.VE.
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const VE = window.VE, v = VE.video;
const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));

// ---- Font pickers: Texto base / Palabra destacada / Acento cursivo, each font shown in its own face ----
const CATS = ['Mis fuentes', 'Cursiva', 'Media cursiva', 'Manuscrita', 'Sans', 'Impacto'];
function buildPicker(box) {
  const id = box.dataset.for, input = $('#' + id);
  box.innerHTML = `<button type="button"></button><div class="fpl" hidden></div>`;
  const btn = box.firstChild, list = box.lastChild;
  const paintBtn = () => {
    const v2 = input.value, tf = VE.typoFonts;
    const f = v2 === 'auto' ? (id === 'fBase' ? tf.base : id === 'fKey' ? tf.key : tf.accent) : VE.fontOf(v2, 20);
    btn.innerHTML = `<span style="font:${f}">${v2 === 'auto' ? 'Automática' : v2}</span><small>${v2 === 'auto' ? 'según la tipografía' : ''}</small>`;
    if (v2 !== 'auto') VE.ensureFonts([v2]);
  };
  const fill = () => {
    const lib = VE.fontLib;
    list.innerHTML = `<button type="button" data-v="auto" style="font:600 15px Inter,sans-serif">Automática (según la tipografía elegida)</button>` +
      CATS.map(c => { const fs = lib.filter(f => f[1] === c); return fs.length ? `<h6>${c}</h6>` + fs.map(f => `<button type="button" data-v="${f[0]}" style="font:${VE.fontOf(f[0], 21)}">${f[0]}</button>`).join('') : ''; }).join('');
    list.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === input.value));
  };
  btn.onclick = () => {
    const open = list.hidden; $$('.fpl').forEach(l => { l.hidden = true; });
    if (open) { fill(); list.hidden = false; VE.ensureFonts(VE.fontLib.map(f => f[0])); }
  };
  list.onclick = e => { const b = e.target.closest('button'); if (!b) return; input.value = b.dataset.v; list.hidden = true; fire(input); };
  input.addEventListener('change', paintBtn); paintBtn();
  return paintBtn;
}
const pickers = $$('.fp').map(buildPicker);
const paintPickers = () => pickers.forEach(p => p());
document.addEventListener('click', e => { if (!e.target.closest('.fp')) $$('.fpl').forEach(l => { l.hidden = true; }); });
$('#fontFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w ]/g, ' ').trim() || 'Mi fuente';
  try {
    const ff = new FontFace(name, await f.arrayBuffer());
    await ff.load(); document.fonts.add(ff);
    VE.addFont(name); $('#fBase').value = name; fire($('#fBase'));
  } catch (er) { alert('No pude leer esa fuente. Probá con un archivo .ttf u .otf.'); }
};

// ---- Color swatches ----
const HK = ['auto', '#ffffff', '#5cf58a', '#22e06b', '#00ffee', '#38bdf8', '#2f7bff', '#a855f7', '#f472b6', '#ff4d6d', '#ef233c', '#ff6046', '#ffa200', '#ffd23f', '#fef4b4', '#111111'];
const COLS = { hkC1: HK, hkC2: HK, hkC3: HK, cBase: ['auto', '#ffffff', '#fff7e6', '#111111', '#ffe14d', '#e8d3a2'], cKey: ['auto', '#ffe14d', '#22e06b', '#ff4d6d', '#ef233c', '#ff6046', '#38bdf8', '#a855f7', '#f472b6', '#ffffff'] };
$$('.sws').forEach(box => {
  const id = box.dataset.for, input = $('#' + id);
  box.innerHTML = COLS[id].map(c => `<button type="button" data-v="${c}" title="${c === 'auto' ? 'Automático' : c}" style="background:${c === 'auto' ? 'conic-gradient(#c6f432,#ffe14d,#5eead4,#38bdf8,#a855f7,#c6f432)' : c}"></button>`).join('');
  const sync = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === input.value));
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; input.value = b.dataset.v; sync(); fire(input); };
  input.addEventListener('change', sync); sync();
});

// ---- Chips (single choice) and viral style cards ----
$$('[data-sel]').forEach(box => {
  const input = $('#' + box.dataset.sel);
  const sync = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === input.value));
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; input.value = b.dataset.v; sync(); fire(input); };
  input.addEventListener('change', sync); sync();
});
const vsSync = () => $$('#vs button').forEach(b => b.classList.toggle('sel', b.dataset.v === $('#style').value));
$('#vs').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#style').value = b.dataset.v; vsSync(); fire($('#style')); };
$('#style').addEventListener('change', vsSync);

function syncAll() {
  $$('.acc').forEach(d => { const c = d.querySelector('input[type=checkbox]'); d.classList.toggle('live', !!c && c.checked); });
  $('#btnCut').classList.toggle('on', $('#optCut').checked);
}
$('#btnCut').onclick = () => { const c = $('#optCut'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); syncAll(); };

// ---- Autosave settings (this browser only) ----
const KEY = 'videora-settings-v3';
const saveable = () => $$('#app input[id], #app select[id]').filter(el => el.type !== 'file' && el.id !== 'ctaWord');
function restore() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* storage blocked */ }
  if (!s) return;
  saveable().forEach(el => { if (!(el.id in s)) return; if (el.type === 'checkbox') el.checked = s[el.id]; else el.value = s[el.id]; fire(el); });
}
let saveT = 0;
document.addEventListener('change', e => {
  if (!e.target.closest('#app')) return;
  syncAll();
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const s = {}; saveable().forEach(el => { s[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); $('#saved').textContent = '● Guardado'; } catch (er) { /* ignore */ }
  }, 300);
});
restore(); syncAll(); vsSync();

// ---- Typography cards (Personalizado) and showcase (landing) ----
const TY = VE.typos;
const px = (f, n) => f.replace(/\d+(\.\d+)?px/, n + 'px');
const tyHtml = (k, T) => `<button type="button" data-v="${k}"><i style="font:${px(T.kicker, 14)}">Tu viaje comienza</i><b style="font:${px(T.title, 19)}">Aprendé lo <span style="background:linear-gradient(90deg,${T.key[0]},${T.key[1]});-webkit-background-clip:text;background-clip:text;color:transparent">esencial</span></b><small>${T.name}</small></button>`;
$('#tys').innerHTML = `<button type="button" class="auto" data-v="auto">Automática<small class="mut">La IA elige según tu video</small></button>` + Object.entries(TY).map(([k, T]) => tyHtml(k, T)).join('');
const tySync = () => {
  $$('#tys button').forEach(b => b.classList.toggle('sel', b.dataset.v === $('#typo').value));
  const k = VE.typoKey; $('#typoNow').textContent = TY[k] ? TY[k].name : '—'; if (TY[k]) $('#typoNow').style.font = TY[k].title.replace(/\d+(\.\d+)?px/, '22px');
};
$('#tys').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#typo').value = b.dataset.v; fire($('#typo')); };
$('#typo').addEventListener('change', () => { tySync(); paintPickers(); });
$('#typoNext').onclick = () => { const ks = Object.keys(TY), i = ks.indexOf(VE.typoKey); $('#typo').value = ks[(i + 1) % ks.length]; fire($('#typo')); };
$('#typesShow').innerHTML = Object.values(TY).map(T => `<span style="font:${T.title.replace(/\d+(\.\d+)?px/, '22px')}">${T.name}</span>`).join('');
// ---- Edit formats ----
const RC = VE.recipes;
$('#rcs').innerHTML = `<button data-v="auto"><b>Automático</b><small>La IA elige según tu video</small></button>` + Object.entries(RC).map(([k, r]) => `<button data-v="${k}"><b>${r.name}</b><small>${r.desc}</small></button>`).join('');
const rcSync = () => { $$('#rcs button').forEach(b => b.classList.toggle('sel', b.dataset.v === $('#recipe').value)); const r = RC[VE.recipeKey]; if (r) { $('#recNow').textContent = r.name; $('#recDesc').textContent = r.desc; } };
$('#rcs').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#recipe').value = b.dataset.v; fire($('#recipe')); };
$('#recipe').addEventListener('change', () => { rcSync(); if (VE.plan) VE.build(); });
$('#recNext').onclick = () => { const ks = Object.keys(RC), i = ks.indexOf(VE.recipeKey); $('#recipe').value = ks[(i + 1) % ks.length]; fire($('#recipe')); };
rcSync();
const repaint = () => tySync();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(tySync);

// ---- Flow ----
const app = $('#app');
function view(name) {
  app.classList.add('on'); document.body.style.overflow = 'hidden';
  resizeTl(); v.play().catch(() => {});
}
window.onLoaded = () => { view('ed'); $('#dlbox').hidden = true; tab('a'); setStep(0); setRec('Cuando termine de escucharte, la IA elige la mejor edición para tu video.'); };
$('#file2').onchange = e => { const f = e.target.files[0]; if (f) VE.load(f); };
$('#back').onclick = () => { app.classList.remove('on'); document.body.style.overflow = ''; v.pause(); };
// Last step is done when every image of the edit has arrived (or after a while, whatever is there).
let artT = 0;
function waitArt() { clearInterval(artT); const t0 = Date.now(); artT = setInterval(() => { const P = VE.plan, ph = P && P.beats ? P.beats.photos : []; if ((P && ph.every(p => p.img || p.failed)) || Date.now() - t0 > 60000) { clearInterval(artT); setStep(3); } }, 1000); }
// Progress steps in the Automático tab, read from the engine status.
function setStep(n) { $$('#steps span').forEach(sp => { const i = +sp.dataset.s; sp.className = i < n ? 'done' : i === n ? 'now' : ''; }); if (n >= 3) $$('#steps span').forEach(sp => { sp.className = 'done'; }); }
new MutationObserver(() => {
  const m = $('#msg').textContent;
  if (/escuch|transcrib|modelo|descarg|audio/i.test(m)) setStep(0);
  else if (/imagen|foto/i.test(m)) setStep(2);
}).observe($('#msg'), { childList: true, characterData: true, subtree: true });

// ---- Player controls ----
const pp = $('#pp');
const ppSync = () => { pp.textContent = v.paused ? '▶' : '❚❚'; pp.setAttribute('aria-label', v.paused ? 'Reproducir' : 'Pausa'); };
pp.onclick = () => { v.paused ? v.play().catch(() => {}) : v.pause(); };
v.addEventListener('play', ppSync); v.addEventListener('pause', ppSync);
$('#rw').onclick = () => { const p = VE.plan; v.currentTime = p ? p.segs[0].s : 0; };
$('#mute').onclick = () => { v.muted = !v.muted; $('#mute').textContent = v.muted ? '🔇' : '🔊'; if (!v.muted) v.play().catch(() => {}); };

// ---- Automático / Personalizado tabs ----
function tab(t) {
  $('#sideA').classList.toggle('hide', t !== 'a'); $('#sideP').classList.toggle('hide', t !== 'p');
  $$('.ptabs button').forEach(x => x.classList.toggle('sel', x.dataset.tab === t));
}
$$('.ptabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));
$('#toP').onclick = () => tab('p');

// ---- Timeline ----
const tl = $('#tl'), tcx = tl.getContext('2d');
function resizeTl() { const r = tl.getBoundingClientRect(); tl.width = Math.max(200, Math.round(r.width * devicePixelRatio)); tl.height = Math.round(r.height * devicePixelRatio); }
addEventListener('resize', resizeTl);
function drawTl(t) {
  const P = VE.plan, D = v.duration || 1, Wt = tl.width, Ht = tl.height, dpr = devicePixelRatio, X = s => s / D * Wt;
  tcx.clearRect(0, 0, Wt, Ht);
  const h1 = Ht * .42, y2 = Ht * .52;
  tcx.fillStyle = '#1b1b21'; tcx.fillRect(0, 4 * dpr, Wt, h1 - 6 * dpr);
  tcx.fillStyle = '#2f5d59';
  (P ? P.segs : [{ s: 0, e: D }]).forEach(g => tcx.fillRect(X(g.s), 4 * dpr, Math.max(1, X(g.e) - X(g.s)), h1 - 6 * dpr));
  if (P) {
    tcx.font = `${11 * dpr}px Inter, sans-serif`; tcx.textBaseline = 'middle';
    P.chunks.forEach(c => {
      const x = X(c.s), w = Math.max(2, X(c.e) - x);
      tcx.fillStyle = c.emph ? '#7c9a1e' : '#2f3544'; tcx.beginPath(); tcx.roundRect ? tcx.roundRect(x, y2, w - 1, Ht - y2 - 4 * dpr, 4 * dpr) : tcx.rect(x, y2, w - 1, Ht - y2 - 4 * dpr); tcx.fill();
      if (w > 30 * dpr) { tcx.save(); tcx.beginPath(); tcx.rect(x, y2, w - 2, Ht - y2); tcx.clip(); tcx.fillStyle = '#fff'; tcx.fillText(c.map(w2 => w2.t).join(' '), x + 4 * dpr, y2 + (Ht - y2) / 2 - 2 * dpr); tcx.restore(); }
    });
  }
  tcx.fillStyle = '#c6f432'; tcx.fillRect(X(t) - dpr, 0, 2 * dpr, Ht);
}
let lastTl = 0;
window.onFrame = t => { const now = performance.now(); if (now - lastTl > 60 && app.classList.contains('on')) { lastTl = now; drawTl(t); } };
tl.onclick = e => { const r = tl.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * (v.duration || 0); };

// ---- Export result ----
window.onExported = () => { $('#dlbox').hidden = false; };
$('#dlx').onclick = () => { $('#dlbox').hidden = true; };

// ---- AI director: picks the whole edit after transcription, and applies changes asked in plain words ----
const setRec = t => { $('#aiRec').textContent = t; };
function currentSettings() {
  const s = {};
  saveable().forEach(el => { s[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  return s;
}
let directing = false;
async function direct(request = '') {
  if (directing) return;
  directing = true; $('#aiGo').disabled = $('#aiAuto').disabled = true;
  setRec(request ? 'Aplicando tu pedido…' : 'La IA está eligiendo la mejor edición para tu video…'); if (!request) setStep(1);
  try {
    const r = await fetch('/api/ai-direct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: $('#txt').value, request, current: currentSettings(), info: VE.info }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'La IA no respondió.');
    // In automatic mode keep our curated typography and colors; fonts/colors change only when asked.
    if (j.settings && j.settings.typo) VE.setTypo(j.settings.typo);
    if (j.settings && j.settings.recipe && !request) VE.setRecipe(j.settings.recipe);
    for (const [k, val] of Object.entries(j.settings || {})) { if (k === 'typo' || k === 'recipe' || k === 'music' ? !request : !request && k !== 'hookSfx' && !(k === 'hookFx' && /^(blur|flash|zoom|iris|cine)$/.test(val))) continue; const el = $('#' + k); if (el && el.value !== val) { el.value = val; fire(el); } }
    // In automatic mode the AI can only switch extra features on (the full edit stays); turning things off needs a request.
    for (const [k, val] of Object.entries(j.toggles || {})) { if (!request) continue; const el = $('#' + k); if (el && el.checked !== val) { el.checked = val; el.dispatchEvent(new Event('change', { bubbles: true })); } }
    if (j.settings && j.settings.music && !request) VE.setMusic(j.settings.music);
    if (Array.isArray(j.hookAlts) && j.hookAlts.length) {
      $('#hookAlts').innerHTML = [j.hookTitle, ...j.hookAlts].filter(Boolean).map(hk => `<button type="button">${hk.replace(/</g, '')}</button>`).join('');
      $('#hookBox').hidden = false;
    }
    if (j.post) { $('#postTxt').value = j.post; $('#postBox').hidden = false; }
    if (j.fixes) VE.fixWords(j.fixes);
    if (j.hookTitle) VE.setHook(j.hookTitle);
    syncAll(); vsSync(); tySync(); rcSync(); paintPickers();
    setRec((j.reason || 'Listo, apliqué la edición.').replace(/\b(nova|lujo|revista|tech|suave|clasico|clásico|urbano)\b/gi, m => { const k = m.toLowerCase().replace('á', 'a'); return TY[k] ? TY[k].name : m; })); setStep(2); waitArt();
    if (request) $('#aiAsk').value = '';
  } catch (e) {
    setRec('La IA no pudo responder ahora (' + e.message + '). Tu edición automática sigue lista.'); waitArt();
  }
  directing = false; $('#aiGo').disabled = $('#aiAuto').disabled = false;
}
window.onTranscribed = () => direct();
$('#aiGo').onclick = () => { const q = $('#aiAsk').value.trim(); if (q) direct(q); };
$('#aiAsk').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiGo').click(); } });
$('#aiAuto').onclick = () => direct();

// Alternative hooks and post text from the AI.
$('#hookAlts').onclick = e => { const b = e.target.closest('button'); if (!b) return; VE.setHook(b.textContent); $$('#hookAlts button').forEach(x => x.classList.toggle('sel', x === b)); };
$('#postCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#postTxt').value); $('#postCopy').textContent = '¡Copiado!'; } catch (e) { $('#postTxt').select(); } setTimeout(() => { $('#postCopy').textContent = 'Copiar texto y hashtags'; }, 1500); };
