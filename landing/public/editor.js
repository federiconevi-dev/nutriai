// Videora auto-editor: runs fully in the browser (no server, no cost).
// Whisper (transformers.js) transcribes with word timestamps, then a canvas
// renderer applies jump cuts, zooms, hook, animated captions and synthesized SFX.
const $ = q => document.querySelector(q);
const W = 720, H = 1280, MODELS = { base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped' };
const cv = $('#cv');
let cx = cv.getContext('2d');
const v = document.createElement('video');
v.playsInline = true; v.muted = true; v.loop = true; v.setAttribute('playsinline', '');

let aiHookTitle = '', asrKey = '', file = null, words = [], speech = null, plan = null, asr = null, busy = false, aiRunning = false;
let ac = null, dest = null, noiseBuf = null, rec = null, lastSeg = -1, lastChunk = -1;

const msg = t => { $('#msg').textContent = t; };
const prog = p => { $('#prog').style.width = Math.max(0, Math.min(100, p * 100)) + '%'; };
const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const back = x => { x = Math.max(0, Math.min(1, x)); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const clean = s => s.replace(/[^\p{L}\p{N}]/gu, '');
const on = id => { const el = document.getElementById(id); return !!el && el.checked; };

// ---------- Upload ----------
function load(f) {
  if (!f) return;
  if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) { alert('Ese archivo no es un video. Elegí un MP4, MOV o WEBM.'); return; }
  if (f.size > 1e9) { alert('El video pesa más de 1 GB. Probá con uno más corto.'); return; }
  file = f; words = []; plan = null; lastSeg = lastChunk = -1; aiHookTitle = ''; aiTypo = aiRecipe = ''; brollPicks = []; brollFor = null;
  v.src = URL.createObjectURL(f); v.load(); v.play().catch(() => {});
  $('#dl').hidden = true; $('#go').disabled = true; $('#txt').value = ''; prog(0);
  if (window.onLoaded) window.onLoaded(f);
  v.onloadedmetadata = () => {
    if (v.duration > 185) msg('El video dura más de 3 minutos. Va a tardar más en procesarse.');
    runAI();
  };
}
v.onerror = () => msg('Tu navegador no puede abrir este video. Probá con un MP4 o con Chrome/Safari actualizado.');
$('#file').onchange = e => load(e.target.files[0]);
const d = $('#drop');
['dragenter', 'dragover'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.add('over'); }));
['dragleave', 'drop'].forEach(n => d.addEventListener(n, e => { e.preventDefault(); d.classList.remove('over'); }));
d.addEventListener('drop', e => load(e.dataTransfer.files[0]));

// ---------- Transcription ----------
// Returns a transcribe(audio, opts) function backed by a Web Worker (falls back to the main thread).
let worker = null;
async function getAsr() {
  const model = MODELS[$('#quality').value] || MODELS.base;
  msg('Preparando el motor de subtítulos…');
  if (!worker) { try { worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' }); } catch (e) { worker = null; } }
  if (worker) return (audio, opts) => new Promise((ok, ko) => {
    worker.onmessage = e => {
      const d = e.data;
      if (d.type === 'progress') { prog(d.a / d.b * .5); msg(`Descargando el motor de subtítulos… ${Math.round(d.a / 1e6)} de ${Math.round(d.b / 1e6)} MB (solo la primera vez)`); }
      else if (d.type === 'transcribing') { prog(.7); msg('Escribiendo los subtítulos…'); }
      else if (d.type === 'done') ok(d.out);
      else if (d.type === 'error') ko(new Error(d.err));
    };
    worker.postMessage({ model, audio, opts }, [audio.buffer]);
  });
  if (asr && asrKey === model) return asr;
  asrKey = model;
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'wasm' });
  return asr;
}

async function audio16k(f) {
  const buf = await f.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const dec = await new Promise((ok, ko) => ctx.decodeAudioData(buf, ok, ko));
  ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(dec.duration * 16000), 16000);
  const s = off.createBufferSource(); s.buffer = dec; s.connect(off.destination); s.start();
  return (await off.startRendering()).getChannelData(0);
}

async function runAI() {
  if (!file || aiRunning) return;
  aiRunning = true; $('#ai').disabled = true; $('#go').disabled = true;
  try {
    const model = await getAsr();
    msg('Escuchando tu video…'); prog(.55);
    const audio = await audio16k(file);
    speech = detectSpeech(audio);
    msg('Escribiendo los subtítulos… (puede tardar unos segundos por cada minuto de video)'); prog(.65);
    const opts = { task: $('#task').value, return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 };
    if ($('#lang').value) opts.language = $('#lang').value;
    const out = await model(audio, opts);
    words = (out.chunks || []).map(c => ({ t: c.text.trim(), s: c.timestamp[0], e: c.timestamp[1] ?? c.timestamp[0] + .3 }))
      .filter(w => w.t && w.e >= w.s);
    $('#txt').value = words.map(w => w.t).join(' ');
    build();
    prog(1);
    if (words.length && window.onTranscribed) window.onTranscribed();
    msg(words.length
      ? `¡Listo! ${words.length} palabras, ${plan.segs.length - 1} cortes. Mirá la vista previa y tocá Exportar.`
      : 'No escuché voz en el video. Escribí el texto abajo y exportá igual.');
  } catch (e) {
    console.error(e);
    build();
    msg('No pude transcribir en este dispositivo. Escribí el texto abajo y exportá igual.');
  }
  aiRunning = false; $('#ai').disabled = false; $('#go').disabled = !plan;
}
$('#ai').onclick = runAI;

$('#txt').oninput = () => {
  const nw = $('#txt').value.trim().split(/\s+/).filter(Boolean);
  if (nw.length === words.length) nw.forEach((t, i) => { words[i].t = t; });
  else if (nw.length) {
    const s0 = words.length ? words[0].s : 0, e0 = words.length ? words.at(-1).e : (v.duration || 1);
    const step = (e0 - s0) / nw.length;
    words = nw.map((t, i) => ({ t, s: s0 + step * i, e: s0 + step * (i + 1) }));
  } else words = [];
  build();
};
['optCut', 'optHook'].forEach(id => { $('#' + id).onchange = build; });
$('#ctaWord').oninput = build;

// Speech regions from audio energy (20 ms frames); silences longer than 0.35 s get cut.
function detectSpeech(a) {
  const F = 320, n = Math.floor(a.length / F), rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let sum = 0; for (let j = i * F; j < (i + 1) * F; j++) sum += a[j] * a[j]; rms[i] = Math.sqrt(sum / F); }
  const sorted = Array.from(rms).sort((x, y) => x - y);
  const floor = sorted[Math.floor(n * .1)] || 0, peak = sorted[Math.floor(n * .95)] || 0;
  const th = Math.max(.008, floor + (peak - floor) * .12);
  const regs = []; let st = -1;
  for (let i = 0; i <= n; i++) {
    const loud = i < n && rms[i] > th;
    if (loud && st < 0) st = i;
    if (!loud && st >= 0) { regs.push({ s: st * .02, e: i * .02 }); st = -1; }
  }
  return regs;
}

// ---------- Edit plan ----------
function build() {
  dirty = true;
  const D = v.duration || 0;
  if (!D) return;
  let segs = [];
  const src = speech && speech.length ? speech : words;
  if (on('optCut') && src.length) {
    for (const r of src) {
      const s = Math.max(0, r.s - .1), e = Math.min(D, r.e + .12), l = segs.at(-1);
      if (l && s - l.e < .35) l.e = Math.max(l.e, e); else segs.push({ s, e });
    }
    segs = segs.filter(g => g.e - g.s > .15);
  }
  if (!segs.length) segs = [{ s: 0, e: D }];
  let acc = 0;
  segs.forEach((g, i) => { g.o = acc; acc += g.e - g.s; g.z = i % 2 ? 1.07 : 1; g.fx = .5; });

  const chunks = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const nx = words[i + 1];
    if (cur.length >= 3 || cur.map(x => x.t).join(' ').length >= 15 || /[.,!?;:]$/.test(w.t) || !nx || nx.s - w.e > .35) { chunks.push(cur); cur = []; }
  });
  chunks.forEach((c, i) => {
    c.s = c[0].s; c.e = c.at(-1).e;
    c.key = c.reduce((a, w) => clean(w.t).length > clean(a.t).length ? w : a, c[0]);
    c.emph = clean(c.key.t).length >= 7 || /[!?]$/.test(c.at(-1).t) || i % 4 === 0;
  });

  let hook = '', hookDur = 2.6;
  if (words.length) {
    const hw = [];
    for (const w of words) { hw.push(w); if (hw.length >= 8 || /[.!?]$/.test(w.t)) break; }
    hook = aiHookTitle || hw.map(w => w.t).join(' ').replace(/[.,;:]$/, '');
    hookDur = Math.min(6, Math.max(2.6, hw.at(-1).e - hw[0].s + 1.6));
  }
  plan = { segs, chunks, total: acc, hook, hookDur, list: findList(), cta: findCta() };
  { let lastP = -9; plan.punches = chunks.filter(c => { if (!c.emph || c.s - lastP < 3.5) return false; lastP = c.e; return true; }).map(c => ({ s: c.s, e: c.e })); }
  plan.screens = findScreens(plan);
  plan.overlays = findOverlays(plan);

  plan.beats = makeBeats(plan);
  loadAiArt(plan);
  $('#go').disabled = aiRunning;
}

// ---- Auto "list screen": detects "uno… dos… tres…" / "primero… segundo…" in what you say.
const WEAK = new Set(['un', 'una', 'uno', 'dos', 'tres', 'cuatro', 'cinco']);
const ORD = { primero: 1, primera: 1, uno: 1, una: 1, un: 1, first: 1, segundo: 2, segunda: 2, dos: 2, second: 2, tercero: 3, tercera: 3, tres: 3, third: 3, cuarto: 4, cuarta: 4, cuatro: 4, fourth: 4, quinto: 5, quinta: 5, cinco: 5, fifth: 5 };
const STOP = /^(que|aunque|porque|para|antes|cuando|si|pero|sin|como|mientras|because|that|before|when|so)$/i;
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function findList() {
  const marks = []; let want = 1, last = -1;
  words.forEach((w, i) => {
    const n = ORD[norm(w.t)] || (/^[1-5][.):]?$/.test(w.t.trim()) ? +w.t.trim()[0] : 0);
    if (n === want && (want === 1 || w.s - words[last].s < 25)) { marks.push(i); last = i; want++; }
    else if (n === 1 && want > 1 && marks.length < 2) { marks.length = 0; marks.push(i); last = i; want = 2; }
  });
  if (marks.length < 2 || (marks.length === 2 && marks.some(i => WEAK.has(norm(words[i].t))))) return null;
  const items = marks.map((m, k) => {
    const end = k + 1 < marks.length ? marks[k + 1] : words.length;
    const ws = [];
    for (let i = m + 1; i < end && ws.length < 11; i++) { ws.push(words[i]); if (/[.!?]$/.test(words[i].t)) break; }
    if (!ws.length) return null;
    let cut = ws.findIndex((w, i) => i > 0 && STOP.test(norm(w.t)));
    if (cut < 0 || cut > 4) cut = Math.min(3, ws.length);
    const strip = s => s.replace(/[.,;:!?]+$/, '');
    const title = ws.slice(0, cut).map(w => strip(w.t)), sub = ws.slice(cut, cut + 7).map(w => strip(w.t)).join(' ');
    title[0] = title[0].charAt(0).toUpperCase() + title[0].slice(1);
    return { n: k + 1, at: words[m].s, title, sub, end: ws.at(-1).e };
  }).filter(Boolean);
  if (items.length < 2) return null;
  return { items, s: items[0].at - .15, e: items.at(-1).end + .5 };
}
function findCta() {
  const manual = $('#ctaWord').value.trim();
  if (manual) return manual.toUpperCase();
  const m = words.map(w => w.t).join(' ').match(/coment[aá]\w*\s+(?:la palabra\s+)?["“'«]?([\p{L}\d]+)/iu);
  return m ? m[1].toUpperCase() : '';
}

// ---------- Rendering ----------
const STYLES = {
  coral: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 52, upper: false, hi: '#FF6046', soft: true, coral: true },
  viro: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 34, upper: false, hi: '#5CF58A', soft: true, glowKey: true, viro: true },
  viral: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 56, upper: false, hi: '#A6F94B', soft: true, glowKey: true },
  hormozi: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 64, upper: true, hi: '#22E06B', box: true },
  editorial: { font: s => SERIF(s), size: 82, upper: false, hi: '#E8D3A2', soft: true },
  minimal: { font: s => `600 ${s}px "Inter Tight", Inter, system-ui, sans-serif`, size: 52, upper: false, hi: '#ffffff', pill: true }
};
const C = { coral: '#F0452F', light: '#FF785C', dark: '#CE2C1A', cream: '#F4EFE6', row: '#F9F5EF', tint: '#FDE4DD', ink: '#181616', grey: '#928C86', night: '#34140E', halo: '#7A241A' };
const HAS_FILTER = 'filter' in cx;
const blur = px => { if (HAS_FILTER) cx.filter = px > .3 ? `blur(${px.toFixed(1)}px)` : 'none'; };
const isNum = s => /\d/.test(s);
const easeQ = x => { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 4); };
// Dark accents (e.g. deep blue) are hard to read over video: mix them with white until they are bright enough.
// Canvas text only uses web fonts that are already loaded: warm up the ones the looks draw with.
// ---- Font library: [name, category, Google Fonts axes spec, weight, italic] ----
const FONT_LIB = [
  ['Montserrat', 'Sans', 'wght@800;900', 800], ['Poppins', 'Sans', 'wght@800', 800], ['Plus Jakarta Sans', 'Sans', 'wght@800', 800], ['Inter Tight', 'Sans', 'wght@800', 800],
  ['Bricolage Grotesque', 'Sans', 'wght@800', 800], ['Manrope', 'Sans', 'wght@800', 800], ['Outfit', 'Sans', 'wght@800', 800], ['Nunito', 'Sans', 'wght@900', 900],
  ['Sora', 'Sans', 'wght@700', 700], ['Space Grotesk', 'Sans', 'wght@700', 700], ['Lexend', 'Sans', 'wght@800', 800], ['Syne', 'Sans', 'wght@800', 800], ['Unbounded', 'Sans', 'wght@800', 800],
  ['Montserrat Italic', 'Media cursiva', 'Montserrat:ital,wght@1,800', 800, true], ['Poppins Italic', 'Media cursiva', 'Poppins:ital,wght@1,800', 800, true],
  ['Playfair Display', 'Media cursiva', 'ital,wght@1,700', 700, true], ['Instrument Serif', 'Media cursiva', 'ital@1', 400, true], ['Fraunces', 'Media cursiva', 'ital,wght@1,700', 700, true],
  ['DM Serif Display', 'Media cursiva', 'ital@1', 400, true], ['Cormorant Garamond', 'Media cursiva', 'ital,wght@1,600', 600, true], ['Lora', 'Media cursiva', 'ital,wght@1,700', 700, true],
  ['Libre Baskerville', 'Media cursiva', 'ital@1', 400, true], ['EB Garamond', 'Media cursiva', 'ital,wght@1,600', 600, true],
  ['Great Vibes', 'Cursiva', '', 400], ['Pinyon Script', 'Cursiva', '', 400], ['Allura', 'Cursiva', '', 400], ['Parisienne', 'Cursiva', '', 400], ['Alex Brush', 'Cursiva', '', 400],
  ['Italianno', 'Cursiva', '', 400], ['Sacramento', 'Cursiva', '', 400], ['Mrs Saint Delafield', 'Cursiva', '', 400], ['Monsieur La Doulaise', 'Cursiva', '', 400],
  ['Dancing Script', 'Cursiva', 'wght@700', 700], ['Pacifico', 'Cursiva', '', 400], ['Satisfy', 'Cursiva', '', 400], ['Yellowtail', 'Cursiva', '', 400], ['Kaushan Script', 'Cursiva', '', 400],
  ['Lobster', 'Cursiva', '', 400], ['Cookie', 'Cursiva', '', 400], ['Damion', 'Cursiva', '', 400], ['Courgette', 'Cursiva', '', 400], ['Marck Script', 'Cursiva', '', 400],
  ['Caveat', 'Manuscrita', 'wght@700', 700], ['Permanent Marker', 'Manuscrita', '', 400], ['Shadows Into Light', 'Manuscrita', '', 400], ['Homemade Apple', 'Manuscrita', '', 400], ['Rock Salt', 'Manuscrita', '', 400],
  ['Anton', 'Impacto', '', 400], ['Bebas Neue', 'Impacto', '', 400], ['Oswald', 'Impacto', 'wght@700', 700], ['Big Shoulders Display', 'Impacto', 'wght@900', 900], ['Archivo Black', 'Impacto', '', 400],
  ['Dela Gothic One', 'Impacto', '', 400], ['Bowlby One', 'Impacto', '', 400], ['Titan One', 'Impacto', '', 400], ['Righteous', 'Impacto', '', 400], ['Abril Fatface', 'Impacto', '', 400], ['Gloock', 'Impacto', '', 400]
];
const FONT_BY = new Map(FONT_LIB.map(f => [f[0], f]));
// "Montserrat Italic" style entries are the italic cut of the real family.
const famOf = n => { const f = FONT_BY.get(n); return f && f[2].includes(':') ? f[2].split(':')[0] : n; };
const fontOf = (n, s) => { const f = FONT_BY.get(n) || [n, '', '', 400]; return `${f[4] ? 'italic ' : ''}${f[3]} ${Math.round(s)}px "${famOf(n)}", sans-serif`; };
const fontLoaded = new Set(['Inter']);
// Loads Google fonts on demand (one stylesheet per batch) and redraws when they are ready.
function ensureFonts(names) {
  const need = names.filter(n => FONT_BY.has(n) && !fontLoaded.has(n)); if (!need.length) return Promise.resolve();
  need.forEach(n => fontLoaded.add(n));
  const fam = need.map(n => { const f = FONT_BY.get(n); return 'family=' + (f[2].includes(':') ? f[2] : famOf(n) + (f[2] ? ':' + f[2] : '')).replace(/ /g, '+'); });
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap`;
  document.head.appendChild(link);
  return new Promise(r => { link.onload = r; link.onerror = r; })
    .then(() => Promise.all(need.map(n => document.fonts ? document.fonts.load(fontOf(n, 40)).catch(() => {}) : 0)))
    .then(() => { dirty = true; });
}
// Professional type pairings for the Pro look: title, elegant kicker, captions and the key-word colors.
// Each video gets one (chosen by the AI or from its words), so edits never look all the same.
const TYPO = {
  nova: { name: 'Nova', title: s => `800 ${s}px "Bricolage Grotesque", sans-serif`, kicker: s => `italic 400 ${s}px "Instrument Serif", serif`, cap: s => `800 ${s}px "Bricolage Grotesque", sans-serif`, keyF: 'Instrument Serif', key: ['#2F7BFF', '#7CC4FF'], hi: '#5CF58A' },
  lujo: { name: 'Lujo', title: s => `800 ${s}px Syne, sans-serif`, kicker: s => `italic 600 ${s * 1.1}px "Cormorant Garamond", serif`, cap: s => `800 ${s}px Manrope, sans-serif`, keyF: 'Pinyon Script', key: ['#D9A441', '#F6E3A8'], hi: '#F4D58D' },
  revista: { name: 'Revista', title: s => `800 ${s}px Fraunces, serif`, kicker: s => `italic 400 ${s}px "Instrument Serif", serif`, cap: s => `800 ${s}px "Inter Tight", sans-serif`, keyF: 'Playfair Display', key: ['#FF5A36', '#FFA07A'], hi: '#FF8A5B' },
  tech: { name: 'Tech', title: s => `800 ${s * .86}px Unbounded, sans-serif`, kicker: s => `600 ${s * .62}px "JetBrains Mono", monospace`, cap: s => `700 ${s}px Sora, sans-serif`, keyF: 'Unbounded', key: ['#7C5CFF', '#C9A7FF'], hi: '#B69CFF' },
  suave: { name: 'Suave', title: s => `800 ${s}px "Plus Jakarta Sans", sans-serif`, kicker: s => `italic 400 ${s}px "DM Serif Display", serif`, cap: s => `900 ${s}px Nunito, sans-serif`, keyF: 'Pacifico', key: ['#FF3D6E', '#FF9BB5'], hi: '#FF7BA3' },
  clasico: { name: 'Clásico', title: s => `400 ${s * .92}px "Archivo Black", sans-serif`, kicker: s => `italic 700 ${s * .9}px "Playfair Display", serif`, cap: s => `800 ${s}px Montserrat, sans-serif`, keyF: 'Great Vibes', key: ['#FFC21A', '#FFE58A'], hi: '#FFD23F' },
  urbano: { name: 'Urbano', title: s => `700 ${s}px "Space Grotesk", sans-serif`, kicker: s => `700 ${s * 1.15}px Caveat, cursive`, cap: s => `700 ${s}px "Space Grotesk", sans-serif`, keyF: 'Permanent Marker', key: ['#16C964', '#9BF6B9'], hi: '#5CF58A' }
};
let aiTypo = '';
// ---- Edit formats: each one changes captions, titles, transitions, phrase screens, hook and pace. The AI picks one per video. ----
const RECIPES = {
  cine: { name: 'Cine', desc: 'Imágenes a pantalla completa, títulos arriba, subtítulos con brillo', cap: 'glow', capY: .76, broll: 'full', titles: ['tl', 'tl', 'center'], trans: 'leak', kinBg: ['white', 'black'], kinGap: 6, kinMax: 3, brollSec: 5, hook: 'stack' },
  podcast: { name: 'Podcast', desc: 'Pantalla dividida, subtítulos en franja blanca, ritmo tranquilo', cap: 'pill', capY: .72, broll: 'split', titles: ['center'], trans: 'slide', kinBg: ['blur', 'black'], kinGap: 9, kinMax: 2, brollSec: 6, hook: 'question' },
  energia: { name: 'Energía', desc: 'Cortes rápidos, palabra en recuadro de color, destellos', cap: 'box', capY: .7, broll: 'full', titles: ['center', 'bottom'], trans: 'flash', kinBg: ['accent', 'black', 'white'], kinGap: 4.5, kinMax: 4, brollSec: 4, hook: 'stack' },
  historia: { name: 'Historia', desc: 'Cursivas elegantes, imágenes en tarjeta, transiciones suaves', cap: 'serif', capY: .74, broll: 'card', titles: ['bottom', 'tl'], trans: 'zoom', kinBg: ['blur', 'white'], kinGap: 8, kinMax: 2, brollSec: 6, hook: 'viro' },
  noticia: { name: 'Noticia', desc: 'Palabra por palabra en grande, apertura en negro, impacto', cap: 'word', capY: .66, broll: 'full', titles: ['tl', 'bottom'], trans: 'slide', kinBg: ['black', 'accent'], kinGap: 5, kinMax: 3, brollSec: 4.5, hook: 'blackout' },
  minimal: { name: 'Minimal', desc: 'Limpio y sobrio, subtítulos chicos abajo, pocas pantallas', cap: 'glow', capY: .8, broll: 'card', titles: ['bottom'], trans: 'blur', kinBg: ['white'], kinGap: 10, kinMax: 1, brollSec: 7, hook: 'viro' }
};
let aiRecipe = '';
const recipeKey = () => { const v2 = val('recipe', 'auto'); if (RECIPES[v2]) return v2; if (RECIPES[aiRecipe]) return aiRecipe; const ks = Object.keys(RECIPES), h = [...words.slice(0, 8).map(w => w.t).join('')].reduce((a, c) => (a * 17 + c.charCodeAt(0)) >>> 0, 11); return ks[h % ks.length]; };
const recipe = () => RECIPES[recipeKey()];
// B-roll layout: the format decides unless the person picked one.
const blay = () => { const v2 = val('brollLayout', 'auto'); return v2 !== 'auto' ? v2 : style().viro ? recipe().broll : 'split'; };
const typoKey = () => { const v2 = val('typo', 'auto'); if (TYPO[v2]) return v2; if (TYPO[aiTypo]) return aiTypo; const ks = Object.keys(TYPO), h = [...words.slice(0, 12).map(w => w.t).join('')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 3); return ks[h % ks.length]; };
const typo = () => TYPO[typoKey()];
if (document.fonts) Object.values(TYPO).flatMap(T => [T.title(60), T.kicker(46), T.cap(36)]).concat(['400 40px Anton']).forEach(f => document.fonts.load(f).catch(() => {}));
setTimeout(() => ensureFonts(Object.values(TYPO).map(T => T.keyF)), 0);
// The three type roles of the Pro look: base text, highlighted word and cursive accent (manual pick or the pack's).
const baseF = s => { const f = val('fBase', 'auto'); return f !== 'auto' ? fontOf(f, s) : typo().cap(s); };
const keyF = s => { const f = val('fKey', 'auto'); return fontOf(f !== 'auto' ? f : typo().keyF, s * +val('sKey', 1)); };
const accF = s => { const f = val('fAccent', 'auto'); return (f !== 'auto' ? fontOf(f, s * +val('sAccent', 1)) : typo().kicker(s * +val('sAccent', 1))); };
const lift = hex => { const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const L = (.2126 * r + .7152 * g + .0722 * b) / 255; if (L >= .5) return hex; const m = Math.min(.6, (.55 - L) / (1 - L)); r += (255 - r) * m; g += (255 - g) * m; b += (255 - b) * m; return `rgb(${r | 0},${g | 0},${b | 0})`; };
const style = () => {
  const st = { ...fontOverride(STYLES[$("#style").value] || STYLES.viral) };
  const k = val('cKey', 'auto'), b = val('cBase', 'auto');
  const th = THEMES[themeKey()];
  if (st.viro) { st.font = baseF; st.hi = typo().hi; }
  return { ...st, size: st.size * +val('sBase', 1), hi: k !== 'auto' ? k : st.pill || st.viro ? st.hi : lift(th.accent), glowC: st.viro ? st.hi : th.glow || th.accent, base: b === 'auto' ? '#fff' : b };
};

function wordsLayout(list, st) {
  const txt = w => st.upper ? w.t.toUpperCase() : st.lower ? w.t.toLowerCase() : w.t;
  let size = st.size;
  for (;;) {
    cx.font = st.font(size);
    const sp = size * .3, ws = list.map(w => cx.measureText(txt(w)).width);
    const width = (a, b) => ws.slice(a, b).reduce((x, y) => x + y, 0) + sp * (b - a - 1);
    let lines = [[0, list.length]];
    if (width(0, list.length) > W * .84 && list.length > 1) {
      let best = 1, bw = Infinity;
      for (let k = 1; k < list.length; k++) { const m = Math.max(width(0, k), width(k, list.length)); if (m < bw) { bw = m; best = k; } }
      lines = [[0, best], [best, list.length]];
    }
    if (Math.max(...lines.map(([a, b]) => width(a, b))) < W * .84 || size < 32) return { size, sp, ws, lines, width, txt };
    size -= 4;
  }
}

function rrect(x, y, w, h, r) { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); }

let capX = W / 2, capY = H * .69;
function drawCaption(ch, t) {
  if (!ch) return;
  const st = style();
  if (st.viro) return viroCaption(ch, t, st);
  const L = wordsLayout(ch, st);
  const age = t - ch.s;
  const sc = st.soft ? 1 : .7 + .3 * back(age / .16);
  const alpha = st.soft ? ease(age / .22) : 1;
  const yOff = st.soft ? 16 * (1 - ease(age / .3)) : 0;
  cx.save();
  cx.translate(capX, capY + yOff); cx.scale(sc, sc); cx.globalAlpha = alpha;
  if (st.coral) blur(8 * (1 - ease(age / .25)));
  cx.font = st.font(L.size); cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  if ('letterSpacing' in cx) cx.letterSpacing = st.upper ? '0.02em' : '-0.01em';
  const lh = L.size * 1.12, y0 = -(L.lines.length - 1) * lh / 2;
  L.lines.forEach(([a, b], li) => {
    const lw = L.width(a, b), y = y0 + li * lh;
    if (st.pill) { cx.fillStyle = 'rgba(0,0,0,.62)'; rrect(-lw / 2 - 26, y - L.size * .8, lw + 52, L.size * 1.6, 22); cx.fill(); }
    let x = -lw / 2;
    for (let i = a; i < b; i++) {
      const w = ch[i], active = t >= w.s && (i === ch.length - 1 || t < ch[i + 1].s), isKey = w === ch.key;
      const ww = L.ws[i], word = L.txt(w);
      cx.save(); cx.translate(x + ww / 2, y);
      if (active && st.box) cx.scale(1.05, 1.05);
      const boxed = st.box && active;
      if (boxed) { cx.fillStyle = st.hi; rrect(-ww / 2 - 10, -L.size * .6, ww + 20, L.size * 1.18, L.size * .22); cx.fill(); }
      // Legibility: soft shadow for every style; bold styles also get a thin, clean outline (never a thick blob).
      cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = st.pill ? 0 : L.size * .3; cx.shadowOffsetY = L.size * .04;
      if (st.box && !boxed) { cx.lineWidth = L.size * .08; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.strokeText(word, -ww / 2, 0); }
      const hot = st.coral ? (isNum(word) || (isKey && ch.emph)) : (active || isKey);
      if (st.glowKey && hot) { cx.shadowColor = st.glowC; cx.shadowBlur = L.size * .45; cx.shadowOffsetY = 0; }
      cx.fillStyle = boxed ? '#111' : st.box ? st.base : hot && !st.pill ? st.hi : st.base;
      if (st.pill) cx.fillStyle = active ? '#fff' : 'rgba(255,255,255,.6)';
      cx.fillText(word, -ww / 2, 0);
      cx.restore();
      x += ww + L.sp;
    }
  });
  blur(0);
  if ('letterSpacing' in cx) cx.letterSpacing = '0px';
  cx.restore();
}

// Viro look (same as viroedit): small lowercase base words, the spoken word lights up with a glow,
// the key word in the "palabra destacada" font; a strong last word drops to its own line, big and glowing.
function viroCaption(ch, t, st) {
  const mode = recipe().cap;
  if (mode === 'pill' || mode === 'box' || mode === 'serif') return lineCaption(ch, t, st, mode);
  if (mode === 'word') return wordCaption(ch, t, st);
  const age = t - ch.s, a = ease(age / .18), solo = ch.emph && ch.length > 1 && clean(ch.key.t).length >= 4;
  const main = solo ? ch.filter(w => w !== ch.key) : ch, low = w => w.t.toLowerCase().replace(/[.,;:!?¿¡"]+/g, '');
  const isK = w => w === ch.key && ch.emph;
  cx.save(); cx.globalAlpha = a; cx.translate(capX, capY + 10 * (1 - a));
  cx.textBaseline = 'middle'; cx.textAlign = 'left'; cx.lineJoin = 'round';
  const fnt = (w, size) => isK(w) ? keyF(size * 1.18) : st.font(size);
  const word = (w, size, x, y, big) => {
    const on2 = t >= w.s - .03, tx = low(w);
    cx.font = big ? keyF(size) : fnt(w, size);
    cx.shadowColor = 'rgba(0,0,0,.75)'; cx.shadowBlur = size * .4; cx.shadowOffsetY = 2;
    const lit = on2 && (big || isK(w) || t < w.e + .08);
    if (lit) { cx.shadowColor = st.glowC; cx.shadowBlur = size * (big ? .8 : .55); cx.shadowOffsetY = 0; cx.fillStyle = st.hi; }
    else cx.fillStyle = on2 ? '#fff' : 'rgba(255,255,255,.6)';
    cx.fillText(tx, x, y); if (lit) cx.fillText(tx, x, y);
  };
  let size = st.size;
  const wid = sz => main.reduce((q, w) => { cx.font = fnt(w, sz); return q + cx.measureText(low(w)).width; }, 0) + sz * .27 * (main.length - 1);
  while (wid(size) > W * .84 && size > 24) size -= 2;
  const tot = wid(size); let x = -tot / 2; const y = solo ? -size * .6 : 0;
  main.forEach(w => { cx.font = fnt(w, size); const ww = cx.measureText(low(w)).width; word(w, size, x, y, false); x += ww + size * .27; });
  if (solo && t >= ch.key.s - .05) {
    const k = back((t - ch.key.s) / .3);
    let bs = size * 2.1; cx.font = keyF(bs); while (cx.measureText(low(ch.key)).width > W * .8 && bs > 40) { bs -= 4; cx.font = keyF(bs); }
    const bw = cx.measureText(low(ch.key)).width;
    cx.save(); cx.translate(0, size * .45 + bs * .5); cx.scale(.7 + .3 * k, .7 + .3 * k); word(ch.key, bs, -bw / 2, 0, true); cx.restore();
  }
  cx.restore();
}

// Text hook like the best creators: 2-3 stacked lines mixing a script line and heavy uppercase lines, at the top for ~3s.
function drawStackHook(text, ot, dur) {
  const out = ot > dur - .3 ? ease((ot - dur + .3) / .3) : 0; if (out >= 1) return;
  const ws = text.replace(/[¿?¡!.]/g, '').split(' ').filter(Boolean); if (!ws.length) return;
  const n1 = ws.length > 4 ? 2 : 1, l1 = ws.slice(0, n1).join(' '), rest = ws.slice(n1), mid = Math.ceil(rest.length / 2);
  const lines = [[l1, 'script'], [rest.slice(0, mid).join(' ').toUpperCase(), 'heavy'], [rest.slice(mid).join(' ').toUpperCase(), 'big']].filter(l => l[0]);
  const T = typo(), heavy = z => val('fBase', 'auto') !== 'auto' ? baseF(z) : `400 ${z}px Anton, Impact, sans-serif`;
  const F = (kind, z) => kind === 'script' ? keyF(z * 1.1) : heavy(kind === 'big' ? z * 1.35 : z);
  let size = 70; const fits = z => lines.every(([tx, kd]) => { cx.font = F(kd, z); return cx.measureText(tx).width < W * .86; });
  while (!fits(size) && size > 28) size -= 3;
  cx.save(); cx.globalAlpha = 1 - out; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  let y = H * .16;
  lines.forEach(([tx, kd], i) => {
    const a = easeQ((ot - .1 - i * .14) / .35), z = kd === 'big' ? size * 1.35 : size;
    cx.save(); cx.globalAlpha = (1 - out) * a; cx.translate(W / 2, y + 16 * (1 - a)); cx.scale(.9 + .1 * a, .9 + .1 * a);
    cx.font = F(kd, size);
    if (kd === 'script') { cx.shadowColor = 'rgba(0,0,0,.7)'; cx.shadowBlur = 20; cx.fillStyle = '#fff'; }
    else if (kd === 'big') { cx.shadowColor = T.hi; cx.shadowBlur = 26; cx.fillStyle = T.hi; }
    else { cx.shadowColor = 'rgba(0,0,0,.7)'; cx.shadowBlur = 18; cx.fillStyle = '#fff'; }
    cx.fillText(tx, 0, 0); if (kd === 'big') { cx.shadowBlur = 8; cx.fillText(tx, 0, 0); }
    cx.restore();
    y += z * (kd === 'script' ? .95 : .92);
  });
  cx.restore();
}
// Other caption looks of the formats: white pill, colored box on the spoken word, cursive line.
function lineCaption(ch, t, st, mode) {
  const age = t - ch.s, a = ease(age / .16), out = t > ch.e + .05 ? ease((t - ch.e - .05) / .15) : 0;
  const isK = w => w === ch.key && ch.emph, up = mode === 'box';
  // Cursive faces never go uppercase (unreadable); the key word keeps its case.
  const tx = ch.map(w => { const x2 = w.t.replace(/[.,;:!?¿¡"]+/g, ''); return up && !isK(w) ? x2.toUpperCase() : isK(w) ? x2.toLowerCase() : x2; });
  let size = st.size * (mode === 'serif' ? 1.3 : mode === 'box' ? 1.05 : 1);
  const F = (w, z) => isK(w) ? keyF(z * 1.12) : mode === 'serif' ? accF(z) : st.font(z);
  const wd = z => ch.reduce((q, w, i) => { cx.font = F(w, z); return q + cx.measureText(tx[i]).width; }, 0) + z * .28 * (ch.length - 1);
  while (wd(size) > W * .8 && size > 24) size -= 2;
  const tot = wd(size), ph = size * 1.55, padX = size * .55;
  cx.save(); cx.globalAlpha = a * (1 - out); cx.translate(capX, capY + 8 * (1 - a));
  const sc = .92 + .08 * back(age / .25); cx.scale(sc, sc);
  cx.textBaseline = 'middle'; cx.textAlign = 'left'; cx.lineJoin = 'round';
  if (mode === 'pill') { cx.shadowColor = 'rgba(0,0,0,.3)'; cx.shadowBlur = 18; cx.shadowOffsetY = 4; rrect(-tot / 2 - padX, -ph / 2, tot + padX * 2, ph, ph / 2); cx.fillStyle = '#fff'; cx.fill(); cx.shadowColor = 'transparent'; }
  let x = -tot / 2;
  ch.forEach((w, i) => {
    cx.font = F(w, size); const ww = cx.measureText(tx[i]).width, on2 = t >= w.s - .03, act = on2 && (i === ch.length - 1 || t < ch[i + 1].s);
    if (mode === 'pill') { cx.fillStyle = isK(w) ? st.hi : '#151515'; cx.globalAlpha = a * (1 - out) * (on2 ? 1 : .4); }
    else if (mode === 'box') {
      if (act) { cx.save(); cx.fillStyle = st.hi; rrect(x - size * .18, -size * .62, ww + size * .36, size * 1.2, size * .22); cx.fill(); cx.restore(); }
      cx.shadowColor = act ? 'transparent' : 'rgba(0,0,0,.8)'; cx.shadowBlur = size * .3;
      if (!act) { cx.lineWidth = size * .09; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.strokeText(tx[i], x, 0); }
      cx.fillStyle = act ? '#111' : isK(w) ? st.hi : '#fff'; cx.globalAlpha = a * (1 - out);
    } else { cx.shadowColor = isK(w) && on2 ? st.glowC : 'rgba(0,0,0,.75)'; cx.shadowBlur = size * .45; cx.fillStyle = isK(w) && on2 ? st.hi : on2 ? '#fff' : 'rgba(255,255,255,.55)'; }
    cx.fillText(tx[i], x, 0); x += ww + size * .28;
  });
  cx.restore();
}
// "Noticia" format: one word at a time, big and centered, the key words in the highlight font.
function wordCaption(ch, t, st) {
  let i = ch.findIndex((w, j) => t >= w.s - .02 && (j === ch.length - 1 || t < ch[j + 1].s - .02)); if (i < 0) i = 0;
  const w = ch[i], age = t - w.s, k = back(age / .22), isK = w === ch.key && ch.emph;
  const raw = w.t.replace(/[.,;:!?¿¡"]+/g, ''), tx = isK ? raw.toLowerCase() : raw.toUpperCase();
  let size = st.size * (isK ? 2.4 : 2); const F = z => isK ? keyF(z) : st.font(z);
  cx.font = F(size); while (cx.measureText(tx).width > W * .82 && size > 30) { size -= 4; cx.font = F(size); }
  cx.save(); cx.translate(capX, capY); cx.scale(.75 + .25 * k, .75 + .25 * k); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  cx.lineWidth = size * .1; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.strokeText(tx, 0, 0);
  cx.shadowColor = isK ? st.glowC : 'rgba(0,0,0,.6)'; cx.shadowBlur = size * .4;
  cx.fillStyle = isK ? st.hi : '#fff'; cx.fillText(tx, 0, 0);
  cx.restore();
}

function drawHook(text, ot) {
  const k = back(ot / .35), out = ot > 2.4 ? ease((ot - 2.4) / .35) : 0;
  if (out >= 1) return;
  cx.save();
  cx.translate(W / 2, H * .17); cx.rotate(-.035); cx.scale(k * (1 - out * .3), k * (1 - out * .3)); cx.globalAlpha = 1 - out;
  let size = 58; cx.font = `900 ${size}px Montserrat, Inter, sans-serif`;
  const up = text.toUpperCase(), lines = [];
  let line = '';
  for (const w of up.split(' ')) {
    const tryL = line ? line + ' ' + w : w;
    if (cx.measureText(tryL).width > W * .74 && line) { lines.push(line); line = w; } else line = tryL;
  }
  lines.push(line);
  const lh = size * 1.15, bw = Math.max(...lines.map(l => cx.measureText(l).width)) + 56, bh = lines.length * lh + 36;
  cx.fillStyle = '#fff'; cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 30;
  rrect(-bw / 2, -bh / 2, bw, bh, 18); cx.fill(); cx.shadowBlur = 0;
  cx.fillStyle = '#0b0b10'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  lines.forEach((l, i) => cx.fillText(l, 0, -bh / 2 + 18 + lh * (i + .5)));
  cx.restore();
}

// Coral hook: white card at the top, words appear one by one with blur, numbers/key word in coral.
function drawHookCard(text, ot, dur) {
  const out = ot > dur - .35 ? ease((ot - dur + .35) / .35) : 0;
  if (out >= 1) return;
  const ws = text.split(' '), size = 40;
  cx.save();
  cx.font = `800 ${size}px "Plus Jakarta Sans", Inter, sans-serif`;
  const sp = size * .28, lines = [[]]; let lw = 0;
  ws.forEach(w => { const ww = cx.measureText(w).width; if (lw + ww > W * .72 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(w); lw += ww + sp; });
  const lwid = l => l.reduce((a, w) => a + cx.measureText(w).width, 0) + sp * (l.length - 1);
  const lh = size * 1.25, bw = W * .86, bh = lines.length * lh + 44;
  const key = ws.reduce((a, w) => clean(w).length > clean(a).length ? w : a, ws[0]);
  const enter = ease(ot / .45);
  cx.globalAlpha = (1 - out) * Math.min(1, ot / .2);
  cx.translate(W / 2, 70 + bh / 2 - 30 * (1 - enter) - 20 * out);
  blur(10 * (1 - enter) + 8 * out);
  cx.shadowColor = 'rgba(0,0,0,.18)'; cx.shadowBlur = 30; cx.shadowOffsetY = 8;
  cx.fillStyle = '#fff'; rrect(-bw / 2, -bh / 2, bw, bh, 28); cx.fill();
  cx.shadowColor = 'transparent';
  cx.textBaseline = 'middle';
  let n = 0;
  lines.forEach((l, li) => {
    let x = -lwid(l) / 2; const y = -bh / 2 + 22 + lh * (li + .5);
    l.forEach(w => {
      const a = ease((ot - .15 - n * .1) / .3); n++;
      const ww = cx.measureText(w).width;
      if (a > 0) {
        cx.save(); cx.globalAlpha *= a; blur(6 * (1 - a));
        cx.fillStyle = (isNum(w) || w === key) ? C.coral : C.ink;
        cx.fillText(w, x, y + 8 * (1 - a)); cx.restore();
      }
      x += ww + sp;
    });
  });
  blur(0);
  cx.restore();
}

// Opening that starts on black with the hook title, then cuts to you.
function drawBlackout(text, ot) {
  const k = ot < .85 ? 1 : 1 - ease((ot - .85) / .25);
  cx.save(); cx.globalAlpha = k; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
  const ws = text.toUpperCase().split(' '), lines = [[]]; let size = 92; cx.font = ANTON(size);
  ws.forEach(w => { const tryL = [...lines.at(-1), w].join(' '); if (cx.measureText(tryL).width > W * .82 && lines.at(-1).length) lines.push([w]); else lines.at(-1).push(w); });
  const lh = size * 1.05, y0 = H * .45 - (lines.length - 1) * lh / 2;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  lines.forEach((l, i) => { const a = ease((ot - i * .12) / .3); cx.globalAlpha = k * a; cx.fillStyle = i === lines.length - 1 ? theme().accent : '#fff'; cx.fillText(l.join(' '), W / 2, y0 + i * lh + 20 * (1 - a)); });
  cx.restore();
}
// Big question over a darkened opening.
function drawHookQuestion(text, ot, dur) {
  const out = ot > dur - .3 ? ease((ot - dur + .3) / .3) : 0; if (out >= 1) return;
  const q = /[?¿]$/.test(text) ? text : `¿${text.replace(/[.!]+$/, '')}?`;
  cx.save(); cx.fillStyle = `rgba(0,0,0,${.45 * (1 - out)})`; cx.fillRect(0, 0, W, H);
  let size = 64; cx.font = `800 ${size}px "Plus Jakarta Sans", Inter, sans-serif`;
  const ws = q.split(' '), lines = [[]];
  ws.forEach(w => { const tryL = [...lines.at(-1), w].join(' '); if (cx.measureText(tryL).width > W * .8 && lines.at(-1).length) lines.push([w]); else lines.at(-1).push(w); });
  const lh = size * 1.18, y0 = H * .42 - (lines.length - 1) * lh / 2, k = back(ot / .4);
  cx.translate(W / 2, y0); cx.scale(k * (1 - out * .2), k * (1 - out * .2)); cx.globalAlpha = 1 - out;
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = 24;
  lines.forEach((l, i) => { cx.fillStyle = i === lines.length - 1 ? theme().accent : '#fff'; cx.fillText(l.join(' '), 0, i * lh); });
  cx.restore();
}

// Captions that follow your head: they sit just above it, read from the silhouette mask.
let headN = 0, headX = W / 2, headTop = H * .2;
function followHead(x, y, w, h) {
  if (!seg) { loadSeg(); return; }
  if (headN++ % 3 === 0 && updateMask() && maskImg) {
    const mw = maskCv.width, mh = maskCv.height, d = maskImg.data;
    let top = -1, sx2 = 0, n = 0;
    for (let r = 0; r < mh && top < 0; r += 2) { let c = 0; for (let q = 0; q < mw; q += 2) if (d[(r * mw + q) * 4 + 3] > 128) c++; if (c > mw * .03) top = r; }
    if (top >= 0) {
      for (let r = top; r < Math.min(mh, top + mh * .12); r += 2) for (let q = 0; q < mw; q += 2) if (d[(r * mw + q) * 4 + 3] > 128) { sx2 += q; n++; }
      const hx = x + (n ? sx2 / n : mw / 2) / mw * w, ht = y + top / mh * h;
      headX += (hx - headX) * .35; headTop += (ht - headTop) * .35;
    }
  }
  capX = Math.max(W * .3, Math.min(W * .7, headX)); capY = Math.max(H * .14, Math.min(H * .6, headTop - 70));
}
// Loop: the last moment dissolves into the very first frame, so the video replays seamlessly.
const loopCv = document.createElement('canvas'); loopCv.width = W; loopCv.height = H;
let loopReady = false;
function loopBlend(ot, total) {
  // Reference frame taken right after the opening effects, so the ending dissolves into a clean shot of you.
  if (ot < .1) loopReady = false;
  if (!loopReady && ot > 1.2 && ot < 1.6) { loopCv.getContext('2d').drawImage(cv, 0, 0); loopReady = true; return; }
  if (!loopReady || ot < total - .45) return;
  cx.save(); cx.globalAlpha = ease((ot - (total - .45)) / .45); cx.drawImage(loopCv, 0, 0); cx.restore();
}

// ---- Coral motion graphics ----
function organic(cxp, cyp, r, seed, t) {
  cx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const rr = r * (1 + .07 * Math.sin(3 * a + seed + t * 2) + .05 * Math.sin(5 * a + seed * 2) + .03 * Math.sin(7 * a - t * 3));
    const px = cxp + Math.cos(a) * rr, py = cyp + Math.sin(a) * rr;
    i ? cx.lineTo(px, py) : cx.moveTo(px, py);
  }
  cx.closePath();
}
function coralFill() { const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FA5C42'); g.addColorStop(1, '#E83824'); return g; }
// k 0→1: blob grows from (px,py) until it covers the frame.
function blobCover(k, px, py, seed, t) {
  if (k <= 0) return;
  const R = Math.hypot(W, H) * 1.15 * ease(k);
  cx.save(); organic(px, py, R, seed, t); cx.fillStyle = coralFill(); cx.fill();
  cx.lineWidth = 10; cx.strokeStyle = 'rgba(255,170,150,.55)'; cx.stroke(); cx.restore();
}
// k 0→1: coral covers the frame and a hole opens revealing what is underneath.
function blobOpen(k, px, py, seed, t) {
  if (k >= 1) return;
  const R = Math.hypot(W, H) * 1.15 * ease(k);
  cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); organic(px, py, Math.max(1, R), seed, t);
  cx.fillStyle = coralFill(); cx.fill('evenodd'); cx.restore();
}
function pill(x, y, len, r, rot, b) {
  cx.save(); cx.translate(x, y); cx.rotate(rot); blur(b);
  const g = cx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, C.light); g.addColorStop(.55, C.coral); g.addColorStop(1, C.dark);
  rrect(-len / 2, -r, len, r * 2, r); cx.fillStyle = g; cx.fill();
  cx.globalAlpha = .45; rrect(-len / 2 + r * .5, -r * .7, len - r, r * .45, r * .25); cx.fillStyle = '#fff'; cx.fill();
  cx.globalAlpha = .25; cx.fillStyle = '#fff'; cx.fillRect(-r * .1, -r, r * .2, r * 2);
  cx.restore();
}
function check(x, y, r, b) {
  cx.save(); cx.translate(x, y); blur(b);
  const g = cx.createRadialGradient(-r * .35, -r * .45, r * .1, 0, 0, r); g.addColorStop(0, C.light); g.addColorStop(.6, C.coral); g.addColorStop(1, C.dark);
  cx.beginPath(); cx.arc(0, 0, r, 0, Math.PI * 2); cx.fillStyle = g; cx.shadowColor = 'rgba(206,44,26,.35)'; cx.shadowBlur = r * .4; cx.shadowOffsetY = r * .15; cx.fill();
  cx.shadowColor = 'transparent'; cx.lineWidth = r * .2; cx.lineCap = cx.lineJoin = 'round'; cx.strokeStyle = '#fff';
  cx.beginPath(); cx.moveTo(-r * .38, 0); cx.lineTo(-r * .1, r * .3); cx.lineTo(r * .42, -r * .28); cx.stroke();
  cx.restore();
}
function sparkle(x, y, s, col) {
  cx.save(); cx.translate(x, y); cx.fillStyle = col; cx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? s * .28 : s; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  cx.closePath(); cx.fill(); cx.restore();
}
function creamBg(t) {
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FBF7F1'); g.addColorStop(.55, C.tint); g.addColorStop(1, '#F9B7A6');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const f = (i, a) => Math.sin(t * .55 + i * 1.7) * a;
  pill(40 + f(1, 6), 70 + f(2, 8), 170, 46, -.75, 0);
  check(W - 70 + f(3, 5), 80 + f(4, 6), 30, 0);
  pill(70 + f(5, 8), H - 170 + f(6, 10), 300, 84, -.65, 6);
  check(W - 85 + f(7, 6), H - 260 + f(8, 8), 80, 0);
  [[60, 330], [W - 50, 520], [120, 800], [W - 140, 980], [W / 2 + 40, 160]].forEach(([x, y], i) => sparkle(x + f(i, 4), y + f(i + 3, 6), 9 + (i % 3) * 3, i % 2 ? C.coral : C.light));
  blur(0);
}
function listScreen(L, t) {
  const TH = theme(); screenBg(t);
  const cardW = W * .92, cardH = 128, x0 = (W - cardW) / 2, n = L.items.length;
  const top = Math.max(250, (H - n * 156) / 2 + 60);
  // Heading: "3 claves" — giant number + italic word, fades in with the screen.
  const hk = ease((t - L.s) / .5);
  cx.save(); cx.globalAlpha = hk; cx.textBaseline = 'alphabetic'; cx.textAlign = 'left';
  cx.font = ANTON(150); const nw = cx.measureText(String(n)).width;
  cx.font = SERIF(84); const ww = cx.measureText('claves').width;
  const hx = (W - nw - 18 - ww) / 2, hy = top - 60 + 20 * (1 - hk);
  cx.font = ANTON(150); cx.fillStyle = TH.accent; cx.fillText(String(n), hx, hy);
  cx.font = SERIF(84); cx.fillStyle = TH.ink; cx.fillText('claves', hx + nw + 18, hy - 8);
  cx.restore();
  L.items.forEach((it, k) => {
    const lt = t - it.at, y = top + k * 156;
    // big number pop before the card lands
    if (lt > 0 && lt < .75) {
      const a = back(lt / .28), o = lt > .5 ? 1 - ease((lt - .5) / .25) : 1, cy = y + cardH / 2 + 60;
      cx.save(); cx.globalAlpha = Math.max(0, o);
      for (let p = 0; p < 22; p++) {
        const ang = p * 2.4, dist = 60 + ease(lt / .6) * (90 + (p % 5) * 18);
        cx.fillStyle = p % 2 ? TH.accent : TH.sub; cx.globalAlpha = Math.max(0, o) * .6;
        cx.beginPath(); cx.arc(W / 2 + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 3 + (p % 3), 0, 7); cx.fill();
      }
      cx.globalAlpha = Math.max(0, o);
      cx.translate(W / 2, cy); cx.scale(a, a);
      const gg = cx.createLinearGradient(0, -80, 0, 80); gg.addColorStop(0, TH.a1); gg.addColorStop(1, TH.a2);
      cx.shadowColor = 'rgba(206,44,26,.4)'; cx.shadowBlur = 30; cx.shadowOffsetY = 12;
      rrect(-80, -80, 160, 160, 36); cx.fillStyle = gg; cx.fill(); cx.shadowColor = 'transparent';
      cx.fillStyle = TH.onA; cx.font = '800 110px Outfit, Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(it.n, 0, 6);
      cx.restore();
    }
    const ct = lt - .4;
    if (ct < 0) return;
    const e = ease(ct / .5);
    cx.save(); cx.globalAlpha = Math.min(1, ct / .2); cx.translate(0, 90 * (1 - e)); blur(10 * (1 - e));
    cx.shadowColor = 'rgba(120,40,20,.14)'; cx.shadowBlur = 26; cx.shadowOffsetY = 8;
    rrect(x0, y, cardW, cardH, 26); cx.fillStyle = TH.card; cx.fill(); cx.shadowColor = 'transparent';
    cx.lineWidth = 2; cx.strokeStyle = TH.line; cx.stroke();
    const bg = cx.createLinearGradient(0, y + 22, 0, y + 96); bg.addColorStop(0, TH.a1); bg.addColorStop(1, TH.a2);
    rrect(x0 + 22, y + 22, 74, 74, 18); cx.fillStyle = bg; cx.fill();
    cx.fillStyle = TH.onA; cx.font = '800 46px Outfit, Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(it.n, x0 + 59, y + 61);
    cx.textAlign = 'left';
    let fs = 38; cx.font = `800 ${fs}px "Plus Jakarta Sans", Inter, sans-serif`;
    while (cx.measureText(it.title.join(' ')).width > cardW - (it.img ? 270 : 190) && fs > 22) { fs -= 2; cx.font = `800 ${fs}px "Plus Jakarta Sans", Inter, sans-serif`; }
    let tx = x0 + 120; const ty = it.sub ? y + 46 : y + 60;
    it.title.forEach((w, i) => { cx.fillStyle = i === it.title.length - 1 && it.title.length > 1 ? TH.accent : TH.ink; cx.fillText(w, tx, ty); tx += cx.measureText(w + ' ').width; });
    if (it.sub) {
      const st = ease((ct - .25) / .4);
      cx.globalAlpha *= st; cx.font = '600 25px "Plus Jakarta Sans", Inter, sans-serif'; cx.fillStyle = TH.sub;
      let sub = it.sub; while (cx.measureText(sub).width > cardW - (it.img ? 270 : 190) && sub.includes(' ')) sub = sub.slice(0, sub.lastIndexOf(' ')) + '…';
      cx.fillText(sub, x0 + 120, y + 84);
    }
    cx.globalAlpha = 1;
    if (it.img) {
      const sz = cardH - 28, ix = x0 + cardW - sz - 14, iy = y + 14, iw = it.img.width, ih = it.img.height, sc2 = Math.max(sz / iw, sz / ih);
      cx.save(); rrect(ix, iy, sz, sz, 16); cx.clip(); cx.drawImage(it.img, ix + (sz - iw * sc2) / 2, iy + (sz - ih * sc2) / 2, iw * sc2, ih * sc2); cx.restore();
    } else {
      cx.strokeStyle = TH.accent; cx.lineWidth = 4; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(x0 + cardW - 58, y + 70); cx.lineTo(x0 + cardW - 46, y + 56); cx.lineTo(x0 + cardW - 38, y + 64); cx.lineTo(x0 + cardW - 26, y + 50); cx.stroke();
    }
    blur(0); cx.restore();
  });
}
function ctaScreen(word, lt) {
  const TH = theme();
  const g = cx.createRadialGradient(W / 2, H * .45, 20, W / 2, H * .45, H * .7);
  g.addColorStop(0, TH.halo); g.addColorStop(1, TH.night); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const cy = H * .45, R = 190;
  cx.save(); cx.lineWidth = 16; cx.lineCap = 'round';
  cx.strokeStyle = TH.soft; cx.beginPath(); cx.arc(W / 2, cy, R, 0, 7); cx.stroke();
  cx.shadowColor = TH.accent; cx.shadowBlur = 30; cx.strokeStyle = TH.accent;
  const a0 = -Math.PI / 2 + lt * 2.2; cx.beginPath(); cx.arc(W / 2, cy, R, a0, a0 + Math.PI * (1.1 + .5 * Math.sin(lt * 2))); cx.stroke();
  cx.restore();
  const e = back(lt / .45);
  cx.save(); cx.translate(W / 2, cy); cx.scale(e, e); cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = TH.ctaInk; cx.font = '600 44px Outfit, Inter, sans-serif'; cx.fillText('Comentá', 0, -56);
  let fs = 104; cx.font = `800 ${fs}px Outfit, Inter, sans-serif`;
  while (cx.measureText(word).width > R * 1.75 && fs > 40) { fs -= 6; cx.font = `800 ${fs}px Outfit, Inter, sans-serif`; }
  cx.lineWidth = 3; cx.strokeStyle = TH.accent; cx.fillStyle = TH.soft; cx.fillText(word, 0, 30); cx.strokeText(word, 0, 30);
  cx.restore();
  [[110, H * .72], [W - 120, H * .7], [W - 90, H * .3], [140, H * .25]].forEach(([x, y], i) => {
    const k = ease((lt - .2 - i * .12) / .4); if (k <= 0) return;
    cx.save(); cx.globalAlpha = k; cx.translate(x, y + Math.sin(lt * 1.5 + i) * 8); cx.scale(k, k);
    rrect(-26, -20, 52, 38, 12); cx.fillStyle = i % 2 ? '#fff' : TH.accent; cx.fill();
    cx.beginPath(); cx.moveTo(-8, 18); cx.lineTo(-16, 30); cx.lineTo(4, 18); cx.fill();
    cx.fillStyle = i % 2 ? TH.accent : '#fff'; [-12, 0, 12].forEach(dx => { cx.beginPath(); cx.arc(dx, -1, 3.5, 0, 7); cx.fill(); });
    cx.restore();
  });
  for (let i = 0; i < 6; i++) sparkle((i * 137) % W, (i * 311 + 90) % H, 6 + i % 3 * 2, TH.accent);
}
// Draws a full-screen graphic between [S,E] (in some clock) with blob transitions in and out.
function screenWithBlobs(t, S, E, draw, seed, sfxKey) {
  const T = .35;
  if (t < S - T || t > E + T) return false;
  if (busy && sfxKey && !fired.has(sfxKey) && t >= S - T) { fired.add(sfxKey); sfx('whoosh'); }
  if (t < S) { blobCover((t - S + T) / T, W * .82, H * .86, seed, t); return true; }
  if (t > E) { blobOpen((t - E) / T, W * .2, H * .2, seed + 1, t); return true; }
  draw(t);
  if (t < S + T) blobOpen((t - S) / T, W * .5, H * .55, seed + 2, t);
  else if (t > E - T) blobCover((t - E + T) / T, W * .2, H * .2, seed + 3, t);
  return t > S + T && t < E - T;
}
const fired = new Set();


// ================= FX layer: giant text behind the person, b-roll photos, glitch, light leaks, emojis =================
// Person segmentation (MediaPipe selfie segmenter, runs in the browser) lets the giant text sit behind you.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
let seg = null, segLoading = false, segTs = 0, maskReady = false, maskImg = null;
const maskCv = document.createElement('canvas'), maskCx = maskCv.getContext('2d', { willReadFrequently: true });
const segCv = document.createElement('canvas'); segCv.width = 288; segCv.height = 512;
const personCv = document.createElement('canvas'); personCv.width = W; personCv.height = H;
const pcx = personCv.getContext('2d');
async function loadSeg() {
  if (seg || segLoading) return;
  segLoading = true;
  try {
    const { FilesetResolver, ImageSegmenter } = await import(MP + '/vision_bundle.mjs');
    const files = await FilesetResolver.forVisionTasks(MP + '/wasm');
    const make = delegate => ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate },
      runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false
    });
    try { seg = await make('GPU'); } catch (e) { seg = await make('CPU'); }
  } catch (e) { console.warn('segmentation unavailable', e); }
  segLoading = false;
}
let maskCount = 0;
function updateMask() {
  if (!seg) return false;
  // While exporting, the silhouette barely changes between frames: refresh it every 3rd frame.
  if (maskReady && maskCount++ % (fastBusy ? 3 : 2)) return true;
  try {
    segTs = Math.max(segTs + 1, performance.now());
    let srcSeg = v;
    if (curSrc !== v) { segCv.getContext('2d').drawImage(curSrc, 0, 0, segCv.width, segCv.height); srcSeg = segCv; }
    const r = seg.segmentForVideo(srcSeg, segTs), m = r.confidenceMasks && r.confidenceMasks[0];
    if (!m) { r.close && r.close(); return false; }
    const a = m.getAsFloat32Array(), mw = m.width, mh = m.height;
    if (maskCv.width !== mw || maskCv.height !== mh) { maskCv.width = mw; maskCv.height = mh; maskImg = maskCx.createImageData(mw, mh); }
    const d = maskImg.data;
    for (let i = 0; i < a.length; i++) { const c = a[i]; d[i * 4 + 3] = c < .3 ? 0 : c > .7 ? 255 : (c - .3) * 637; }
    maskCx.putImageData(maskImg, 0, 0);
    r.close && r.close();
    return (maskReady = true);
  } catch (e) { console.warn(e); return false; }
}
let bigRect = { x0: 0, y0: 0, w: 0, h: 0 };
// Share of the giant word's box hidden by the person (0..1), read from the last silhouette mask.
function maskCoverage(r, x, y, w, h) {
  if (!maskImg || !r.w) return 0;
  const mw = maskCv.width, mh = maskCv.height, d = maskImg.data;
  let hit = 0, n = 0;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
    const u = (r.x0 + r.w * (i + .5) / 12 - x) / w, q = (r.y0 + r.h * (j + .5) / 4 - y) / h;
    n++;
    if (u < 0 || u >= 1 || q < 0 || q >= 1) continue;
    if (d[(Math.floor(q * mh) * mw + Math.floor(u * mw)) * 4 + 3] > 128) hit++;
  }
  return hit / n;
}
function drawPerson(x, y, w, h) {
  pcx.globalCompositeOperation = 'source-over'; pcx.clearRect(0, 0, W, H);
  pcx.drawImage(curSrc, x, y, w, h);
  pcx.globalCompositeOperation = 'destination-in';
  if ('filter' in pcx) pcx.filter = 'blur(2px)';
  pcx.drawImage(maskCv, x, y, w, h);
  if ('filter' in pcx) pcx.filter = 'none';
  pcx.globalCompositeOperation = 'source-over';
  cx.drawImage(personCv, 0, 0);
}

// ---- Beats: when each effect happens, decided from what you say ----
const STOPW = new Set('para pero como cuando donde porque aunque entonces tambien todos todas estos estas esto esta este eso esas esos cosas cosa hacer hace tiene tenes tener puede pueden quiero queres siempre nunca mucho mucha muchos muchas ahora antes despues sobre entre desde hasta tengo vamos estan estas estoy video videos would there their about because really people thing things'.split(' '));
const EMO = [[/plata|dinero|money|dolar|pesos|vend|cobr|ganar|ingreso/, '💰'], [/ano|anos|tiempo|reloj|hora|minuto|dia|dias/, '⏳'], [/video|grab|camara|reel|tiktok/, '🎥'], [/gente|amig|equipo|personas|clientes/, '👥'], [/ventaja|crec|subir|escal|rapido|exito/, '🚀'], [/idea|aprend|estudi|entend|cabeza|mente/, '🧠'], [/verguenza|miedo|nervio/, '😳'], [/arranc|empez|comenz|start/, '🏁'], [/fuego|viral|explot/, '🔥'], [/amor|corazon|quiero|encanta/, '❤️'], [/trabajo|negocio|empresa|emprend/, '💼'], [/error|mal|nunca|problema/, '❌'], [/bien|perfecto|listo|correcto|si$/, '✅'], [/secreto|truco|clave/, '🔑'], [/guard|salv/, '📌'], [/coment|mensaje|escrib|chat/, '💬'], [/celu|telefono|app/, '📱'], [/comida|comer|dieta|salud/, '🥗'], [/gym|entren|musculo|fuerza/, '💪'], [/casa|hogar/, '🏠'], [/auto|viaj/, '✈️']];
const userPhotos = [];
const photoCache = new Map();
// ---- Free AI images (Pollinations, no key). One request at a time; the corner logo is cropped off. ----
const AI_STYLE = {
  bw: 'black and white editorial photograph, high contrast, film grain, magazine cover',
  cine: 'cinematic photo, pitch black background, dramatic rim light, moody, 35mm, high detail',
  photo: 'photorealistic 3D render, studio lighting, dark background, ultra detailed, octane',
  vintage: 'vintage collage, old paper texture, retro print, halftone, red accents',
  coral: 'glossy 3D render, coral and cream colors, soft studio light, minimal, cute',
  dark: 'neon lit scene, purple and yellow glow, dark, cinematic, high detail',
  neonpink: 'neon pink and purple glow, dark background, futuristic, glossy 3D',
  clean: 'clean minimal 3D illustration, white background, soft blue accents, soft shadows'
};
const aiCache = new Map(), promptCache = new Map();
let aiDown = false, aiFails = 0;
let brollPicks = [], brollFor = null;
function sentences() {
  const out = []; let cur = [];
  words.forEach((w, i) => { cur.push(w); if (/[.!?]$/.test(w.t) || cur.length >= 14 || (words[i + 1] && words[i + 1].s - w.e > .6)) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}
// Ask the AI where a supporting image really helps the message (once per transcript).
async function pickBroll() {
  const key = words.map(w => w.t).join(' ');
  if (!key || brollFor === key || aiDown) return;
  brollFor = key;
  const se = sentences().filter(x => x.length >= 3);
  const dur = words.at(-1).e - words[0].s, max = Math.max(1, Math.min(8, Math.round(dur / (style().viro ? recipe().brollSec : 8))));
  try {
    const r = await fetch('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'broll', max, text: key, subjects: se.map(x => x.map(w => w.t).join(' ')) }) });
    if (!r.ok) throw new Error('broll ' + r.status);
    const j = await r.json();
    brollPicks = (j.picks || []).filter(pk => se[pk.i]).map(pk => ({ s: se[pk.i][0].s, e: se[pk.i].at(-1).e + .3, prompt: pk.prompt, search: pk.search || '', kicker: (pk.kicker || '').replace(/[*_#`]/g, ''), label: (pk.label || '').replace(/[*_#`]/g, '').trim() || se[pk.i].slice(0, 5).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ') }));
    brollPicks.forEach(pk => promptCache.set(pk.prompt, pk.prompt));
  } catch (e) { console.warn('b-roll plan unavailable', e); brollPicks = []; }
  if (plan) build();
}
// Art direction on the server: what you say → short English visual prompts (one request for all moments).
async function planPrompts(subjects) {
  const need = [...new Set(subjects)].filter(x => !promptCache.has(x));
  if (!need.length || aiDown) return;
  try {
    const r = await fetch('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: words.map(w => w.t).join(' '), subjects: need }) });
    if (!r.ok) throw new Error('plan ' + r.status);
    const j = await r.json();
    need.forEach((x, i) => promptCache.set(x, (j.prompts && j.prompts[i]) || x));
  } catch (e) { console.warn('ai plan unavailable', e); need.forEach(x => promptCache.set(x, x)); }
}
// One image from FLUX on Cloudflare (via our server). Same prompt = cached; 3 requests at a time.
// The look is the same for every editing style, so switching styles never throws the images away.
const AI_LOOK = 'cinematic photorealistic, dramatic soft lighting, rich detail, shallow depth of field';
const aiPending = new Set();
let aiActive = 0; const aiWait = [];
const aiSlot = () => aiActive < 3 ? (aiActive++, Promise.resolve()) : new Promise(r => aiWait.push(r)).then(() => { aiActive++; });
const aiFree = () => { aiActive--; const n = aiWait.shift(); if (n) n(); };
function aiImage(subject) {
  const prompt = `${promptCache.get(subject) || subject}, ${AI_LOOK}, no text, no letters, no words, no writing, no signs, no logos, no typography`;
  if (aiCache.has(prompt)) return aiCache.get(prompt);
  const job = (async () => {
    if (aiDown) return null;
    await aiSlot();
    try {
      let r = await fetch(`/api/ai-image?p=${encodeURIComponent(prompt)}`).catch(() => null);
      // Server busy or out of free quota: free backup generator (one at a time, it limits per person), then a stock photo.
      if (!r || !r.ok) { const alt = await backupImage(prompt, subject); if (alt) return alt; }
      if (!r || !r.ok) { aiCache.delete(prompt); return null; }
      const img = new Image(); img.src = URL.createObjectURL(await r.blob()); await img.decode();
      return img;
    } catch (e) { if (++aiFails >= 5) aiDown = true; aiCache.delete(prompt); return null; }
    finally { aiFree(); }
  })();
  aiCache.set(prompt, job); aiPending.add(job); job.finally(() => aiPending.delete(job));
  return job;
}
let backupChain = Promise.resolve();
function backupImage(prompt, subject) {
  const job = backupChain.then(async () => {
    const seed = [...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000;
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 400))}?width=720&height=1400&nologo=true&seed=${seed + i}`).catch(() => null);
      if (r && r.ok && (r.headers.get('content-type') || '').startsWith('image/')) {
        // It stamps a small logo in the bottom corner: crop it off.
        const raw = new Image(); raw.src = URL.createObjectURL(await r.blob()); await raw.decode();
        const c2 = document.createElement('canvas'); c2.width = raw.naturalWidth; c2.height = Math.round(raw.naturalHeight * .9);
        c2.getContext('2d').drawImage(raw, 0, 0); URL.revokeObjectURL(raw.src);
        return c2;
      }
      await new Promise(res => setTimeout(res, 2500 * (i + 1)));
    }
    return null;
  }).catch(() => null);
  backupChain = job.catch(() => null);
  return job;
}
// Real stock clips (Pexels) for b-roll moments: loaded muted and ready to draw on the canvas.
const vidCache = new Map();
function brollVideo(q) {
  if (vidCache.has(q)) return vidCache.get(q);
  const job = (async () => {
    const r = await fetch(`/api/broll-video?q=${encodeURIComponent(q)}`).catch(() => null);
    if (!r || !r.ok) return null;
    const j = await r.json();
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous'; el.muted = true; el.playsInline = true; el.loop = true; el.preload = 'auto'; el.src = j.url;
    const ok = await new Promise(res => { const t = setTimeout(() => res(false), 20000); el.addEventListener('canplay', () => { clearTimeout(t); res(true); }, { once: true }); el.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true }); el.load(); });
    return ok ? el : null;
  })().catch(() => null);
  vidCache.set(q, job);
  return job;
}
const brollMedia = ph => ph.vid && on('optVideo') && (ph.n % 2 === 1 || !ph.img) ? ph.vid : ph.img;
// While exporting frame by frame, put the active clip exactly on the right frame.
async function brollSeek(t) {
  const B = plan && plan.beats; if (!B) return;
  const ph = B.photos.find(p => t >= p.s && t <= p.e && p.vid && brollMedia(p) === p.vid); if (!ph) return;
  const el = ph.vid, want = ((t - ph.s) + .2) % Math.max(1, el.duration || 4);
  if (Math.abs(el.currentTime - want) < .01) return;
  el.pause();
  await new Promise(res => { const tm = setTimeout(res, 400); el.addEventListener('seeked', () => { clearTimeout(tm); res(); }, { once: true }); el.currentTime = want; });
}
// Fetches art for every screen and b-roll of the current plan (prompts first, then images in order of appearance).
async function loadAiArt(P) {
  const items = [
    ...(P.list ? P.list.items.map((it, i) => ({ o: it, s: it.at, subj: `${it.title.join(' ')} ${it.sub}`, seed: 200 + i })) : []),
    ...P.screens.map((sc, i) => ({ o: sc, s: sc.s, subj: sc.type === 'stat' ? `${sc.num} ${sc.unit} ${sc.ctx}` : sc.words.map(w => w.t).join(' '), seed: 100 + i })),
    ...(P.beats ? P.beats.photos.filter(p => !p.user).map((p, i) => ({ o: p, s: p.s, subj: p.subj, seed: 10 + i, photo: true })) : [])
  ].sort((a, b) => a.s - b.s);
  if (!on('optAI')) return;
  if (on('optPhotos')) pickBroll();
  await planPrompts(items.map(x => x.subj));
  if (P !== plan) return;
  if (on('optVideo')) (P.beats ? P.beats.photos : []).forEach(ph => { if (ph.search && !ph.user) brollVideo(ph.search).then(el => { if (el && ![...P.beats.photos].some(o => o.vid === el)) { ph.vid = el; ph.failed = false; dirty = true; } }); });
  // Never show the same picture twice in one video.
  const used = new Set();
  await Promise.all(items.map(x => aiImage(x.subj).then(img => { if (img && !used.has(img)) { used.add(img); x.o.img = img; } else if (!x.o.vid) x.o.failed = true; dirty = true; })));
}
function contextAround(i, n = 5) { return words.slice(Math.max(0, i - n), i + n).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' '); }
let curScreen = null;
// AI artwork on top of animated screens, treated per look.
function drawScreenArt(sc, t) {
  const img = sc.img, k = themeKey(); if (!img || k === 'photo') return false;
  const age = t - sc.s, e = ease(age / .6), iw = img.width, ih = img.height;
  cx.save(); cx.globalAlpha = e;
  if (k === 'cine' || k === 'dark' || k === 'neonpink' || k === 'noir') {
    const s = Math.max(W / iw, H * .62 / ih) * (1.06 + .04 * age); cx.drawImage(img, (W - iw * s) / 2, H * .3 - ih * s / 2, iw * s, ih * s);
    const g = cx.createLinearGradient(0, H * .36, 0, H * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, theme().night);
    cx.fillStyle = g; cx.fillRect(0, H * .3, W, H * .33);
    const g2 = cx.createLinearGradient(0, 0, 0, H * .12); g2.addColorStop(0, theme().night); g2.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g2; cx.fillRect(0, 0, W, H * .12);
  } else {
    const cw = W * .78, chh = H * .42, cy = H * .3 + 40 * (1 - e), r = k === 'bw' ? 6 : 28;
    cx.translate(W / 2, cy); cx.rotate(k === 'vintage' ? -.045 : 0);
    cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 40; cx.shadowOffsetY = 16;
    if (k === 'vintage') { cx.fillStyle = '#fbf6ea'; cx.fillRect(-cw / 2 - 16, -chh / 2 - 16, cw + 32, chh + 60); }
    rrect(-cw / 2, -chh / 2, cw, chh, r); cx.fillStyle = '#000'; cx.fill(); cx.shadowColor = 'transparent'; cx.clip();
    if (k === 'bw' && HAS_FILTER) cx.filter = 'grayscale(1) contrast(1.35)';
    const s = Math.max(cw / iw, chh / ih) * (1.04 + .05 * age); cx.drawImage(img, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
    if (HAS_FILTER) cx.filter = 'none';
  }
  cx.restore();
  return true;
}
function fetchPhoto(q) {
  if (photoCache.has(q)) return photoCache.get(q);
  const p = (async () => {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=6&mature=false&aspect_ratio=tall`);
    if (!r.ok) return null;
    const res = (await r.json()).results || [];
    for (const it of res) {
      try {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.src = `https://api.openverse.org/v1/images/${it.id}/thumb/?full_size=true`;
        await img.decode();
        if (img.naturalWidth > 200) return img;
      } catch (e) { /* try next */ }
    }
    return null;
  })().catch(() => null);
  photoCache.set(q, p);
  return p;
}

function makeBeats(P) {
  const B = { big: [], photos: [], emoji: new Map() };
  if (!words.length) return B;
  const busyRanges = [];
  if (P.list && on('optMG')) busyRanges.push([P.list.s - .5, P.list.e + .5]);
  (P.screens || []).forEach(sc => { if (sc.type === 'stat' ? on('optStats') : on('optMG')) busyRanges.push([sc.s - .5, sc.e + .5]); });
  const ovR = on('optOverlay') ? (P.overlays || []).map(o => [o.s, o.e]) : [];
  const free = (s, e) => !busyRanges.some(([a, b]) => s < b && e > a);
  // Visual hook: the strongest 1-2 words of the first sentence, giant, behind you.
  if (on('optHook') && hookTextType() === 'big') {
    const hw = []; for (const w of words) { hw.push(w); if (hw.length >= 8 || /[.!?]$/.test(w.t)) break; }
    let k = hw.findIndex(w => isNum(w.t));
    if (k < 0) k = hw.reduce((b, w, i) => clean(w.t).length > clean(hw[b].t).length ? i : b, 0);
    const pick = hw.slice(k, k + (isNum(hw[k].t) && hw[k + 1] ? 2 : 1));
    const text = pick.map(w => clean(w.t)).join(' ').toUpperCase();
    const small = aiHookTitle && aiHookTitle.split(' ').length <= 4 ? aiHookTitle.toLowerCase() : hw.filter(w => !pick.includes(w)).slice(0, 3).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ').toLowerCase();
    if (text) { B.big.push({ s: words[0].s, e: Math.max(words[0].s + 1.8, pick.at(-1).e + .6), text, small, hook: true, n: 0 }); busyRanges.push([words[0].s, B.big[0].e]); }
  }
  if (on('optBig')) {
    let last = B.big.length ? B.big[0].e : words[0].s + (P.hookDur || 0);
    P.chunks.forEach(c => {
      const k = c.key, txt = clean(k.t);
      if (!(c.emph && (isNum(k.t) || txt.length >= 6)) || k.s - last < 3.4) return;
      const e = Math.max(k.e + .7, k.s + 1.3);
      if (!free(k.s - .1, e) || ovR.some(([a2, b2]) => k.s - .1 < b2 && e > a2)) return;
      const small = c.filter(w => w !== k).slice(0, 3).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ').toLowerCase();
      B.big.push({ s: k.s - .05, e, text: txt.toUpperCase(), small, n: B.big.length });
      busyRanges.push([k.s - .1, e]); last = e;
    });
  }
  if (on('optPhotos')) {
    // AI-chosen moments (each with its own image idea); your own photos fill those moments first.
    let ui = 0;
    // Without AI picks, your own photos still go on clear sentence starts.
    // A picked moment can start at any phrase inside its sentence that is still free.
    const lastOk = words.at(-1).e - 3;
    const slot = (s0, e0) => { for (const c of P.chunks) { if (c.s < s0 - .05 || c.s > e0 - 1.2 || c.s > lastOk) continue; const e1 = Math.min(e0, c.s + 2.8); if (e1 - c.s >= 1.2 && free(c.s, e1)) return [c.s, e1]; } return null; };
    let picks = brollPicks;
    if (!picks.length && userPhotos.length) {
      picks = []; let lastU = -9;
      for (const c of P.chunks) { if (picks.length >= userPhotos.length) break; if (c.s - lastU < 3.5 || c.s > lastOk) continue; const e1 = c.s + 2.6; if (free(c.s, e1)) { picks.push({ s: c.s, e: e1, prompt: '', label: '' }); lastU = e1; } }
    }
    picks.forEach(pk => {
      const sl = slot(pk.s, Math.max(pk.e, pk.s + 1.3));
      if (!sl) return;
      const [s0, e0] = sl;
      const ph = { s: s0, e: e0, q: pk.prompt, subj: pk.prompt, label: pk.label, kicker: pk.kicker || '', search: pk.search || '', img: null, n: B.photos.length };
      const inW = words.filter(w => w.s >= s0 && w.s < e0); if (inW.length) { const kw = inW.reduce((a, w) => clean(w.t).length > clean(a.t).length ? w : a, inW[0]); ph.word = clean(kw.t).toLowerCase(); ph.word = ph.word[0].toUpperCase() + ph.word.slice(1); }
      if (ui < userPhotos.length) { ph.img = userPhotos[ui++]; ph.user = true; }
      B.photos.push(ph); busyRanges.push([s0, e0]);
    });
  }
  // With a stacked text hook the opening stays on you; the first cutaway lands right after it (pattern break at ~3s).
  if (style().viro && hookTextType() === 'stack') B.photos = B.photos.filter(ph => ph.s >= words[0].s + 2.6);
  if (style().viro && aiHookTitle && hookTextType() === 'viro' && on('optHook')) { const f = B.photos[0]; if (f && f.s <= words[0].s + .6) { f.label = aiHookTitle; f.kicker = ''; f.hookT = true; } }
  B.kin = [];
  if (style().viro) {
    const RC = recipe(); let lastK = words[0].s + 4;
    P.chunks.forEach((c, ci) => {
      const c2 = P.chunks[ci + 1], all = c2 && c2.s - c.e < .5 && c.length + c2.length <= 7 ? [...c, ...c2] : [...c];
      const txt = all.map(w => w.t).join(' ');
      if (B.kin.length >= RC.kinMax || all.length < 2 || txt.length < 7 || txt.length > 40 || c.s - lastK < RC.kinGap || all.at(-1).e > words.at(-1).e - 2) return;
      const e = Math.max(all.at(-1).e + .4, c.s + 1.2), s0 = c.s - .35;
      if (!free(s0 - .1, e + .1)) return;
      const key = all.reduce((a2, w) => clean(w.t).length > clean(a2.t).length ? w : a2, all[0]);
      B.kin.push({ s: s0, e, words: all, key, n: B.kin.length }); busyRanges.push([s0 - .1, e + .1]); lastK = e;
    });
  }
  ovR.forEach(r => { if (!B.photos.some(ph => ph.s < r[1] && ph.e > r[0])) busyRanges.push(r); });
  if (on('optEmoji')) P.chunks.forEach((c, i) => {
    for (const w of c) { const n = norm(w.t); const hit = EMO.find(([re]) => re.test(n)); if (hit) { B.emoji.set(i, hit[1]); break; } }
  });
  return B;
}

// ---- Drawing ----
function bigFont(size, coral) {
  const f = val('fKey', 'auto');
  if (f !== 'auto') return fontOf(f, size);
  const sk = $('#style').value;
  if (sk === 'editorial') return `italic 600 ${size}px Fraunces, "Instrument Serif", Georgia, serif`;
  if (sk === 'minimal') return `800 ${size}px "Inter Tight", Inter, sans-serif`;
  return coral ? `800 ${size}px Outfit, Inter, sans-serif` : ANTON(size);
}
function bigLayout(b, coral) {
  let size = Math.round((coral ? 250 : 330) * +val('sKey', 1)); cx.font = bigFont(size, coral);
  while (cx.measureText(b.text).width > W * .88 && size > 70) { size -= 10; cx.font = bigFont(size, coral); }
  return size;
}
// Back layer: giant word (behind the person when the cutout is available).
function drawBig(b, t, coral) {
  const age = t - b.s, left = b.e - t, outK = left < .25 ? ease(1 - left / .25) : 0;
  let text = b.text;
  const first = text.split(' ')[0], num = /^\d+$/.test(first) ? +first : null;
  if (num !== null && num > 1 && num < 100000) text = [Math.round(num * ease(age / .6)), ...text.split(' ').slice(1)].join(' ');
  const size = bigLayout(b, coral);
  const by = b.hook && galleryOn ? H * .6 : H * .19;
  bigRect = { x0: W / 2 - cx.measureText(b.text).width / 2, y0: by - size * .45, w: cx.measureText(b.text).width, h: size * .9 };
  const mode = b.hook ? 'slam' : ['slam', 'track', 'rise', 'outline'][b.n % 4];
  const fill = coral && b.n % 2 ? '#F0452F' : '#ffffff';
  cx.save();
  cx.translate(W / 2, by);
  cx.globalAlpha = 1 - outK; cx.scale(1 + outK * .12, 1 + outK * .12);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = 'rgba(0,0,0,.3)'; cx.shadowBlur = 40;
  if (mode === 'slam') {
    const k = back(age / .3), sh = age > .28 && age < .45 ? (Math.random() - .5) * 10 : 0;
    const sc0 = Math.min(1.35, W * .98 / Math.max(1, cx.measureText(text).width)); cx.scale(sc0 - (sc0 - 1) * k, sc0 - (sc0 - 1) * k); cx.translate(sh, sh * .5); blur(14 * (1 - ease(age / .25)));
    cx.fillStyle = fill; cx.fillText(text, 0, 0);
  } else if (mode === 'track') {
    const k = ease(age / .5), sp = size * (.12 - .1 * k), letters = [...text];
    const ws = letters.map(l => cx.measureText(l).width), tot = ws.reduce((a, b2) => a + b2, 0) + sp * (letters.length - 1);
    let x = -tot / 2; cx.textAlign = 'left'; cx.globalAlpha *= Math.min(1, age / .25); cx.fillStyle = fill;
    letters.forEach((l, i) => { cx.fillText(l, x, 0); x += ws[i] + sp; });
  } else if (mode === 'rise') {
    const letters = [...text], ws = letters.map(l => cx.measureText(l).width), tot = ws.reduce((a, b2) => a + b2, 0);
    let x = -tot / 2; cx.textAlign = 'left'; cx.fillStyle = fill;
    cx.save(); cx.beginPath(); cx.rect(-W, -size * .62, W * 2, size * 1.24); cx.clip();
    letters.forEach((l, i) => { const k = back((age - i * .045) / .35); cx.fillText(l, x, size * (1 - k)); x += ws[i]; });
    cx.restore();
  } else {
    const k = ease(age / .6), tw = cx.measureText(text).width;
    cx.lineWidth = Math.max(3, size * .02); cx.strokeStyle = fill; cx.shadowBlur = 0; cx.strokeText(text, 0, 0);
    cx.save(); cx.beginPath(); cx.rect(-tw / 2 - 10, -size, (tw + 20) * k, size * 2); cx.clip();
    cx.fillStyle = fill; cx.fillText(text, 0, 0); cx.restore();
  }
  blur(0);
  cx.restore();
}
// Front layer: smaller italic serif words in color that cross the giant word (in front of the person).
function drawBigSmall(b, t, coral) {
  if (!b.small) return;
  const age = t - b.s - .25, left = b.e - t, outK = left < .25 ? ease(1 - left / .25) : 0;
  if (age <= 0) return;
  const size = bigLayout(b, coral), TH = theme();
  let fs = Math.max(64, size * .42) * +val('sAccent', 1); cx.font = SERIF(fs);
  while (cx.measureText(b.small).width > W * .86 && fs > 44) { fs -= 4; cx.font = SERIF(fs); }
  const k = ease(age / .45), tw = cx.measureText(b.small).width;
  cx.save();
  const cxp = Math.min(W - 24 - tw / 2, Math.max(24 + tw / 2, W / 2 + W * .05));
  cx.translate(cxp, (b.hook && galleryOn ? H * .6 : H * .19) + size * .42 + fs * .45 - 10 * (1 - k)); cx.rotate(-.05);
  cx.globalAlpha = 1 - outK; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.beginPath(); cx.rect(-tw / 2 - 20, -fs, (tw + 40) * k, fs * 2); cx.clip();
  cx.shadowColor = 'rgba(0,0,0,.85)'; cx.shadowBlur = 26; cx.shadowOffsetY = 2;
  cx.lineJoin = 'round'; cx.lineWidth = fs * .14; cx.strokeStyle = 'rgba(0,0,0,.75)'; cx.strokeText(b.small, 0, 0); cx.shadowColor = 'transparent';
  cx.fillStyle = coral ? '#FFD9CF' : TH.accent === '#2563EB' ? '#FFE14D' : lift(TH.accent);
  cx.fillText(b.small, 0, 0);
  cx.restore();
}
function coverDraw(img, alpha, zoom, dx) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih) * zoom, w = iw * s, h = ih * s;
  cx.globalAlpha = alpha; cx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h); cx.globalAlpha = 1;
}
// B-roll: the whole image as a card in the top third while you stay on screen (like viral "visual hook" edits).
function photoCard(img, x, y, maxW, maxH, rot, k, age, cover) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  let w, h;
  if (cover) { w = maxW; h = maxH; } else { const s = Math.min(maxW / iw, maxH / ih); w = iw * s; h = ih * s; }
  const pop = .8 + .2 * back(age / .45);
  cx.save(); cx.globalAlpha = k; cx.translate(x, y - 40 * (1 - ease(age / .4))); cx.rotate(rot); cx.scale(pop, pop);
  cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 40; cx.shadowOffsetY = 16;
  rrect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 22); cx.fillStyle = '#fff'; cx.fill(); cx.shadowColor = 'transparent';
  cx.save(); rrect(-w / 2, -h / 2, w, h, 16); cx.clip();
  if (cover) { const s2 = Math.max(w / iw, h / ih); cx.drawImage(img, -iw * s2 / 2, -ih * s2 / 2, iw * s2, ih * s2); }
  else cx.drawImage(img, -w / 2, -h / 2, w, h);
  cx.restore(); cx.restore();
}
function drawPhoto(ph, t) {
  const age = t - ph.s, left = ph.e - t, k = Math.min(ease(age / .3), ease(left / .3));
  const media = brollMedia(ph);
  if (!media) {
    // No picture available: the title still lands, over a soft, darkened copy of your shot.
    cx.save(); cx.globalAlpha = k; blur(26); cx.drawImage(cv, -W * .06, -H * .06, W * 1.12, H * 1.12); blur(0);
    cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(0, 0, W, H); cx.restore();
    viroPhotoText(ph, t, k); return false;
  }
  if (blay() === 'full') {
    const dur = Math.max(1, ph.e - ph.s), p = Math.min(1, age / dur), dir = ph.n % 2 ? 1 : -1;
    // Entry transition of the format: soft blur, white flash, slide in or zoom in.
    const tr = style().viro ? recipe().trans : 'blur', e1 = ease(age / .32);
    cx.save(); cx.globalAlpha = tr === 'slide' || tr === 'flash' ? Math.min(1, ease(left / .3) + (age < .3 ? 1 : 0)) : k;
    if (tr === 'slide') cx.translate(W * (1 - e1) * (ph.n % 2 ? -1 : 1), 0);
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    if (tr === 'blur' || tr === 'leak') blur((tr === 'leak' ? 6 : 10) * (1 - ease(age / .35)));
    const zin = tr === 'zoom' ? .25 * (1 - e1) : 0;
    coverDraw(media, 1, (media === ph.vid ? 1.04 - .03 * p : 1.16 - .1 * p) + zin, media === ph.vid ? 0 : dir * W * .03 * (p - .5)); blur(0);
    cx.restore();
    if (tr === 'flash' && age < .18) { cx.fillStyle = `rgba(255,255,255,${.85 * (1 - age / .18)})`; cx.fillRect(0, 0, W, H); }
    if (tr === 'leak') { warmLeak(age); warmLeak(ph.e - t); }
    if (style().viro) viroPhotoText(ph, t, k);
  } else if (style().viro) {
    // Card format: you stay on screen, dimmed; the picture sits in a framed card and the title goes above it.
    cx.save(); cx.globalAlpha = .45 * k; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.restore();
    photoCard(media, W / 2, H * .44, W * .84, H * .4, (ph.n % 2 ? -1 : 1) * .025, k, age, true);
    viroPhotoText(ph, t, k, 'tl');
  }
  else photoCard(media, W / 2, H * .2, W * .8, H * .3, (ph.n % 2 ? -1 : 1) * .03, k, age, false);
  return false;
}
// Viro motion graphic over a b-roll: italic kicker + bold title with the key word in a blue gradient, or one script word.
function viroPhotoText(ph, t, k, force) {
  const age = t - ph.s; if (!ph.label) return;
  const RT = recipe().titles, pos = force || RT[(ph.n || 0) % RT.length];
  const T = typo();
  cx.save(); cx.globalAlpha = k;
  const ws = ph.label.split(' '), key = ws.reduce((b, w) => clean(w).length >= clean(b).length ? w : b, ws[0]);
  let fs = pos === 'center' ? 76 : 70;
  const tf = (w, z) => w === key ? keyF(z * 1.12) : (val('fBase', 'auto') !== 'auto' ? baseF(z) : T.title(z));
  const maxW = W * .84;
  while (ws.some(w => { cx.font = tf(w, fs); return cx.measureText(w).width > maxW; }) && fs > 40) fs -= 4;
  if ('letterSpacing' in cx) cx.letterSpacing = '-0.02em';
  const sp = fs * .26, lines = [[]]; let lw = 0;
  ws.forEach(w => { cx.font = tf(w, fs); const ww = cx.measureText(w).width; if (lw + ww > maxW && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push([w, ww]); lw += ww + sp; });
  const lh = fs * 1.05, kickH = ph.kicker ? 70 : 0, blockH = kickH + lines.length * lh;
  // Shade only where the text sits, so the picture stays clean.
  let g;
  if (pos === 'center') { g = cx.createRadialGradient(W / 2, H * .42, 40, W / 2, H * .42, H * .5); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.1)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
  else if (pos === 'bottom') { g = cx.createLinearGradient(0, H * .3, 0, H * .8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); cx.fillStyle = g; cx.fillRect(0, H * .3, W, H * .5); }
  else { g = cx.createLinearGradient(0, 0, 0, H * .5); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H * .5); }
  const center = pos === 'center', x0 = W * .08;
  let y = pos === 'center' ? H * .42 - blockH / 2 + 40 : pos === 'bottom' ? H * .47 : force ? H * .07 : H * .1;
  cx.textBaseline = 'alphabetic'; cx.textAlign = 'left'; cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 18;
  if (ph.kicker) {
    const a = ease((age - .1) / .4); cx.globalAlpha = k * a; cx.font = accF(46); cx.fillStyle = '#fff';
    const kw = cx.measureText(ph.kicker).width; cx.fillText(ph.kicker, center ? W / 2 - kw / 2 : x0, y + 12 * (1 - a)); y += kickH;
  }
  let n = 0;
  lines.forEach((l, li) => {
    const tot = l.reduce((q, [, ww]) => q + ww, 0) + sp * (l.length - 1);
    let x = center ? W / 2 - tot / 2 : x0; const yy = y + li * lh;
    l.forEach(([w, ww]) => {
      cx.font = tf(w, fs); const a = ease((age - .25 - n++ * .12) / .35);
      if (a > 0) {
        cx.globalAlpha = k * a;
        if (w === key) { const gg = cx.createLinearGradient(x, 0, x + ww, 0); gg.addColorStop(0, T.key[0]); gg.addColorStop(1, T.key[1]); cx.fillStyle = gg; } else cx.fillStyle = '#fff';
        cx.fillText(w, x, yy + 18 * (1 - a));
      }
      x += ww + sp;
    });
  });
  if ('letterSpacing' in cx) cx.letterSpacing = '0px';
  cx.restore();
}
// Viro kinetic screen: a short phrase alone on a white or black screen, words land as you say them, key word glowing green.
const mixDark = (hex, m) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16 & 255) * (1 - m) | 0},${(n >> 8 & 255) * (1 - m) | 0},${(n & 255) * (1 - m) | 0})`; };
// Warm light-leak flare used on b-roll cuts (orange to yellow glows, ~0.4s around the cut).
function warmLeak(d) {
  if (d < 0 || d > .4) return;
  const a = Math.sin((1 - d / .4) * Math.PI / 2);
  cx.save(); cx.globalCompositeOperation = 'screen';
  [[W * .2, H * .3, '255,138,60'], [W * .8, H * .55, '255,210,58'], [W * .45, H * .8, '255,160,70']].forEach(([x, y, c]) => {
    const g = cx.createRadialGradient(x, y, 10, x, y, H * .55); g.addColorStop(0, `rgba(${c},${.9 * a})`); g.addColorStop(1, `rgba(${c},0)`); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  });
  cx.restore();
}
function drawKin(kn, t) {
  const age = t - kn.s, left = kn.e - t, k = Math.min(ease(age / .12), ease(left / .12));
  const KB = recipe().kinBg; let bg = KB[kn.n % KB.length];
  // Halfway through, white and black swap (like the best impact screens).
  const flip = (bg === 'white' || bg === 'black') && t > (kn.s + kn.e) / 2;
  if (flip) bg = bg === 'white' ? 'black' : 'white';
  const white = bg === 'white', T = typo();
  cx.save(); cx.globalAlpha = k;
  if (bg === 'blur') { blur(28); cx.drawImage(cv, -W * .06, -H * .06, W * 1.12, H * 1.12); blur(0); cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(0, 0, W, H); }
  else {
    const g = cx.createRadialGradient(W / 2, H * .45, 50, W / 2, H * .5, H * .75);
    if (white) { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dcdcd8'); } else if (bg === 'accent') { g.addColorStop(0, mixDark(T.key[0], .55)); g.addColorStop(1, '#070709'); } else { g.addColorStop(0, '#1a1a1a'); g.addColorStop(1, '#000'); }
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  }
  const ink = white ? '#111' : '#fff', dim = white ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.22)';
  const F = (w, z) => w === kn.key ? keyF(z * 1.15) : (val('fBase', 'auto') !== 'auto' ? baseF(z) : T.title(z));
  const tx = kn.words.map(w => w.t.replace(/[.,;:!?¿¡"]+/g, '').toLowerCase());
  if ('letterSpacing' in cx) cx.letterSpacing = '-0.03em';
  // Wrap into balanced lines that fit, as big as possible.
  let fs = 92, lines;
  const layout = z => { const L = [[]]; let lw = 0; kn.words.forEach((w, i) => { cx.font = F(w, z); const ww = cx.measureText(tx[i]).width; if (lw + ww > W * .84 && L.at(-1).length) { L.push([]); lw = 0; } L.at(-1).push([i, ww]); lw += ww + z * .24; }); return L; };
  for (; fs > 40; fs -= 4) { lines = layout(fs); if (lines.length <= 3 && lines.every(l => l.every(([, ww]) => ww < W * .84))) break; }
  const lh = fs * 1.12, y0 = H * .48 - (lines.length - 1) * lh / 2;
  cx.textBaseline = 'middle';
  lines.forEach((l, li) => {
    const tot = l.reduce((q, [, ww]) => q + ww, 0) + fs * .24 * (l.length - 1); let x = W / 2 - tot / 2;
    l.forEach(([i, ww]) => {
      const w = kn.words[i], a = ease((t - w.s + .06) / .16), on2 = t >= w.s - .06;
      cx.font = F(w, fs);
      cx.save(); cx.translate(x + ww / 2, y0 + li * lh); const sc = on2 ? .94 + .06 * a : 1; cx.scale(sc, sc);
      if (on2 && w === kn.key) { cx.shadowColor = T.hi; cx.shadowBlur = 30; cx.fillStyle = bg === 'accent' ? '#fff' : ink; cx.fillText(tx[i], -ww / 2, 0); cx.shadowBlur = 12; }
      cx.fillStyle = on2 ? (w === kn.key && bg !== 'accent' && !white ? T.hi : ink) : dim;
      cx.fillText(tx[i], -ww / 2, 0); cx.restore();
      x += ww + fs * .24;
    });
  });
  if ('letterSpacing' in cx) cx.letterSpacing = '0px';
  cx.restore();
}
// Opening collage: up to three images drop in across the top while the hook text sits lower.
let galleryOn = false;
function drawGallery(P, ot) {
  const imgs = (P.beats ? P.beats.photos : []).map(p => p.img).concat(P.screens.map(s2 => s2.img), P.list ? P.list.items.map(it => it.img) : []).filter(Boolean).slice(0, 3);
  if (imgs.length < 2) return false;
  const gEnd = Math.min(P.hookDur, 3), out = ot > gEnd - .3 ? ease((ot - gEnd + .3) / .3) : 0;
  const n = imgs.length, cw = W * (n === 3 ? .28 : .4), chh = cw * 16 / 11, gap = W * .03, x0 = W / 2 - ((n - 1) * (cw + gap)) / 2;
  imgs.forEach((img, i) => photoCard(img, x0 + i * (cw + gap), H * .05 + chh / 2, cw, chh, (i - (n - 1) / 2) * .04, 1 - out, ot - i * .12, true));
  return true;
}
function drawEmoji(ci, ch, t) {
  const e = plan && plan.beats && plan.beats.emoji.get(ci);
  if (!e || !ch) return;
  const age = t - ch.s, k = back(age / .3);
  cx.save(); cx.translate(W * .84, H * .6 - 10 * Math.sin(age * 5) * Math.exp(-age * 2));
  cx.rotate(.25 * Math.sin(age * 8) * Math.exp(-age * 3)); cx.scale(k, k);
  cx.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(e, 0, 0); cx.restore();
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
function lightLeak(k, seed) {
  if (k <= 0 || k >= 1) return;
  const a = Math.sin(k * Math.PI);
  cx.save(); cx.globalCompositeOperation = 'screen';
  const x = W * (-.2 + 1.4 * k), y = H * (.2 + .3 * Math.sin(seed));
  const g = cx.createRadialGradient(x, y, 10, x, y, H * .6);
  const TH = theme(); g.addColorStop(0, rgba(TH.a1, .7 * a)); g.addColorStop(.4, rgba(TH.a2, .3 * a)); g.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.restore();
}
function glitch(k) {
  if (k <= 0 || k >= 1) return;
  const n = 7, amp = 60 * (1 - k);
  for (let i = 0; i < n; i++) {
    const sy = Math.random() * H, sh = 10 + Math.random() * 70, dx = (Math.random() - .5) * amp * 2;
    cx.drawImage(cv, 0, sy, W, sh, dx, sy, W, sh);
  }
  cx.save(); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = .35 * (1 - k);
  cx.drawImage(cv, -10 * (1 - k), 0); cx.fillStyle = rgba(theme().a2, .22); cx.fillRect(0, 0, W, H);
  cx.globalCompositeOperation = 'source-over'; cx.restore();
}

// Called right after the video frame is drawn. Returns { hide } to hide captions while a giant word is on screen.
function fxLayer(t, ot, P, x, y, w, h, coral) {
  const B = P.beats; if (!B) return { hide: false };
  const kn = (B.kin || []).find(q => t >= q.s && t <= q.e);
  if (kn) {
    if (busy) { if (!fired.has('k' + kn.s)) { fired.add('k' + kn.s); sfx('impact'); } kn.words.forEach((w, i) => { if (t >= w.s && !fired.has('kw' + kn.s + i)) { fired.add('kw' + kn.s + i); sfx('tick'); } }); }
    drawKin(kn, t); return { hide: true };
  }
  if (busy) { const nk = (B.kin || []).find(q => t >= q.s - .6 && t < q.s); if (nk && !fired.has('kr' + nk.s)) { fired.add('kr' + nk.s); sfx('whoosh'); } }
  const big = B.big.find(b => t >= b.s && t <= b.e);
  const photo = B.photos.find(p => t >= p.s && t <= p.e && (p.img || p.vid || (p.failed && p.label && style().viro)));
  // Preview: the active clip plays, every other one rests.
  if (!fastBusy) B.photos.forEach(p => { if (!p.vid) return; if (p === photo && brollMedia(p) === p.vid) { if (p.vid.paused) { p.vid.currentTime = Math.max(0, t - p.s); p.vid.play().catch(() => {}); } } else if (!p.vid.paused) p.vid.pause(); });
  let doubleExp = false;
  if (photo && blay() !== 'split') doubleExp = drawPhoto(photo, t, coral);
  if (big) drawBig(big, t, coral);
  if ((big || doubleExp) && on('optBig')) {
    if (!seg) loadSeg();
    else if (updateMask() && (!big || (!(big.hook && galleryOn) && maskCoverage(bigRect, x, y, w, h) < .4))) drawPerson(x, y, w, h);
  }
  if (big) drawBigSmall(big, t, coral);
  if (busy) {
    const nb = B.big.find(b => !b.hook && t >= b.s - .55 && t < b.s);
    if (nb && on('optFx') && !fired.has('r' + nb.s)) { fired.add('r' + nb.s); sfx('riser'); }
    if (big && !big.hook && !fired.has('b' + big.s)) { fired.add('b' + big.s); sfx('hit'); }
    if (photo && !fired.has('p' + photo.s)) { fired.add('p' + photo.s); sfx('whoosh'); }
    if (photo && t >= photo.e - .25 && !fired.has('px' + photo.s)) { fired.add('px' + photo.s); sfx('swipe'); }
  }
  return { hide: !!big, photoCard: photo && !doubleExp };
}
// Called last: transitions on top of everything.
function fxTop(t, ot, P, si) {
  if (!on('optFx')) return;

  const g = si >= 0 ? P.segs[si] : null;
  const B = P.beats; if (!B) return;
}
// Extra synthesized sound hooks
function sfxExtra(type, t0) {
  if (type === 'tick') {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(900, t0 + .04);
    g.gain.setValueAtTime(.09, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .05); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + .06); return true;
  }
  if (type === 'swipe') {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noiseBuf; f.type = 'highpass';
    f.frequency.setValueAtTime(800, t0); f.frequency.exponentialRampToValueAtTime(4000, t0 + .22);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.14, t0 + .05); g.gain.linearRampToValueAtTime(0, t0 + .24);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t0); n.stop(t0 + .26); return true;
  }
  if (type === 'scratch') {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(2200, t0); f.frequency.exponentialRampToValueAtTime(350, t0 + .12); f.frequency.exponentialRampToValueAtTime(1800, t0 + .3);
    g.gain.setValueAtTime(.5, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .34);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t0); n.stop(t0 + .36); return true;
  }
  if (type === 'drop') {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(28, t0 + 1.2);
    g.gain.setValueAtTime(.95, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + 1.3);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + 1.35); return true;
  }
  if (type === 'zap') {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square';
    o.frequency.setValueAtTime(1400, t0); o.frequency.exponentialRampToValueAtTime(160, t0 + .2);
    g.gain.setValueAtTime(.1, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .22);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + .24); return true;
  }
  if (type === 'notif') {
    [[880, 0], [1320, .12]].forEach(([fq, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fq; g.gain.setValueAtTime(.18, t0 + d); g.gain.exponentialRampToValueAtTime(.001, t0 + d + .5); o.connect(g); g.connect(dest); o.start(t0 + d); o.stop(t0 + d + .55); });
    return true;
  }
  if (type === 'impact' || type === 'hit') {
    const big = type === 'impact';
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(big ? 110 : 160, t0); o.frequency.exponentialRampToValueAtTime(32, t0 + (big ? .9 : .4));
    og.gain.setValueAtTime(big ? .9 : .5, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + (big ? .9 : .4));
    o.connect(og); og.connect(dest); o.start(t0); o.stop(t0 + 1);
    const n = ac.createBufferSource(), ng = ac.createGain(), f = ac.createBiquadFilter(); n.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = big ? 2500 : 1800;
    ng.gain.setValueAtTime(big ? .4 : .2, t0); ng.gain.exponentialRampToValueAtTime(.001, t0 + .35);
    n.connect(f); f.connect(ng); ng.connect(dest); n.start(t0); n.stop(t0 + .4);
    return true;
  }
  if (type === 'riser') {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(6000, t0 + .55);
    g.gain.setValueAtTime(.001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .52); g.gain.linearRampToValueAtTime(0, t0 + .6);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t0); n.stop(t0 + 1);
    return true;
  }
  if (type === 'shutter') {
    [0, .07].forEach(d => {
      const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 2500;
      g.gain.setValueAtTime(.35, t0 + d); g.gain.exponentialRampToValueAtTime(.001, t0 + d + .05);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t0 + d); n.stop(t0 + d + .06);
    });
    return true;
  }
  if (type === 'ding') {
    [1320, 2640].forEach((fq, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = fq;
      g.gain.setValueAtTime(i ? .06 : .16, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .8);
      o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + .8);
    });
    return true;
  }
  return false;
}
document.getElementById('photos').onchange = async e => {
  userPhotos.length = 0;
  for (const f of e.target.files) { try { const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); userPhotos.push(img); } catch (er) { /* skip */ } }
  if (plan) build();
};
['optBig', 'optPhotos', 'optVideo', 'optEmoji', 'optAI', 'optMG', 'optStats', 'optOverlay'].forEach(id => { document.getElementById(id).onchange = () => { if (id === 'optBig' && on('optBig')) loadSeg(); build(); }; });
let rebuildT = 0;
['mg', 'style', 'hookText'].forEach(id => document.getElementById(id).addEventListener('change', () => { clearTimeout(rebuildT); rebuildT = setTimeout(() => { if (plan) build(); }, 400); }));


// ================= Themes: each editing type has its own screens and transitions =================
const THEMES = {
  coral: { a1: '#FF785C', a2: '#CE2C1A', onA: '#fff', accent: '#F0452F', soft: 'rgba(240,70,48,.18)', ink: '#181616', sub: '#928C86', card: '#fff', line: '#F0EAE2', halo: '#7A241A', night: '#34140E', ctaInk: '#fff', trans: 'blob' },
  noir: { a1: '#C4FF6B', a2: '#6BD62E', onA: '#0a0a0a', accent: '#A6F94B', soft: 'rgba(166,249,75,.16)', ink: '#ffffff', sub: '#9BA1A8', card: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.14)', halo: '#16230d', night: '#060606', ctaInk: '#fff', trans: 'zoom', glow: '#7CFF3A' },
  dark: { a1: '#FFE14D', a2: '#F5B70B', onA: '#111', accent: '#FFD60A', soft: 'rgba(255,214,10,.15)', ink: '#ffffff', sub: '#A6A6A6', card: 'rgba(255,255,255,.07)', line: 'rgba(255,255,255,.15)', halo: '#2a2306', night: '#080807', ctaInk: '#fff', trans: 'zoom', glow: '#FFC400' },
  cine: { a1: '#E8D3A2', a2: '#B08D57', onA: '#14110d', accent: '#E8D3A2', soft: 'rgba(232,211,162,.15)', ink: '#F5F0E6', sub: '#9C9488', card: 'rgba(0,0,0,.45)', line: 'rgba(232,211,162,.25)', halo: '#2a2420', night: '#0a0908', ctaInk: '#F5F0E6', trans: 'fade' },
  bw: { a1: '#ff4d5e', a2: '#c3121f', onA: '#fff', accent: '#E11D2E', soft: 'rgba(225,29,46,.15)', ink: '#111111', sub: '#6b6b6b', card: '#ffffff', line: '#dddddd', halo: '#d9d9d9', night: '#f1f1f1', ctaInk: '#111', trans: 'slide', keyStyle: 'box' },
  vintage: { a1: '#d9443a', a2: '#a61f17', onA: '#fff', accent: '#C8261E', soft: 'rgba(200,38,30,.15)', ink: '#1d1a16', sub: '#6e6457', card: '#f7f0e1', line: '#d8ccb4', halo: '#e9dcc0', night: '#efe6d2', ctaInk: '#1d1a16', trans: 'fade', keyStyle: 'circle' },
  photo: { a1: '#ff5a5a', a2: '#c81e1e', onA: '#fff', accent: '#FF3B3B', soft: 'rgba(255,59,59,.15)', ink: '#ffffff', sub: '#d4d4d4', card: 'rgba(0,0,0,.55)', line: 'rgba(255,255,255,.2)', halo: '#3a1010', night: '#0c0c0c', ctaInk: '#fff', trans: 'zoom' },
  neonpink: { a1: '#ff4fd8', a2: '#9d1ee8', onA: '#fff', accent: '#ff4fd8', soft: 'rgba(255,79,216,.15)', ink: '#ffffff', sub: '#c4b5fd', card: 'rgba(255,255,255,.07)', line: 'rgba(255,79,216,.35)', halo: '#4a0e5c', night: '#0a0412', ctaInk: '#fff', trans: 'zoom' },
  clean: { a1: '#4F8BFF', a2: '#1D4ED8', onA: '#fff', accent: '#2563EB', soft: 'rgba(37,99,235,.12)', ink: '#0f172a', sub: '#64748b', card: '#fff', line: '#e2e8f0', halo: '#dbeafe', night: '#f8fafc', ctaInk: '#0f172a', trans: 'slide' }
};
const THEME_OF = { viro: 'noir', coral: 'coral', viral: 'noir', hormozi: 'dark', editorial: 'cine', minimal: 'clean' };
const themeKey = () => { const m = val('mg', 'auto'); return m !== 'auto' && THEMES[m] ? m : THEME_OF[$('#style').value] || 'coral'; };
const theme = () => THEMES[themeKey()];
const SERIF = s => { const f = val('fAccent', 'auto'); return f === 'auto' ? `italic 400 ${s}px "Instrument Serif", "Playfair Display", Georgia, serif` : fontOf(f, s); };
const ANTON = s => `400 ${s}px Anton, Impact, "Arial Narrow", sans-serif`;

// Paper looks: Editorial B/N (halftone grey, red box keyword) and Collage Vintage (beige paper, red scribble).
let grainCv = null;
function grain(alpha) {
  if (!grainCv) {
    grainCv = document.createElement('canvas'); grainCv.width = 256; grainCv.height = 256;
    const g = grainCv.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v2 = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v2; d.data[i + 3] = 40; }
    g.putImageData(d, 0, 0);
  }
  cx.save(); cx.globalAlpha = alpha; cx.globalCompositeOperation = 'overlay';
  const ox = Math.random() * 256, oy = Math.random() * 256;
  cx.translate(-ox, -oy); cx.fillStyle = cx.createPattern(grainCv, 'repeat'); cx.fillRect(0, 0, W + 256, H + 256); cx.restore();
}
function paperBg(t, k) {
  const TH = theme();
  cx.fillStyle = TH.night; cx.fillRect(0, 0, W, H);
  grain(.6);
  if (k === 'bw') {
    cx.save(); cx.globalAlpha = .08; cx.fillStyle = '#000'; cx.font = ANTON(520); cx.textAlign = 'right'; cx.fillText('%', W + 40 + Math.sin(t * .4) * 10, H * .32); cx.restore();
    cx.fillStyle = '#111'; for (let x = 0; x < W; x += 16) for (let y = H * .82; y < H; y += 16) { const r = 1 + 5 * ((y - H * .82) / (H * .18)); cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
  } else {
    cx.save(); cx.translate(W / 2, H * .15); cx.rotate(-.04); cx.fillStyle = '#f7f0e1'; cx.shadowColor = 'rgba(0,0,0,.2)'; cx.shadowBlur = 20; cx.fillRect(-W * .45, -40, W * .9, 80); cx.restore();
    cx.save(); cx.translate(W - 120, 120); cx.rotate(.2); cx.strokeStyle = TH.accent; cx.lineWidth = 4; cx.strokeRect(-80, -30, 160, 60); cx.fillStyle = TH.accent; cx.font = '700 22px "Courier New", monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('APROBADO', 0, 0); cx.restore();
  }
}
// "Realista": a real photo related to what you say, darkened, as the screen background.
function photoBg(t) {
  const ph = plan && plan.beats && plan.beats.photos.find(p => p.img);
  cx.fillStyle = '#0c0c0c'; cx.fillRect(0, 0, W, H);
  const im = (curScreen && curScreen.img) || (ph && ph.img);
  if (im) { blur(2); coverDraw(im, .75, 1.08 + .04 * Math.sin(t * .3), 0); blur(0); }
  const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.5, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,.8)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
}
// Keyword treatment per look: red box, hand-drawn circle, or accent color.
function keyWord(text, x, y, isKey, TH, wd, size, a) {
  if (!isKey) { cx.fillStyle = TH.ink; cx.fillText(text, x, y); return; }
  if (TH.keyStyle === 'box') {
    cx.fillStyle = TH.accent; cx.fillRect(x - 10, y - size * .55, (wd + 20) * a, size * 1.05);
    cx.fillStyle = '#fff'; cx.fillText(text, x, y); return;
  }
  cx.fillStyle = TH.accent; cx.fillText(text, x, y);
  if (TH.keyStyle === 'circle') {
    cx.save(); cx.strokeStyle = TH.accent; cx.lineWidth = 4; cx.beginPath();
    cx.ellipse(x + wd / 2, y, wd / 2 + 22, size * .6, -.05, 0, Math.PI * 2 * a); cx.stroke(); cx.restore();
  }
}
function screenBg(t) {
  const TH = theme(), k = themeKey();
  if (k === 'coral') return creamBg(t);
  if (k === 'bw' || k === 'vintage') return paperBg(t, k);
  if (k === 'photo') return photoBg(t);
  if (k === 'dark' || k === 'neonpink' || k === 'noir') {
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, TH.night); g.addColorStop(1, TH.halo); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.strokeStyle = TH.soft; cx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = H * .62 + Math.pow((i + (t * .8) % 1) / 14, 2) * H * .5; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    for (let i = -8; i <= 8; i++) { cx.beginPath(); cx.moveTo(W / 2 + i * 30, H * .62); cx.lineTo(W / 2 + i * 160, H); cx.stroke(); }
    cx.restore();
    [[W * .5, -H * .05, TH.accent], [W * .9, H * .9, TH.a2]].forEach(([x, y, c], i) => {
      const r = H * (.45 + .03 * Math.sin(t * .6 + i)), gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + (i ? '14' : '24')); gr.addColorStop(1, c + '00');
      cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    });
    for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 211.7 + t * 20 * (1 + i % 3)) % H; cx.fillStyle = `rgba(255,255,255,${.1 + .3 * Math.abs(Math.sin(t * 2 + i))})`; cx.fillRect(x, y, 2, 2); }
    grain(.35);
    return;
  }
  if (k === 'cine') {
    cx.fillStyle = TH.night; cx.fillRect(0, 0, W, H);
    const g = cx.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .45, H * .6); g.addColorStop(0, 'rgba(176,141,87,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    grain(.5);
    cx.strokeStyle = 'rgba(232,211,162,.25)'; cx.lineWidth = 1.5; cx.strokeRect(28, 28, W - 56, H - 56);
    return;
  }
  cx.fillStyle = TH.night; cx.fillRect(0, 0, W, H);
  [[W * .15, H * .15, '#93c5fd'], [W * .9, H * .7, '#c4b5fd'], [W * .3, H * .9, '#a5f3fc']].forEach(([x, y, c], i) => {
    const r = 260 + 30 * Math.sin(t * .8 + i), gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + 'aa'); gr.addColorStop(1, c + '00'); cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
  });
  cx.fillStyle = 'rgba(15,23,42,.08)';
  for (let x = 24; x < W; x += 36) for (let y = 24; y < H; y += 36) cx.fillRect(x, y, 2, 2);
}

// Off-screen render so non-coral types can zoom / fade / slide whole screens.
const scrCv = document.createElement('canvas'); scrCv.width = W; scrCv.height = H;
function screenTrans(t, S, E, draw, seed, key) {
  const TH = theme();
  if (TH.trans === 'blob') return screenWithBlobs(t, S, E, draw, seed, key);
  const T = .3;
  if (t < S - T || t > E + T) return false;
  if (busy && key && !fired.has(key)) { fired.add(key); sfx('whoosh'); }
  const kin = ease((t - (S - T)) / (2 * T)), kout = ease((t - (E - T)) / (2 * T)), k = Math.min(kin, 1 - kout);
  const real = cx; cx = scrCv.getContext('2d'); cx.save(); cx.clearRect(0, 0, W, H); draw(t); cx.restore(); blur(0); cx = real;
  const entering = t < (S + Math.min(E, S + 60)) / 2;
  cx.save();
  if (TH.trans === 'zoom') { const sc = 1 + .35 * (1 - k); cx.globalAlpha = Math.min(1, k * 1.6); cx.translate(W / 2, H / 2); cx.scale(sc, sc); cx.translate(-W / 2, -H / 2); blur(12 * (1 - k)); }
  else if (TH.trans === 'fade') cx.globalAlpha = k;
  else cx.translate((entering ? 1 : -1) * W * (1 - k), 0);
  cx.drawImage(scrCv, 0, 0); blur(0); cx.restore();
  if (TH.trans === 'zoom' && k > 0 && k < 1) glitch(k);
  if (TH.trans === 'fade' && k < 1) { cx.fillStyle = `rgba(0,0,0,${.55 * Math.sin(k * Math.PI)})`; cx.fillRect(0, 0, W, H); }
  return k >= 1;
}

// ---- Screens decided from what you say: numbers with units and the strongest sentence ----
const UNIT = /^(anos|ano|porciento|mil|millones|dolares|dolar|pesos|veces|dias|horas|minutos|meses|semanas|personas|seguidores|clientes|kilos|usd|euros|years|dollars|people|times|days|hours)$/;
const KEYQ = /nunca|siempre|secreto|clave|importante|verdad|error|nadie|todos|mejor|peor|ventaja|cambi|jamas|realmente|never|always|secret|truth|best|worst/;
function findScreens(P) {
  const out = [], busyR = [];
  if (!words.length) return out;
  if (P.list) busyR.push([P.list.s - 1, P.list.e + 1]);
  const free = (s, e) => !busyR.some(([a, b]) => s < b && e > a);
  const t0 = words[0].s, tEnd = words.at(-1).e - 3;
  words.forEach((w, i) => {
    if (!/\d/.test(w.t) || w.s - t0 < 3.5 || w.s > tEnd) return;
    const nx = words[i + 1], pct = /%/.test(w.t) || (nx && /^(%|porciento|por)$/.test(norm(nx.t)));
    const unit = pct ? '%' : nx && UNIT.test(norm(nx.t)) ? nx.t.replace(/[.,;:!?]+$/, '') : '';
    if (!unit) return;
    const s = w.s - .1, e = Math.max((nx ? nx.e : w.e) + 1.4, s + 2.3);
    if (!free(s - .5, e + .5)) return;
    const ctx = [];
    for (let j = i + 2; j < words.length && ctx.length < 6; j++) { ctx.push(words[j].t.replace(/[.,;:!?]+$/, '')); if (/[.!?,]$/.test(words[j].t)) break; }
    out.push({ type: 'stat', s, e, num: w.t.replace(/[^\d.,]/g, ''), unit, ctx: ctx.join(' ') });
    busyR.push([s - 1, e + 1]);
  });
  const sents = []; let cur = [];
  words.forEach(w => { cur.push(w); if (/[.!?]$/.test(w.t)) { sents.push(cur); cur = []; } });
  if (cur.length) sents.push(cur);
  let best = null, bs = 0;
  sents.forEach(se => {
    if (se.length < 4 || se.length > 14 || se[0].s - t0 < 3 || se.at(-1).e > tEnd) return;
    const sc = se.filter(w => KEYQ.test(norm(w.t))).length * 2 + (/[!?]$/.test(se.at(-1).t) ? 1 : 0) + (se.length <= 10 ? 1 : 0);
    if (sc > bs && free(se[0].s - .5, se.at(-1).e + 1)) { bs = sc; best = se; }
  });
  if (best && bs >= 2) out.push({ type: 'quote', s: best[0].s - .05, e: best.at(-1).e + .7, words: best });
  return out.sort((a, b) => a.s - b.s);
}
function statScreen(sc, t) {
  const TH = theme(), age = t - sc.s;
  screenBg(t);
  if (sc.img && themeKey() !== 'photo') { cx.save(); cx.globalAlpha = .3 * ease(age / .6); coverDraw(sc.img, .3, 1.05 + .03 * age, 0); cx.restore(); }
  const n = parseFloat(sc.num.replace(',', '.')) || 0, shown = n >= 1 ? Math.round(n * ease(age / .7)) : sc.num;
  cx.save(); cx.translate(W / 2, H * .42); cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const k = back(age / .35); cx.scale(k, k);
  let size = 330; cx.font = ANTON(size); const txt = String(shown) + (sc.unit === '%' ? '%' : '');
  while (cx.measureText(txt).width > W * .85 && size > 120) { size -= 10; cx.font = ANTON(size); }
  cx.shadowColor = 'rgba(0,0,0,.25)'; cx.shadowBlur = 40; cx.fillStyle = TH.ink; cx.fillText(txt, 0, 0); cx.shadowColor = 'transparent';
  if (sc.unit !== '%') {
    const uk = ease((age - .35) / .4); cx.save(); cx.globalAlpha = uk; cx.translate(W * .12, size * .36); cx.rotate(-.08);
    cx.font = SERIF(Math.max(70, size * .38)); cx.fillStyle = TH.accent; cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 16;
    cx.beginPath(); cx.rect(-W, -200, (W * 2) * uk, 400); cx.clip(); cx.fillText(sc.unit.toLowerCase(), 0, 0); cx.restore();
  }
  cx.restore();
  for (let p = 0; p < 26 && age < 1.2; p++) {
    const ang = p * 2.39, d = 120 + ease(age / .9) * (200 + (p % 6) * 25);
    cx.globalAlpha = Math.max(0, 1 - age / 1.2); cx.fillStyle = p % 2 ? TH.accent : TH.sub;
    cx.beginPath(); cx.arc(W / 2 + Math.cos(ang) * d, H * .42 + Math.sin(ang) * d, 3 + p % 3, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1;
  if (sc.ctx) {
    const ck = ease((age - .6) / .4); cx.globalAlpha = ck; cx.textAlign = 'center';
    cx.font = '700 36px "Plus Jakarta Sans", Inter, sans-serif'; cx.fillStyle = TH.sub;
    cx.fillText(sc.ctx, W / 2, H * .64 + 20 * (1 - ck));
    cx.fillStyle = TH.accent; cx.fillRect(W / 2 - 60 * ck, H * .67, 120 * ck, 6); cx.globalAlpha = 1;
  }
}
function quoteScreen(sc, t) {
  const TH = theme(); screenBg(t);
  const art = drawScreenArt(sc, t);
  const ws = sc.words, key = ws.reduce((a, w) => (KEYQ.test(norm(w.t)) ? w : clean(w.t).length > clean(a.t).length && !KEYQ.test(norm(a.t)) ? w : a), ws[0]);
  const size = 58, items = ws.map(w => ({ w, k: w === key, f: w === key ? SERIF(size * 1.45) : `800 ${size}px "Plus Jakarta Sans", Inter, sans-serif` }));
  const lines = [[]]; let lw = 0;
  items.forEach(it => { cx.font = it.f; it.wd = cx.measureText(it.w.t).width; if (lw + it.wd > W * .8 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(it); lw += it.wd + 16; });
  cx.save(); cx.globalAlpha = .18; cx.fillStyle = TH.accent; cx.font = SERIF(320); cx.textBaseline = 'top'; cx.fillText('“', 40, H * .12); cx.restore();
  const lh = size * 1.5, y0 = (art ? H * .7 : H * .45) - (lines.length - 1) * lh / 2;
  cx.textBaseline = 'middle';
  lines.forEach((l, li) => {
    const tw = l.reduce((a, it) => a + it.wd, 0) + 16 * (l.length - 1); let x = (W - tw) / 2;
    l.forEach(it => {
      const a = ease((t - it.w.s + .05) / .25);
      if (a > 0) { cx.save(); cx.globalAlpha = a; blur(6 * (1 - a)); cx.font = it.f; keyWord(it.w.t, x, y0 + li * lh + 14 * (1 - a), it.k, TH, it.wd, size * (it.k ? 1.45 : 1), a); blur(0); cx.restore(); }
      x += it.wd + 16;
    });
  });
}



// ================= Editor controls, extra looks and overlays =================
const val = (id, d) => { const el = document.getElementById(id); return el ? el.value : d; };
const hookFx = () => val('hookFx', 'flash');
// Text hook: giant word behind you, card on top, or a big question over the opening.
const hookTextType = () => { const v2 = val('hookText', 'auto'); return v2 !== 'auto' ? v2 : $('#style').value === 'coral' ? 'card' : $('#style').value === 'viro' ? recipe().hook : 'big'; };
const hookSound = () => { const v2 = val('hookSfx', 'auto'); return v2 === 'auto' ? 'riser' : v2; };
const grade = () => val('grade', 'none') !== 'none';
// Color grading presets (cheap full-frame blends).
function colorGrade() {
  const g = val('grade', 'none');
  cx.save();
  if (g === 'warm') { cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = 'rgba(255,150,60,.35)'; cx.fillRect(0, 0, W, H); }
  else if (g === 'teal') { cx.globalCompositeOperation = 'soft-light'; const gr = cx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,140,160,.45)'); gr.addColorStop(1, 'rgba(255,120,40,.35)'); cx.fillStyle = gr; cx.fillRect(0, 0, W, H); }
  else if (g === 'bw') { cx.globalCompositeOperation = 'saturation'; cx.fillStyle = '#888'; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(0, 0, W, H); }
  else if (g === 'punch') { cx.globalCompositeOperation = 'overlay'; cx.fillStyle = 'rgba(128,128,128,.35)'; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'saturation'; cx.fillStyle = 'rgba(255,0,0,.12)'; cx.fillRect(0, 0, W, H); }
  else if (g === 'film') { cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = 'rgba(255,220,170,.3)'; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over'; cx.restore(); cx.save(); grain(.5); }
  cx.restore();
}
// Title above the framed video ("Enmarque motivacional").
function drawFrameTitle(text, ot) {
  const k = ease(ot / .6), ws = text.split(' ');
  const keyI = ws.reduce((b, w, i) => clean(w).length > clean(ws[b]).length ? i : b, 0);
  cx.save(); cx.globalAlpha = k; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  let size = 64; cx.font = bigFont(size, false);
  const head = ws.filter((w, i) => i !== keyI).join(' ').toUpperCase(), key = ws[keyI].replace(/[.,;:!?]+$/, '');
  while (cx.measureText(head).width > W * .86 && size > 30) { size -= 4; cx.font = bigFont(size, false); }
  cx.fillStyle = '#fff'; cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 20;
  cx.fillText(head, W / 2, H * .1 + 20 * (1 - k));
  let ks = 96; cx.font = SERIF(ks); while (cx.measureText(key).width > W * .8 && ks > 40) { ks -= 6; cx.font = SERIF(ks); }
  cx.fillStyle = theme().accent; cx.translate(W / 2, H * .1 + size * .95); cx.rotate(-.05); cx.fillText(key, 0, 0);
  cx.restore();
}
// TikTok / Reels interface preview so you can check nothing important is covered (never exported).
function drawSafeZones() {
  // Where each app puts its buttons and texts (share of the 9:16 frame): right rail and bottom band.
  const Z = { tt: { name: 'TikTok', right: .111, bottom: .156, top: .068 }, ig: { name: 'Reels', right: .157, bottom: .182, top: .109 }, yt: { name: 'Shorts', right: .176, bottom: .177, top: .094 } }[val('safeApp', 'tt')] || {};
  cx.save();
  cx.fillStyle = 'rgba(255,60,60,.16)'; cx.fillRect(0, 0, W, H * Z.top); cx.fillRect(0, H * (1 - Z.bottom), W, H * Z.bottom); cx.fillRect(W * (1 - Z.right), H * Z.top, W * Z.right, H * (1 - Z.top - Z.bottom));
  cx.strokeStyle = 'rgba(52,211,153,.9)'; cx.setLineDash([10, 8]); cx.lineWidth = 2;
  cx.strokeRect(W * .04, H * Z.top, W * (.96 - Z.right), H * (1 - Z.top - Z.bottom)); cx.setLineDash([]);
  cx.fillStyle = 'rgba(16,185,129,.9)'; rrect(W * .5 - 120, H * Z.top + 14, 240, 40, 20); cx.fill();
  cx.fillStyle = '#fff'; cx.font = '700 20px Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(`Zona segura · ${Z.name}`, W * .5, H * Z.top + 34);
  cx.globalAlpha = .9; cx.font = '40px sans-serif';
  ['♥', '💬', '↗', '⋯'].forEach((ic, i) => cx.fillText(ic, W * (1 - Z.right / 2), H * .5 + i * 86));
  cx.font = '600 22px Inter, sans-serif'; cx.textAlign = 'left'; cx.fillStyle = '#fff';
  cx.fillText('@tucuenta · descripción y hashtags', 30, H * (1 - Z.bottom) + 40); cx.fillText('♫ sonido original', 30, H * (1 - Z.bottom) + 76);
  cx.restore();
}

// ---- Smart overlays: glass / neon / mono / graph / femtech / cyber cards with the key idea, chosen by AI from what you say ----
function findOverlays(P) {
  const out = []; if (!words.length) return out;
  const busyR = [];
  if (P.list) busyR.push([P.list.s - 1, P.list.e + 1]);
  (P.screens || []).forEach(s => busyR.push([s.s - 1, s.e + 1]));
  const free = (s, e) => !busyR.some(([a, b]) => s < b && e > a);
  const sents = []; let cur = [];
  words.forEach((w, i) => { cur.push(w); if (/[.!?]$/.test(w.t) || cur.length >= 12 || (words[i + 1] && words[i + 1].s - w.e > .5)) { sents.push(cur); cur = []; } });
  if (cur.length) sents.push(cur);
  let last = (P.hookDur || 3) + 1;
  sents.forEach(se => {
    if (se.length < 4 || se[0].s - last < 7 || se.at(-1).e > words.at(-1).e - 2.5) return;
    const s = se[0].s, e = se.at(-1).e + .9;
    if (!free(s, e)) return;
    const key = se.reduce((a, w) => clean(w.t).length > clean(a.t).length ? w : a, se[0]);
    const labels = ['Dato clave', 'Insight', 'Tip', 'Importante', 'Recordá'];
    out.push({ s, e, words: se, key, label: labels[out.length % labels.length] }); busyR.push([s, e]); last = e;
  });
  return out;
}
const OV = {
  glass: { bg: 'rgba(15,15,20,.5)', border: 'rgba(255,255,255,.45)', ink: '#fff', key: '#fff', label: 'rgba(255,255,255,.7)', blur: 18, font: s => `600 ${s}px "Plus Jakarta Sans", Inter, sans-serif` },
  neon: { bg: 'rgba(40,10,70,.82)', border: '#c084fc', ink: '#fff', key: '#f0abfc', label: '#c084fc', glow: '#a855f7', font: s => `700 ${s}px Outfit, Inter, sans-serif` },
  mono: { bg: '#fafafa', border: '#111', ink: '#111', key: '#111', label: '#666', font: s => `italic 400 ${s * 1.15}px "Instrument Serif", Georgia, serif`, underline: true },
  graph: { bg: '#fffdf6', border: '#cfd8e3', ink: '#1f2937', key: '#2563eb', label: '#64748b', grid: true, font: s => `700 ${s}px Caveat, "Plus Jakarta Sans", cursive` },
  femtech: { bg: '#fff1f2', border: '#fda4af', ink: '#111', key: '#e11d48', label: '#e11d48', font: s => `700 ${s}px "Plus Jakarta Sans", Inter, sans-serif` },
  cyber: { bg: 'rgba(5,10,5,.88)', border: '#a3e635', ink: '#d9f99d', key: '#a3e635', label: '#a3e635', mono: true, font: s => `600 ${s}px "JetBrains Mono", "Courier New", monospace` }
};
function drawOverlays(t, P) {
  const o = (P.overlays || []).find(x => t >= x.s && t <= x.e); if (!o) return;
  const ovk = val('ovStyle', 'auto'), TH = theme();
  const S = ovk === 'auto' ? { ...OV.glass, key: TH.accent, label: TH.accent, border: TH.line === '#e2e8f0' || TH.line === '#dddddd' ? 'rgba(255,255,255,.5)' : TH.line } : OV[ovk] || OV.glass;
  const age = t - o.s, left = o.e - t, k = Math.min(ease(age / .35), ease(left / .3));
  const cw = W * .88, x0 = (W - cw) / 2, fs = 44;
  cx.save(); cx.font = S.font(fs);
  const lines = [[]]; let lw = 0;
  o.words.forEach(w => { const ww = cx.measureText(w.t + ' ').width; if (lw + ww > cw - 60 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push({ w, ww }); lw += ww; });
  const chh = 84 + lines.length * fs * 1.3, y0 = H * .1;
  cx.globalAlpha = k; cx.translate(0, -30 * (1 - k));
  if (S.blur && HAS_FILTER) { cx.save(); rrect(x0, y0, cw, chh, 26); cx.clip(); blur(S.blur); cx.drawImage(cv, x0 - 30, y0 - 30, cw + 60, chh + 60, x0 - 30, y0 - 30, cw + 60, chh + 60); blur(0); cx.restore(); }
  if (S.glow) { cx.shadowColor = S.glow; cx.shadowBlur = 30; }
  rrect(x0, y0, cw, chh, 26); cx.fillStyle = S.bg; cx.fill(); cx.shadowColor = 'transparent';
  cx.lineWidth = 2; cx.strokeStyle = S.border; cx.stroke();
  if (S.grid) { cx.save(); rrect(x0, y0, cw, chh, 26); cx.clip(); cx.strokeStyle = 'rgba(37,99,235,.12)'; cx.lineWidth = 1; for (let gx = x0; gx < x0 + cw; gx += 22) { cx.beginPath(); cx.moveTo(gx, y0); cx.lineTo(gx, y0 + chh); cx.stroke(); } for (let gy = y0; gy < y0 + chh; gy += 22) { cx.beginPath(); cx.moveTo(x0, gy); cx.lineTo(x0 + cw, gy); cx.stroke(); } cx.restore(); }
  cx.fillStyle = S.label; cx.font = `800 22px ${S.mono ? '"JetBrains Mono", monospace' : 'Inter, sans-serif'}`; cx.textBaseline = 'middle';
  cx.fillText((S.mono ? '> ' : '● ') + o.label.toUpperCase(), x0 + 32, y0 + 36);
  cx.font = S.font(fs);
  lines.forEach((l, li) => {
    let x = x0 + 32; const y = y0 + 84 + li * fs * 1.3;
    l.forEach(({ w, ww }) => {
      const a = ease((t - w.s + .1) / .2);
      cx.globalAlpha = k * Math.max(.55, a); cx.fillStyle = w === o.key ? S.key : S.ink; cx.fillText(w.t, x, y);
      if (w === o.key && S.underline) { cx.fillRect(x, y + fs * .55, (ww - 10) * a, 3); }
      x += ww;
    });
  });
  if (S.mono && Math.floor(t * 2) % 2) { cx.fillStyle = S.key; cx.fillRect(x0 + cw - 40, y0 + chh - 40, 14, 24); }
  cx.restore();
}

// ---- Custom typography (Personalizar) ----
function fontOverride(base) {
  const f = val('fBase', 'auto'); if (f === 'auto') return base;
  return { ...base, font: s => fontOf(f, s) };
}

// Draws one output frame for source time t from any drawable (the <video> in preview, a decoded VideoFrame when exporting).
let curSrc = v, curOt = 0, fastBusy = false;
const flipCv = document.createElement('canvas'), flipCx = flipCv.getContext('2d');
function drawFrame(t, src, sw, sh) {
  // "Espejar": undo the selfie-camera mirror (text on clothes reads correctly).
  if (on('optFlip')) { if (flipCv.width !== sw || flipCv.height !== sh) { flipCv.width = sw; flipCv.height = sh; } flipCx.setTransform(-1, 0, 0, 1, sw, 0); flipCx.drawImage(src, 0, 0, sw, sh); src = flipCv; }
  curSrc = src;
  const P = plan;
  const si = P ? P.segs.findIndex(g => t >= g.s - .06 && t < g.e + .02) : -1;
  const g = si >= 0 ? P.segs[si] : null;
  const ot = g ? g.o + (t - g.s) : t;
  curOt = ot;
  const st = style(), coral = !!st.coral;
  const hookOn = P && on('optHook');
  const ci = P ? P.chunks.findIndex(c => t >= c.s - .02 && t <= c.e + .2) : -1;
  const ch = ci >= 0 ? P.chunks[ci] : null;
  if (ot < .05) fired.clear();

  if (busy && si !== lastSeg) { if (lastSeg >= 0 && si % 2 === 1 && !coral) sfx('whoosh'); lastSeg = si; }
  if (busy && ci !== lastChunk) { if (ci >= 0 && ch.emph) sfx('pop'); lastChunk = ci; }

  const zoomOn = on('optZoom');
  let z = g && zoomOn ? (coral ? 1 + (g.z - 1) * .55 : g.z) : 1;
  const hk = hookFx();
  // Camera: a gentle opening settle, a slow push-in inside each shot and a light reframe on cuts. No shakes, no whips.
  if (hookOn && hk === 'zoom' && ot < .7) z *= 1 + .28 * (1 - ease(ot / .7));
  else if (hookOn && st.viro && /^(blur|flash|cine)$/.test(hk) && ot < .5) z *= 1 + .4 * (1 - easeQ(ot / .5));
  else if (hookOn && hk !== 'none' && ot < 1.2) z *= 1 + .08 * (1 - ease(ot / 1.2));
  if (zoomOn && g && !st.viro) z *= 1 + .035 * Math.min(1, (t - g.s) / Math.max(2, g.e - g.s));
  if (zoomOn && P && st.viro && ci >= 0) {
    const blk = Math.floor(ci / 7), inB = ci % 7, lv = [1.06, 1.1, 1.14, 1.08][blk % 4], kind = [0, 1, 2, 0, 2, 1][blk % 6];
    if (inB >= 3) {
      const c0 = P.chunks[ci - (inB - 3)], dt = t - c0.s, sp = kind === 0 ? 1.2 : kind === 1 ? .4 : .001;
      z *= 1 + (lv - 1) * (kind === 2 ? 1 : easeQ(dt / sp));
      if (busy && kind !== 2 && !fired.has('zi' + blk)) { fired.add('zi' + blk); sfx('whoosh'); }
    }
  }
  if (P && on('optPunch')) { const pu = P.punches.find(q => t >= q.s && t <= q.e + .4); if (pu) z *= 1 + .14 * ease((t - pu.s) / .35) * (1 - ease((t - pu.e) / .4)); }
  const sx = 0, sy = 0;

  const framed = on('optFrame');
  const brollLayout = blay();
  const splitPh = P && P.beats && !framed && brollLayout === 'split' ? P.beats.photos.find(q => brollMedia(q) && t >= q.s && t <= q.e) : null;
  capX = W / 2; capY = splitPh ? H * .5 : H * (style().viro ? recipe().capY : .69);
  let x, y, w, h;
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
  if (framed) {
    // "Enmarque": blurred copy of the video as background, the video inset in a rounded card, title on top.
    const bs = Math.max(W / sw, H / sh) * 1.15;
    blur(28); cx.globalAlpha = .55; cx.drawImage(src, (W - sw * bs) / 2, (H - sh * bs) / 2, sw * bs, sh * bs); cx.globalAlpha = 1; blur(0);
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(0, 0, W, H);
    const fw = W * .86, fh = H * .66, fx0 = (W - fw) / 2, fy0 = H * .25;
    const s2 = Math.max(fw / sw, fh / sh) * z; w = sw * s2; h = sh * s2;
    x = fx0 + (fw - w) / 2 + sx; y = fy0 + (fh - h) * .42 + sy;
    cx.save(); cx.shadowColor = 'rgba(0,0,0,.5)'; cx.shadowBlur = 40; rrect(fx0, fy0, fw, fh, 34); cx.fillStyle = '#000'; cx.fill(); cx.restore();
    cx.save(); rrect(fx0, fy0, fw, fh, 34); cx.clip(); cx.drawImage(src, x, y, w, h); cx.restore();
    if (P && P.hook) drawFrameTitle(P.hook, ot);
  } else if (splitPh) {
    const k = Math.min(ease((t - splitPh.s) / .35), ease((splitPh.e - t) / .35)), top = H * .5 * k;
    const s = Math.max(W / sw, (H - top) / sh) * z; w = sw * s; h = sh * s;
    x = (W - w) / 2; y = top + Math.min(0, Math.max(H - top - h, (H - top) / 2 - h * .42));
    cx.save(); cx.beginPath(); cx.rect(0, top, W, H - top); cx.clip(); cx.drawImage(src, x, y, w, h); cx.restore();
    if (top > 1) {
      const img = brollMedia(splitPh), iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height, s3 = Math.max(W / iw, top / ih) * (1.03 + .03 * (t - splitPh.s));
      cx.save(); cx.beginPath(); cx.rect(0, 0, W, top); cx.clip(); cx.drawImage(img, (W - iw * s3) / 2, (top - ih * s3) / 2, iw * s3, ih * s3); cx.restore();
      cx.fillStyle = '#000'; cx.fillRect(0, top - 2, W, 4);
    }
  } else {
    const s = Math.max(W / sw, H / sh) * z; w = sw * s; h = sh * s;
    const fx = g ? g.fx : .5;
    x = Math.min(0, Math.max(W - w, W / 2 - w * fx)) + sx; y = Math.min(0, Math.max(H - h, H * .42 - h * .42)) + sy;
    cx.drawImage(src, x, y, w, h);
  }
  if (grade()) colorGrade();
  if (!coral && !framed) {
    const gr = cx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
    cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
  }
  if (hookOn && hk === 'flash' && !coral && ot < .22) { cx.fillStyle = `rgba(255,255,255,${.9 * (1 - ot / .22)})`; cx.fillRect(0, 0, W, H); }
  galleryOn = !!(P && hookOn && on('optGallery') && !splitPh && ot < Math.min(P.hookDur, 3));
  if (galleryOn) galleryOn = drawGallery(P, ot);
  const fxs = P && !framed ? fxLayer(t, ot, P, x, y, w, h, coral) : { hide: false };
  let covered = false;
  if (P && P.list && on('optMG')) {
    const L = P.list;
    covered = screenTrans(t, L.s, L.e, tt => listScreen(L, tt), 3, 'list');
    if (busy) L.items.forEach(it => { const kk = 'n' + it.n; if (t >= it.at && !fired.has(kk)) { fired.add(kk); sfx('pop'); } });
  }
  if (P && P.screens) P.screens.forEach((sc, i) => {
    if (t < sc.s - .4 || t > sc.e + .4) return;
    if (sc.type === 'stat' ? !on('optStats') : !on('optMG')) return;
    if (screenTrans(t, sc.s, sc.e, tt => { curScreen = sc; sc.type === 'stat' ? statScreen(sc, tt) : quoteScreen(sc, tt); curScreen = null; }, 11 + i, 'sc' + sc.s)) covered = true;
    if (busy && sc.type === 'stat' && t >= sc.s + .4 && !fired.has('d' + sc.s)) { fired.add('d' + sc.s); sfx('ding'); }
  });
  if (P && !covered && on('optOverlay') && !(P.beats && P.beats.photos.some(q => q.img && t >= q.s && t <= q.e))) drawOverlays(t, P);
  const ctaS = P ? P.total - 2.4 : 0;
  const inCta = P && P.cta && on('optMG') && ot >= ctaS - .35;
  if (on('optFollow') && !splitPh && !framed) followHead(x, y, w, h);
  const qHook = hookOn && P && P.hook && hookTextType() === 'question' && ot < P.hookDur;
  if (P && !covered && !fxs.hide && !qHook && !(inCta && ot >= ctaS) && on('optCaps')) { drawCaption(ch, t); }
  if (hookOn && P && P.hook && !covered && !framed && hookTextType() === 'card') drawHookCard(P.hook, ot, P.hookDur);
  if (hookOn && P && P.hook && !covered && hookTextType() === 'question') drawHookQuestion(P.hook, ot, P.hookDur);
  if (hookOn && P && P.hook && hookTextType() === 'blackout' && hk !== 'blackout' && ot < 1.1) drawBlackout(P.hook, ot);
  if (hookOn && P && P.hook && !covered && !framed && hookTextType() === 'stack' && !(P.beats && P.beats.photos.some(q => t >= q.s && t <= q.e && (q.img || q.vid)))) drawStackHook(P.hook, ot, Math.min(3.2, P.hookDur + .4));
  if (hookOn && P && P.hook && !covered && !framed && hookTextType() === 'viro' && ot < P.hookDur && !(P.beats && P.beats.photos.some(q => q.hookT && (q.img || q.vid || q.failed)))) {
    const k = Math.min(ease(ot / .3), ease((P.hookDur - ot) / .3));
    viroPhotoText({ s: t - ot, e: t - ot + P.hookDur, label: P.hook, kicker: '' }, t, k);
  }
  if (inCta) screenTrans(ot, ctaS, 1e9, tt => ctaScreen(P.cta, tt - ctaS), 7, 'cta');
  if (P && on('optBar')) { cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - 8, W, 8); cx.fillStyle = theme().accent; cx.fillRect(0, H - 8, W * ot / P.total, 8); }
  if (P && !covered) fxTop(t, ot, P, si);
  if (busy && hookOn && ot < .15 && !fired.has('hooksfx')) {
    fired.add('hooksfx');
    const hs = hookSound();
    if (hs === 'riser') { sfx('riser'); sfx('impact', .5); } else if (hs !== 'none') sfx(hs);
  }
  if (hookOn && hk === 'blur' && ot < .6) { const k = 1 - ease(ot / .6); cx.save(); blur(18 * k); cx.drawImage(cv, 0, 0); blur(0); cx.restore(); }
  if (hookOn && hk === 'cine' && st.viro && ot < .5) { const k = 1 - easeQ(ot / .5); cx.save(); cx.globalCompositeOperation = 'saturation'; cx.fillStyle = `rgba(128,128,128,${k})`; cx.fillRect(0, 0, W, H); cx.restore(); cx.fillStyle = `rgba(0,0,0,${.5 * k})`; cx.fillRect(0, 0, W, H); }
  if (hookOn && hk === 'cine' && !st.viro && ot < 1.4) { const k = 1 - ease(ot / 1.4), bh = H * .13 * k; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, bh); cx.fillRect(0, H - bh, W, bh); }
  if (hookOn && hk === 'iris' && ot < .8) { const r = Math.hypot(W, H) * .6 * ease(ot / .8); cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.arc(W / 2, H * .4, Math.max(1, r), 0, Math.PI * 2); cx.fillStyle = '#000'; cx.fill('evenodd'); cx.restore(); }
  if (hookOn && hk === 'swipe' && ot < .5) { const off = H * (1 - ease(ot / .5)); const sc = scrCv.getContext('2d'); sc.clearRect(0, 0, W, H); sc.drawImage(cv, 0, 0); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.drawImage(scrCv, 0, off); }
  if (hookOn && hk === 'glitch' && ot < .45) glitch(ot / .45);
  if (hookOn && hk === 'blackout' && P && P.hook && ot < 1.1) drawBlackout(P.hook, ot);
  if (P && on('optLoop')) loopBlend(ot, P.total);
  if (!busy && on('optSafe')) drawSafeZones();
  if (busy && P) prog(ot / P.total);
  return ot;
}

let lastDraw = 0, lastT = -1, dirty = true;
document.addEventListener('change', () => { dirty = true; });
document.addEventListener('input', () => { dirty = true; });
function render(now) {
  requestAnimationFrame(render);
  if (fastBusy || document.hidden || v.readyState < 2 || !v.videoWidth || v.seeking) return;
  if (!busy && now - lastDraw < 31) return;
  const P = plan, t = v.currentTime;
  if (!busy && v.paused && t === lastT && !dirty) return;
  lastDraw = now; lastT = t; dirty = false;
  if (P) {
    const si = P.segs.findIndex(g => t >= g.s - .06 && t < g.e + .02);
    if (si < 0 || t >= P.segs[si].e) {
      const next = P.segs.findIndex(g => g.s > t - .02);
      if (next >= 0 && (si < 0 || next > si)) { v.currentTime = P.segs[next].s; return; }
      if (busy) { finish(); return; }
      v.currentTime = P.segs[0].s; lastSeg = lastChunk = -1; fired.clear(); return;
    }
  }
  drawFrame(t, v, v.videoWidth, v.videoHeight);
  if (window.onFrame) window.onFrame(t);
}
requestAnimationFrame(render);

// ---------- Sound effects (synthesized, no files) ----------
let sfxLog = null;
function sfx(type, delay = 0) {
  if (!on('optSfx')) return;
  if (sfxLog) { sfxLog.push({ type, at: curOt + delay }); return; }
  if (!ac || !dest) return;
  playSfx(type, ac.currentTime + delay);
}
function playSfx(type, t0) {
  if (sfxExtra(type, t0)) return;
  const out = ac.createGain(); out.connect(dest);
  if (type === 'whoosh' || type === 'boom') {
    const n = ac.createBufferSource(); n.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    const len = type === 'boom' ? .5 : .35;
    f.frequency.setValueAtTime(type === 'boom' ? 900 : 300, t0);
    f.frequency.exponentialRampToValueAtTime(type === 'boom' ? 120 : 3500, t0 + len);
    out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(type === 'boom' ? .35 : .18, t0 + .06); out.gain.linearRampToValueAtTime(0, t0 + len);
    n.connect(f); f.connect(out); n.start(t0); n.stop(t0 + len);
  }
  if (type === 'boom' || type === 'pop') {
    const o = ac.createOscillator(), og = ac.createGain();
    const len = type === 'boom' ? .7 : .09;
    o.type = 'sine';
    o.frequency.setValueAtTime(type === 'boom' ? 140 : 520, t0);
    o.frequency.exponentialRampToValueAtTime(type === 'boom' ? 38 : 1250, t0 + len);
    og.gain.setValueAtTime(type === 'boom' ? .7 : .22, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + len);
    o.connect(og); og.connect(dest); o.start(t0); o.stop(t0 + len);
  }
}
function makeNoise(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// ---------- Fast export: decode → draw → encode frame by frame (WebCodecs), much faster than real time ----------
async function fastExport() {
  if (!window.VideoEncoder || !window.VideoDecoder || !window.AudioEncoder || !window.OfflineAudioContext) return null;
  if (!/\.(mp4|m4v|mov)$/i.test(file.name) && !/mp4|quicktime/.test(file.type)) return null;
  const [mb, Mux] = await Promise.all([import('https://cdn.jsdelivr.net/npm/mp4box@0.5.4/+esm'), import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm')]);
  const MP4Box = mb.default || mb;
  const buf = await file.arrayBuffer();
  const mp4 = MP4Box.createFile();
  const samples = [];
  let info = null;
  mp4.onReady = i => { info = i; };
  mp4.onSamples = (id, u, s) => { samples.push(...s); };
  buf.fileStart = 0; mp4.appendBuffer(buf); mp4.flush();
  const vt = info && info.videoTracks[0];
  if (!vt) return null;
  mp4.setExtractionOptions(vt.id, null, { nbSamples: Infinity }); mp4.start(); mp4.flush();
  if (!samples.length) return null;
  const trak = mp4.getTrackById(vt.id), entry = trak.mdia.minf.stbl.stsd.entries[0];
  const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
  let description;
  if (box) { const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN); box.write(ds); description = new Uint8Array(ds.buffer, 8); }
  const dcfg = { codec: vt.codec.startsWith('vp08') ? 'vp8' : vt.codec, codedWidth: vt.video.width, codedHeight: vt.video.height, description };
  if (!(await VideoDecoder.isConfigSupported(dcfg).catch(() => ({}))).supported) return null;
  const m = vt.matrix || [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824];
  const angle = ((Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI) % 360) + 360) % 360;
  const rot = document.createElement('canvas'), rcx = rot.getContext('2d');

  const fps = 30;
  let vcfg = null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42001f', 'vp09.00.40.08']) {
    const c = { codec, width: W, height: H, bitrate: 8e6, framerate: fps };
    if ((await VideoEncoder.isConfigSupported(c).catch(() => ({}))).supported) { vcfg = c; break; }
  }
  let acfg = null;
  for (const codec of ['mp4a.40.2', 'opus']) {
    const c = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 };
    if ((await AudioEncoder.isConfigSupported(c).catch(() => ({}))).supported) { acfg = c; break; }
  }
  if (!vcfg || !acfg) return null;

  // Everything the frames need must be ready before we start.
  msg('Terminando las imágenes IA…');
  if (brollFor === null && on('optAI') && on('optPhotos')) await pickBroll();
  const t0w = performance.now();
  while (aiPending.size && performance.now() - t0w < 45000) { msg(`Terminando las imágenes IA… (${aiPending.size})`); await Promise.race([...aiPending, new Promise(r => setTimeout(r, 1500))]); }

  if (on('optBig')) await loadSeg();
  await exportFonts();

  fastBusy = true; busy = true; v.pause();
  let err = null;
  const muxer = new Mux.Muxer({
    target: new Mux.ArrayBufferTarget(), fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: vcfg.codec.startsWith('avc') ? 'avc' : 'vp9', width: W, height: H },
    audio: { codec: acfg.codec === 'opus' ? 'opus' : 'aac', numberOfChannels: 2, sampleRate: 48000 }
  });
  const venc = new VideoEncoder({ output: (c, md) => muxer.addVideoChunk(c, md), error: e => { err = e; } });
  venc.configure(vcfg);
  const frames = [];
  const dec = new VideoDecoder({ output: f => frames.push(f), error: e => { err = e; } });
  dec.configure(dcfg);
  let si = 0, flushed = false, current = null;
  const tsOf = f => f.timestamp / 1e6;
  async function frameAt(t) {
    for (;;) {
      while (frames.length && tsOf(frames[0]) <= t + .001) { if (current) current.close(); current = frames.shift(); }
      if (frames.length || flushed) return current || frames[0];
      if (si < samples.length) {
        for (let k = 0; k < 8 && si < samples.length; k++, si++) {
          const s = samples[si];
          dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: s.cts * 1e6 / s.timescale, duration: s.duration * 1e6 / s.timescale, data: s.data }));
        }
        await new Promise(r => setTimeout(r, 0));
      } else { await dec.flush(); flushed = true; }
      if (err) throw err;
    }
  }
  sfxLog = []; fired.clear(); lastSeg = lastChunk = -1;
  const total = plan.total, N = Math.ceil(total * fps), t0 = performance.now();
  try {
    for (let k = 0; k < N; k++) {
      const ot = k / fps;
      const g = plan.segs.find(s => ot < s.o + (s.e - s.s)) || plan.segs.at(-1);
      const t = Math.min(g.e - .001, g.s + (ot - g.o));
      const f = await frameAt(t);
      if (!f) break;
      let src = f, sw = f.displayWidth, sh = f.displayHeight;
      if (angle % 180) {
        if (rot.width !== sh) { rot.width = sh; rot.height = sw; }
        rcx.save(); rcx.translate(sh / 2, sw / 2); rcx.rotate(angle * Math.PI / 180); rcx.drawImage(f, -sw / 2, -sh / 2); rcx.restore();
        src = rot; [sw, sh] = [sh, sw];
      } else if (angle === 180) {
        if (rot.width !== sw) { rot.width = sw; rot.height = sh; }
        rcx.save(); rcx.translate(sw / 2, sh / 2); rcx.rotate(Math.PI); rcx.drawImage(f, -sw / 2, -sh / 2); rcx.restore(); src = rot;
      }
      await brollSeek(t);
      drawFrame(t, src, sw, sh);
      const vf = new VideoFrame(cv, { timestamp: Math.round(ot * 1e6), duration: Math.round(1e6 / fps) });
      venc.encode(vf, { keyFrame: k % 60 === 0 }); vf.close();
      if (venc.encodeQueueSize > 6) await new Promise(r => venc.addEventListener('dequeue', r, { once: true }));
      if (k % 8 === 0) { prog(k / N * .92); msg(`Exportando… ${Math.round(k / N * 100)}%`); await new Promise(r => setTimeout(r, 0)); }
      if (err) throw err;
    }
    await venc.flush();
    if (current) current.close(); frames.forEach(f => f.close()); dec.close();

    // Audio: original voice cut to the same segments + all sound effects, rendered offline (instant).
    msg('Mezclando el audio…');
    const sr = 48000, off = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sr)), sr);
    try {
      const orig = await off.decodeAudioData(await file.arrayBuffer());
      plan.segs.forEach(g => { const s = off.createBufferSource(); s.buffer = orig; s.connect(off.destination); s.start(g.o, g.s, g.e - g.s); });
    } catch (e) { console.warn('no audio track', e); }
    const save = { ac, dest, noiseBuf };
    ac = off; dest = off.createGain(); dest.connect(off.destination); noiseBuf = makeNoise(off);
    sfxLog.forEach(e => playSfx(e.type, Math.max(0, e.at)));
    ({ ac, dest, noiseBuf } = save);
    const ab = await off.startRendering();
    const aenc = new AudioEncoder({ output: (c, md) => muxer.addAudioChunk(c, md), error: e => { err = e; } });
    aenc.configure(acfg);
    const Lc = ab.getChannelData(0), Rc = ab.numberOfChannels > 1 ? ab.getChannelData(1) : Lc;
    for (let i = 0; i < ab.length; i += 1024) {
      const n = Math.min(1024, ab.length - i), data = new Float32Array(n * 2);
      data.set(Lc.subarray(i, i + n), 0); data.set(Rc.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / sr * 1e6), data });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush();
    if (err) throw err;
    muxer.finalize();
    console.log('fast export secs', (performance.now() - t0) / 1000);
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    sfxLog = null; fastBusy = false; busy = false;
  }
}

function deliver(blob, ext) {
  const a = $('#dl');
  a.href = URL.createObjectURL(blob); a.download = 'videora-editado.' + ext; a.hidden = false;
  prog(1); msg(`¡Listo! Tocá Descargar para guardar tu video (${ext.toUpperCase()}).`);
  if (window.onExported) window.onExported(a.href, ext);
}

// ---------- Export ----------
$('#go').onclick = async () => {
  if (busy || !plan) return;
  $('#go').disabled = $('#ai').disabled = true; $('#dl').hidden = true;
  msg('Preparando la exportación…');
  try {
    const blob = await fastExport();
    if (blob) { deliver(blob, 'mp4'); $('#go').disabled = $('#ai').disabled = false; v.currentTime = plan.segs[0].s; v.play().catch(() => {}); return; }
  } catch (e) { console.warn('fast export failed, using real time', e); fastBusy = false; busy = false; }
  realtimeExport();
};
async function exportFonts() {
  if (!document.fonts) return;
  const list = ['800 40px "Plus Jakarta Sans"', '600 40px "Plus Jakarta Sans"', '900 40px Montserrat', '400 40px Anton', 'italic 400 40px "Instrument Serif"',
    'italic 600 40px Fraunces', '800 40px Outfit', '600 40px Outfit', '600 40px "Inter Tight"', '800 40px "Inter Tight"', '700 40px Caveat', '600 40px "JetBrains Mono"'];
  ['fBase', 'fKey', 'fAccent'].forEach(id => { const f = val(id, 'auto'); if (f !== 'auto') list.push(fontOf(f, 40)); });
  const T = typo(); list.push(T.title(40), T.kicker(40), T.cap(40), fontOf(T.keyF, 40));
  await Promise.race([Promise.all(list.map(f => document.fonts.load(f).catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
}
async function realtimeExport() {
  await exportFonts();
  if (!window.MediaRecorder || !cv.captureStream) { msg('Tu navegador no permite exportar video. Probá con Chrome o Safari actualizado.'); $('#go').disabled = $('#ai').disabled = false; return; }
  busy = true;
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      dest = ac.createMediaStreamDestination();
      ac.createMediaElementSource(v).connect(dest);
      noiseBuf = makeNoise(ac);
    }
    await ac.resume();
  } catch (e) { console.warn(e); }
  const st = cv.captureStream(30);
  if (dest) dest.stream.getAudioTracks().forEach(t => st.addTrack(t));
  const mt = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const chunks = [];
  rec = new MediaRecorder(st, mt ? { mimeType: mt, videoBitsPerSecond: 7e6 } : {});
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    busy = false; $('#go').disabled = $('#ai').disabled = false; v.muted = true; v.loop = true;
    const type = rec.mimeType || mt || 'video/webm';
    if (!chunks.reduce((n, c) => n + c.size, 0)) { msg('No se pudo leer este video en tu navegador. Probá con Chrome o Safari, o con otro formato.'); return; }
    deliver(new Blob(chunks, { type }), type.includes('mp4') ? 'mp4' : 'webm');
    v.currentTime = plan.segs[0].s; v.play().catch(() => {});
  };
  v.pause(); v.muted = false; v.loop = false; lastSeg = lastChunk = -1; fired.clear();
  v.currentTime = plan.segs[0].s;
  await new Promise(r => { v.onseeked = () => { v.onseeked = null; r(); }; setTimeout(r, 1500); });
  rec.start(500);
  msg('Exportando en tiempo real (este formato no permite el modo rápido). Dejá esta pestaña abierta.');
  try { await v.play(); } catch (e) { finish(); msg('No se pudo reproducir el video. Probá con un MP4.'); }
}
function finish() { v.pause(); if (rec && rec.state === 'recording') rec.stop(); }
v.onended = () => { if (busy) finish(); else if (plan) { v.currentTime = plan.segs[0].s; v.play().catch(() => {}); } };
['lang', 'task', 'quality'].forEach(id => { $('#' + id).onchange = () => { if (file) runAI(); }; });
if (document.fonts) ['800 40px "Plus Jakarta Sans"', '600 22px "Plus Jakarta Sans"', '800 40px Outfit', '600 40px Outfit', '900 40px Montserrat', 'italic 700 40px "Playfair Display"', '400 40px Anton', 'italic 400 40px "Instrument Serif"'].forEach(f => document.fonts.load(f).catch(() => {}));
if (!matchMedia('(pointer: coarse)').matches) $('#quality').value = 'small';

// ---------- Bridge for the page UI ----------
const SAMPLE = 'Lo que nadie te dice sobre crecer en redes'.split(' ').map((t, i) => ({ t, s: i * .2, e: i * .2 + .18 }));
window.VE = {
  load, build, video: v,
  setHook(t) { aiHookTitle = t; build(); },
  setTypo(k) { if (TYPO[k]) { aiTypo = k; dirty = true; } },
  setRecipe(k) { if (RECIPES[k]) { aiRecipe = k; build(); } },
  get recipeKey() { return recipeKey(); },
  recipes: Object.fromEntries(Object.entries(RECIPES).map(([k, r]) => [k, { name: r.name, desc: r.desc }])),
  fontLib: FONT_LIB, fontOf, ensureFonts,
  // What the AI director gets to know about the video besides the words.
  get info() { const P = plan; if (!P) return {}; return { seconds: Math.round(P.total), words: words.length, cuts: P.segs.length - 1, wordsPerSecond: +(words.length / Math.max(1, P.total)).toFixed(2), longPauses: words.filter((w, i) => words[i + 1] && words[i + 1].s - w.e > .6).length, questions: words.filter(w => /\?$/.test(w.t)).length, numbers: words.filter(w => isNum(w.t)).length }; },
  addFont(n) { if (!FONT_BY.has(n)) { const f = [n, 'Mis fuentes', '', 400]; FONT_LIB.push(f); FONT_BY.set(n, f); fontLoaded.add(n); } dirty = true; },
  get typoFonts() { const T = typo(); return { base: T.cap(20), key: fontOf(T.keyF, 20), accent: T.kicker(20), keyName: T.keyF }; },
  get typoKey() { return typoKey(); },
  typos: Object.fromEntries(Object.entries(TYPO).map(([k, T]) => [k, { name: T.name, title: T.title(30), kicker: T.kicker(22), cap: T.cap(16), key: T.key, hi: T.hi }])),
  // Fix words the transcription got wrong (e.g. "desloqueas" → "desbloqueás"), keeping punctuation.
  fixWords(map) {
    const m = new Map(Object.entries(map || {}).map(([a, b]) => [norm(a), String(b)]).filter(([a, b]) => a && b && !/\s/.test(b)));
    let n = 0;
    words.forEach(w => { const r = m.get(norm(w.t)); if (r) { const p = w.t.match(/[.,;:!?¿¡]*$/)[0]; w.t = (/^[A-ZÁÉÍÓÚÑ]/.test(w.t) ? r[0].toUpperCase() + r.slice(1) : r) + p; n++; } });
    if (n) build();
  },
  get plan() { return plan; },
  // Draws a preview of a motion-graphics look ('mg') or an overlay style ('ov') into a small canvas.
  thumb(c, kind, key, i = 0) {
    const real = cx, el = document.getElementById(kind === 'ov' ? 'ovStyle' : 'mg'), prev = el.value;
    el.value = key; cx = c.getContext('2d');
    cx.save(); cx.clearRect(0, 0, c.width, c.height);
    try {
      if (kind === 'ov') {
        const s = c.width / W; cx.setTransform(s, 0, 0, s, 0, -H * .07 * s);
        const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3b2a4d'); g.addColorStop(1, '#16161c'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
        const fake = { overlays: [{ s: 0, e: 99, words: SAMPLE, key: SAMPLE[2], label: 'Dato clave' }] };
        drawOverlays(5, fake);
      } else {
        cx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
        if (i % 2) statScreen({ s: 0, e: 9, num: '30', unit: 'días', ctx: 'para crecer en redes' }, 3);
        else quoteScreen({ s: 0, e: 9, words: SAMPLE }, 3);
      }
    } catch (e) { console.warn(e); }
    cx.restore(); cx = real; el.value = prev;
  }
};
