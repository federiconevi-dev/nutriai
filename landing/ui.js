// Page UI: landing → configure → editor. The engine (editor.js) exposes window.VE.
const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const VE = window.VE, v = VE.video;
const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));

// ---- Fonts ----
const FONTS = ['auto', 'Plus Jakarta Sans', 'Inter', 'Montserrat', 'Poppins', 'Outfit', 'Space Grotesk', 'Anton', 'Bebas Neue', 'Archivo Black', 'Instrument Serif', 'Playfair Display', 'DM Serif Display', 'Caveat', 'Permanent Marker', 'Great Vibes'];
function fillFonts() {
  $$('.fontsel').forEach(s => {
    const cur = s.value;
    s.innerHTML = FONTS.map(f => `<option value="${f}">${f === 'auto' ? 'Automática (según estilo)' : f}</option>`).join('');
    if (cur) s.value = cur;
  });
}
fillFonts();
$$('.fontsel').forEach(s => s.addEventListener('change', () => {
  if (s.value !== 'auto' && document.fonts) ['400', '700', '800', '900'].forEach(wt => document.fonts.load(`${wt} 40px "${s.value}"`).catch(() => {}));
}));
$('#fontFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w ]/g, ' ').trim() || 'Mi fuente';
  try {
    const ff = new FontFace(name, await f.arrayBuffer());
    await ff.load(); document.fonts.add(ff);
    FONTS.push(name); fillFonts(); $('#fBase').value = name; fire($('#fBase'));
  } catch (er) { alert('No pude leer esa fuente. Probá con un archivo .ttf u .otf.'); }
};

// ---- Color swatches ----
const COLS = { cBase: ['auto', '#ffffff', '#fff7e6', '#111111', '#ffe14d', '#e8d3a2'], cKey: ['auto', '#ffe14d', '#22e06b', '#ff4d6d', '#ef233c', '#ff6046', '#38bdf8', '#a855f7', '#f472b6', '#ffffff'] };
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

// ---- Mirrored switches (same option shown in two places) ----
$$('[data-mirror]').forEach(m => {
  const real = $('#' + m.dataset.mirror);
  m.checked = real.checked;
  m.onchange = () => { real.checked = m.checked; real.dispatchEvent(new Event('change')); syncAll(); };
  real.addEventListener('change', () => { m.checked = real.checked; });
});
function syncAll() {
  $$('[data-mirror]').forEach(m => { m.checked = $('#' + m.dataset.mirror).checked; });
  $$('.acc').forEach(d => { const c = d.querySelector('input[type=checkbox]'); d.classList.toggle('live', !!c && c.checked); });
  $('#btnCut').classList.toggle('on', $('#optCut').checked);
}
$('#btnCut').onclick = () => { const c = $('#optCut'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); syncAll(); };

// ---- Autosave settings (this browser only) ----
const KEY = 'videora-settings';
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

// ---- Look previews (drawn by the same engine that renders your video) ----
const MG = [['bw', 'Prensa'], ['cine', 'Noir'], ['photo', 'Foto real'], ['vintage', 'Collage'], ['coral', 'Coral'], ['dark', 'Noche'], ['neonpink', 'Neón rosa'], ['clean', 'Claro']];
const OVS = [['glass', 'Vidrio'], ['neon', 'Neón'], ['mono', 'Revista'], ['graph', 'Cuaderno'], ['femtech', 'Rosa'], ['cyber', 'Terminal']];
function makeCards(box, list, kind, input) {
  box.innerHTML = list.map(([k, n]) => `<button type="button" class="card" data-v="${k}"><canvas width="${kind === 'ov' ? 320 : 180}" height="${kind === 'ov' ? 200 : 320}"></canvas><span>${n}</span></button>`).join('');
  const paint = () => box.querySelectorAll('.card').forEach((c, i) => VE.thumb(c.querySelector('canvas'), kind, c.dataset.v, i));
  const sync = () => box.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.v === input.value || (input.value === 'auto' && false)));
  box.onclick = e => { const c = e.target.closest('.card'); if (!c) return; input.value = c.dataset.v; fire(input); sync(); };
  input.addEventListener('change', sync); sync();
  return paint;
}
const paintMG = makeCards($('#mgCards'), MG, 'mg', $('#mg'));
const paintOV = makeCards($('#ovCards'), OVS, 'ov', $('#ovStyle'));
const lg = $('#lgStyles');
lg.innerHTML = MG.slice(0, 5).map(([k, n]) => `<div><canvas width="180" height="320" data-v="${k}"></canvas><span>${n}</span></div>`).join('');
const paintLanding = () => lg.querySelectorAll('canvas').forEach((c, i) => VE.thumb(c, 'mg', c.dataset.v, i));
const repaint = () => { paintMG(); paintOV(); paintLanding(); };
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(repaint, 300));
setTimeout(repaint, 2500);
['fKey', 'fAccent', 'fBase', 'sKey', 'sAccent', 'cKey'].forEach(id => $('#' + id).addEventListener('change', () => setTimeout(repaint, 200)));

// ---- Marquee of what it does (no fake reviews) ----
const items = ['Subtítulos palabra por palabra', 'Texto gigante detrás tuyo', 'Listas animadas automáticas', 'Números que cuentan', 'Frases clave en pantalla', 'Fotos b-roll semitransparentes', 'Hook con flash, blur o cine', 'Cortes de silencios', 'Zooms en momentos clave', 'Glitch y destellos', 'Overlays tipo Apple Glass', 'Exportación rápida'];
$('#mq').innerHTML = [...items, ...items].map(t => `<div class="cm"><small>Videora hace</small><b>${t}</b></div>`).join('');

// ---- Flow ----
const app = $('#app');
function view(name) {
  app.classList.add('on'); document.body.style.overflow = 'hidden';
  $('#cfg').hidden = name !== 'cfg';
  $('#ed').classList.toggle('on', name === 'ed');
  if (name === 'cfg') setTimeout(repaint, 50);
  if (name === 'ed') { resizeTl(); v.play().catch(() => {}); }
}
window.onLoaded = () => { view('cfg'); $('#dlbox').hidden = true; };
$('#file2').onchange = e => { const f = e.target.files[0]; if (f) VE.load(f); };
$('#cont').onclick = () => view('ed');
$('#back').onclick = () => { app.classList.remove('on'); document.body.style.overflow = ''; v.pause(); };
// Mirror engine status into the configure step.
new MutationObserver(() => { $('#cfgMsg').textContent = $('#msg').textContent; }).observe($('#msg'), { childList: true, characterData: true, subtree: true });
new MutationObserver(() => { $('#cfgProg').style.width = $('#prog').style.width; }).observe($('#prog'), { attributes: true });

// ---- Player controls ----
const pp = $('#pp');
const ppSync = () => { pp.textContent = v.paused ? '▶' : '❚❚'; pp.setAttribute('aria-label', v.paused ? 'Reproducir' : 'Pausa'); };
pp.onclick = () => { v.paused ? v.play().catch(() => {}) : v.pause(); };
v.addEventListener('play', ppSync); v.addEventListener('pause', ppSync);
$('#rw').onclick = () => { const p = VE.plan; v.currentTime = p ? p.segs[0].s : 0; };
$('#mute').onclick = () => { v.muted = !v.muted; $('#mute').textContent = v.muted ? '🔇' : '🔊'; if (!v.muted) v.play().catch(() => {}); };

// ---- Mobile tabs ----
$$('.ptabs button').forEach(b => b.onclick = () => {
  const l = b.dataset.tab === 'l';
  $('#sideL').classList.toggle('hide', !l); $('#sideR').classList.toggle('hide', l);
  $$('.ptabs button').forEach(x => x.classList.toggle('sel', x === b));
});

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
window.onFrame = t => { const now = performance.now(); if (now - lastTl > 60 && $('#ed').classList.contains('on')) { lastTl = now; drawTl(t); } };
tl.onclick = e => { const r = tl.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * (v.duration || 0); };

// ---- Export result ----
window.onExported = () => { $('#dlbox').hidden = false; };
$('#dlx').onclick = () => { $('#dlbox').hidden = true; };
