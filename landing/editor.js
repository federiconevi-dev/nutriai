// Videora auto-editor: runs fully in the browser (no server, no cost).
// Whisper (transformers.js) transcribes with word timestamps, then a canvas
// renderer applies jump cuts, zooms, hook, animated captions and synthesized SFX.
const $ = q => document.querySelector(q);
const W = 720, H = 1280, MODELS = { base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped' };
const cv = $('#cv');
let cx = cv.getContext('2d');
const v = document.createElement('video');
v.playsInline = true; v.muted = true; v.loop = true; v.setAttribute('playsinline', '');

let asrKey = '', file = null, words = [], speech = null, plan = null, asr = null, busy = false, aiRunning = false;
let ac = null, dest = null, noiseBuf = null, rec = null, lastSeg = -1, lastChunk = -1;

const msg = t => { $('#msg').textContent = t; };
const prog = p => { $('#prog').style.width = Math.max(0, Math.min(100, p * 100)) + '%'; };
const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const back = x => { x = Math.max(0, Math.min(1, x)); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const clean = s => s.replace(/[^\p{L}\p{N}]/gu, '');
const on = id => $('#' + id).checked;

// ---------- Upload ----------
function load(f) {
  if (!f) return;
  if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(f.name)) { msg('Ese archivo no es un video. Elegí un MP4, MOV o WEBM.'); $('#panel').hidden = false; return; }
  if (f.size > 1e9) { msg('El video pesa más de 1 GB. Probá con uno más corto.'); $('#panel').hidden = false; return; }
  file = f; words = []; plan = null; lastSeg = lastChunk = -1;
  v.src = URL.createObjectURL(f); v.load(); v.play().catch(() => {});
  $('#fname').textContent = '✓ ' + f.name;
  $('#panel').hidden = false; $('#phone').classList.add('has');
  $('#dl').hidden = true; $('#go').disabled = true; $('#txt').value = ''; prog(0);
  $('#phone').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
async function getAsr() {
  const key = $('#quality').value;
  if (asr && asrKey === key) return asr;
  asrKey = key;
  msg('Descargando el motor de subtítulos (solo la primera vez)…');
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  const files = {};
  asr = await pipeline('automatic-speech-recognition', MODELS[key] || MODELS.base, {
    dtype: 'q8', device: 'wasm',
    progress_callback: p => {
      if (p.status !== 'progress' || !p.total) return;
      files[p.file] = [p.loaded, p.total];
      const [a, b] = Object.values(files).reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);
      prog(a / b * .5);
      msg(`Descargando el motor de subtítulos… ${Math.round(a / 1e6)} de ${Math.round(b / 1e6)} MB (solo la primera vez)`);
    }
  });
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
  segs.forEach((g, i) => { g.o = acc; acc += g.e - g.s; g.z = i % 2 ? 1.14 : 1; g.fx = i % 2 ? .44 : .56; });

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
    hook = hw.map(w => w.t).join(' ').replace(/[.,;:]$/, '');
    hookDur = Math.min(6, Math.max(2.6, hw.at(-1).e - hw[0].s + 1.6));
  }
  plan = { segs, chunks, total: acc, hook, hookDur, list: findList(), cta: findCta() };
  plan.screens = findScreens(plan);
  plan.beats = makeBeats(plan);
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
  coral: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 46, upper: false, hi: '#FF6046', soft: true, coral: true },
  viral: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 52, upper: false, hi: '#FFE14D', soft: true },
  hormozi: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 72, upper: true, hi: '#22E06B', box: true },
  editorial: { font: s => SERIF(s), size: 70, upper: false, hi: '#E8D3A2', soft: true },
  minimal: { font: s => `700 ${s}px Inter, system-ui, sans-serif`, size: 52, upper: false, hi: '#ffffff', pill: true }
};
const C = { coral: '#F0452F', light: '#FF785C', dark: '#CE2C1A', cream: '#F4EFE6', row: '#F9F5EF', tint: '#FDE4DD', ink: '#181616', grey: '#928C86', night: '#34140E', halo: '#7A241A' };
const HAS_FILTER = 'filter' in cx;
const blur = px => { if (HAS_FILTER) cx.filter = px > .3 ? `blur(${px.toFixed(1)}px)` : 'none'; };
const isNum = s => /\d/.test(s);
const style = () => STYLES[$('#style').value] || STYLES.coral;

function wordsLayout(list, st) {
  const txt = w => st.upper ? w.t.toUpperCase() : w.t;
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

function drawCaption(ch, t) {
  if (!ch) return;
  const st = style();
  const L = wordsLayout(ch, st);
  const age = t - ch.s;
  const sc = st.soft ? 1 : .7 + .3 * back(age / .16);
  const alpha = st.soft ? ease(age / .22) : 1;
  const yOff = st.soft ? 16 * (1 - ease(age / .3)) : 0;
  cx.save();
  cx.translate(W / 2, H * .69 + yOff); cx.scale(sc, sc); cx.globalAlpha = alpha;
  if (st.coral) blur(8 * (1 - ease(age / .25)));
  cx.font = st.font(L.size); cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  const lh = L.size * 1.15, y0 = -(L.lines.length - 1) * lh / 2;
  L.lines.forEach(([a, b], li) => {
    const lw = L.width(a, b), y = y0 + li * lh;
    if (st.pill) { cx.fillStyle = 'rgba(0,0,0,.62)'; rrect(-lw / 2 - 26, y - L.size * .8, lw + 52, L.size * 1.6, 22); cx.fill(); }
    let x = -lw / 2;
    for (let i = a; i < b; i++) {
      const w = ch[i], active = t >= w.s && (i === ch.length - 1 || t < ch[i + 1].s), isKey = w === ch.key;
      const ww = L.ws[i], word = L.txt(w);
      cx.save(); cx.translate(x + ww / 2, y);
      if (active && !st.soft) cx.scale(1.06, 1.06);
      if (st.box && active) { cx.fillStyle = st.hi; rrect(-ww / 2 - 12, -L.size * .62, ww + 24, L.size * 1.24, 14); cx.fill(); }
      if (st.soft) { cx.shadowColor = 'rgba(0,0,0,.7)'; cx.shadowBlur = st.coral ? 14 : 18; cx.shadowOffsetY = st.coral ? 2 : 0; }
      else if (!st.pill) { cx.lineWidth = L.size * .2; cx.strokeStyle = '#000'; cx.strokeText(word, -ww / 2, 0); }
      cx.fillStyle = st.box ? '#fff' : st.coral ? ((isNum(word) || (isKey && ch.emph)) ? st.hi : '#fff') : (active || (st.soft && isKey)) ? st.hi : '#fff';
      if (st.pill) cx.fillStyle = active ? '#fff' : 'rgba(255,255,255,.55)';
      cx.fillText(word, -ww / 2, 0);
      cx.restore();
      x += ww + L.sp;
    }
  });
  blur(0);
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
  const cardW = W * .92, cardH = 128, x0 = (W - cardW) / 2, top = 280;
  L.items.forEach((it, k) => {
    const lt = t - it.at, y = top + k * 156;
    // big number pop before the card lands
    if (lt > -.05 && lt < .75) {
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
    while (cx.measureText(it.title.join(' ')).width > cardW - 190 && fs > 22) { fs -= 2; cx.font = `800 ${fs}px "Plus Jakarta Sans", Inter, sans-serif`; }
    let tx = x0 + 120; const ty = it.sub ? y + 46 : y + 60;
    it.title.forEach((w, i) => { cx.fillStyle = i === it.title.length - 1 && it.title.length > 1 ? TH.accent : TH.ink; cx.fillText(w, tx, ty); tx += cx.measureText(w + ' ').width; });
    if (it.sub) {
      const st = ease((ct - .25) / .4);
      cx.globalAlpha *= st; cx.font = '600 25px "Plus Jakarta Sans", Inter, sans-serif'; cx.fillStyle = TH.sub;
      let sub = it.sub; while (cx.measureText(sub).width > cardW - 190 && sub.includes(' ')) sub = sub.slice(0, sub.lastIndexOf(' ')) + '…';
      cx.fillText(sub, x0 + 120, y + 84);
    }
    cx.strokeStyle = TH.accent; cx.lineWidth = 4; cx.lineCap = 'round'; cx.globalAlpha = 1;
    cx.beginPath(); cx.moveTo(x0 + cardW - 58, y + 70); cx.lineTo(x0 + cardW - 46, y + 56); cx.lineTo(x0 + cardW - 38, y + 64); cx.lineTo(x0 + cardW - 26, y + 50); cx.stroke();
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
function updateMask() {
  if (!seg) return false;
  try {
    segTs = Math.max(segTs + 1, performance.now());
    const r = seg.segmentForVideo(v, segTs), m = r.confidenceMasks && r.confidenceMasks[0];
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
function drawPerson(x, y, w, h) {
  pcx.globalCompositeOperation = 'source-over'; pcx.clearRect(0, 0, W, H);
  pcx.drawImage(v, x, y, w, h);
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
function fetchPhoto(q) {
  if (photoCache.has(q)) return photoCache.get(q);
  const p = (async () => {
    const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=6&mature=false`);
    if (!r.ok) return null;
    const res = (await r.json()).results || [];
    for (const it of res) {
      try {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.src = `https://api.openverse.org/v1/images/${it.id}/thumb/`;
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
  if (P.list) busyRanges.push([P.list.s - .5, P.list.e + .5]);
  (P.screens || []).forEach(sc => busyRanges.push([sc.s - .5, sc.e + .5]));
  const free = (s, e) => !busyRanges.some(([a, b]) => s < b && e > a);
  // Visual hook: the strongest 1-2 words of the first sentence, giant, behind you.
  if (on('optBig') || on('optHook')) {
    const hw = []; for (const w of words) { hw.push(w); if (hw.length >= 8 || /[.!?]$/.test(w.t)) break; }
    let k = hw.findIndex(w => isNum(w.t));
    if (k < 0) k = hw.reduce((b, w, i) => clean(w.t).length > clean(hw[b].t).length ? i : b, 0);
    const pick = hw.slice(k, k + (isNum(hw[k].t) && hw[k + 1] ? 2 : 1));
    const text = pick.map(w => clean(w.t)).join(' ').toUpperCase();
    const small = hw.filter(w => !pick.includes(w)).slice(0, 5).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ').toLowerCase();
    if (text) { B.big.push({ s: words[0].s, e: Math.max(words[0].s + 1.8, pick.at(-1).e + .6), text, small, hook: true, n: 0 }); busyRanges.push([words[0].s, B.big[0].e]); }
  }
  if (on('optBig')) {
    let last = B.big.length ? B.big[0].e : -9;
    P.chunks.forEach(c => {
      const k = c.key, txt = clean(k.t);
      if (!(c.emph && (isNum(k.t) || txt.length >= 6)) || k.s - last < 3.4) return;
      const e = Math.max(k.e + .7, k.s + 1.3);
      if (!free(k.s - .1, e)) return;
      const small = c.filter(w => w !== k).slice(0, 3).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ').toLowerCase();
      B.big.push({ s: k.s - .05, e, text: txt.toUpperCase(), small, n: B.big.length });
      busyRanges.push([k.s - .1, e]); last = e;
    });
  }
  if (on('optPhotos')) {
    let last = 1.5, ui = 0;
    words.forEach((w, i) => {
      const n = norm(w.t);
      if (n.length < 5 || STOPW.has(n) || w.s - last < 4.5 || !free(w.s, w.s + 2)) return;
      const ph = { s: w.s, e: w.s + 2, q: n, img: null, n: B.photos.length };
      if (ui < userPhotos.length) ph.img = userPhotos[ui++];
      else fetchPhoto(n).then(img => { ph.img = img; });
      B.photos.push(ph); busyRanges.push([ph.s, ph.e]); last = ph.e;
    });
  }
  if (on('optEmoji')) P.chunks.forEach((c, i) => {
    for (const w of c) { const n = norm(w.t); const hit = EMO.find(([re]) => re.test(n)); if (hit) { B.emoji.set(i, hit[1]); break; } }
  });
  return B;
}

// ---- Drawing ----
function bigFont(size, coral) { return coral ? `800 ${size}px Outfit, Inter, sans-serif` : ANTON(size); }
function bigLayout(b, coral) {
  let size = coral ? 250 : 330; cx.font = bigFont(size, coral);
  while (cx.measureText(b.text).width > W * .92 && size > 90) { size -= 10; cx.font = bigFont(size, coral); }
  return size;
}
// Back layer: giant word (behind the person when the cutout is available).
function drawBig(b, t, coral) {
  const age = t - b.s, left = b.e - t, outK = left < .25 ? ease(1 - left / .25) : 0;
  let text = b.text;
  const first = text.split(' ')[0], num = /^\d+$/.test(first) ? +first : null;
  if (num !== null && num > 1 && num < 100000) text = [Math.round(num * ease(age / .6)), ...text.split(' ').slice(1)].join(' ');
  const size = bigLayout(b, coral);
  const mode = b.hook ? 'slam' : ['slam', 'track', 'rise', 'outline'][b.n % 4];
  const fill = coral && b.n % 2 ? '#F0452F' : '#ffffff';
  cx.save();
  cx.translate(W / 2, H * .19);
  cx.globalAlpha = 1 - outK; cx.scale(1 + outK * .12, 1 + outK * .12);
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.shadowColor = 'rgba(0,0,0,.3)'; cx.shadowBlur = 40;
  if (mode === 'slam') {
    const k = back(age / .3), sh = age > .28 && age < .45 ? (Math.random() - .5) * 16 : 0;
    cx.scale(1.7 - .7 * k, 1.7 - .7 * k); cx.translate(sh, sh * .5); blur(14 * (1 - ease(age / .25)));
    cx.fillStyle = fill; cx.fillText(text, 0, 0);
  } else if (mode === 'track') {
    const k = ease(age / .7), sp = size * (.45 - .43 * k), letters = [...text];
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
  let fs = Math.max(56, size * .42); cx.font = SERIF(fs);
  while (cx.measureText(b.small).width > W * .86 && fs > 36) { fs -= 4; cx.font = SERIF(fs); }
  const k = ease(age / .45), tw = cx.measureText(b.small).width;
  cx.save();
  cx.translate(W / 2 + W * .05, H * .19 + size * .36 - 10 * (1 - k)); cx.rotate(-.07);
  cx.globalAlpha = 1 - outK; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.beginPath(); cx.rect(-tw / 2 - 20, -fs, (tw + 40) * k, fs * 2); cx.clip();
  cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 18; cx.shadowOffsetY = 3;
  cx.fillStyle = coral ? '#FFD9CF' : TH.accent === '#2563EB' ? '#FFE14D' : TH.accent;
  cx.fillText(b.small, 0, 0);
  cx.restore();
}
function coverDraw(img, alpha, zoom, dx) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih) * zoom, w = iw * s, h = ih * s;
  cx.globalAlpha = alpha; cx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h); cx.globalAlpha = 1;
}
function drawPhoto(ph, t, coral) {
  if (!ph.img) return false;
  const age = t - ph.s, left = ph.e - t, k = Math.min(ease(age / .35), ease(left / .35));
  if (ph.n % 2 === 0) {
    // Double exposure: photo semi-transparent over the whole frame, you stay on top (if cutout available)
    blur(8 * (1 - k)); coverDraw(ph.img, .55 * k, 1.05 + .1 * (age / 2), -20 + 40 * (age / 2)); blur(0);
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(0,0,0,${.25 * k})`); g.addColorStop(.6, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    return true;
  }
  // Floating card: tilted photo that slides in, slightly transparent
  const iw = ph.img.naturalWidth, ih = ph.img.naturalHeight, cw = W * .62, chh = Math.min(H * .32, cw * ih / iw);
  cx.save();
  cx.translate(W / 2 + 160 * (1 - k) * (ph.n % 4 === 1 ? -1 : 1), H * .26); cx.rotate((ph.n % 4 === 1 ? -1 : 1) * (.06 + .03 * (1 - k)));
  cx.scale(.85 + .15 * back(age / .4), .85 + .15 * back(age / .4)); cx.globalAlpha = .92 * k;
  cx.shadowColor = 'rgba(0,0,0,.4)'; cx.shadowBlur = 40; cx.shadowOffsetY = 16;
  rrect(-cw / 2 - 12, -chh / 2 - 12, cw + 24, chh + 24, 22); cx.fillStyle = coral ? '#F4EFE6' : '#fff'; cx.fill(); cx.shadowColor = 'transparent';
  cx.save(); rrect(-cw / 2, -chh / 2, cw, chh, 14); cx.clip();
  const s = Math.max(cw / iw, chh / ih) * (1.05 + .08 * age / 2); cx.drawImage(ph.img, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
  cx.restore(); cx.restore();
  return false;
}
function drawEmoji(ci, ch, t) {
  const e = plan && plan.beats && plan.beats.emoji.get(ci);
  if (!e || !ch) return;
  const age = t - ch.s, k = back(age / .3);
  cx.save(); cx.translate(W / 2, H * .6 - 10 * Math.sin(age * 5) * Math.exp(-age * 2));
  cx.rotate(.25 * Math.sin(age * 8) * Math.exp(-age * 3)); cx.scale(k, k);
  cx.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(e, 0, 0); cx.restore();
}
function lightLeak(k, seed) {
  if (k <= 0 || k >= 1) return;
  const a = Math.sin(k * Math.PI);
  cx.save(); cx.globalCompositeOperation = 'screen';
  const x = W * (-.2 + 1.4 * k), y = H * (.2 + .3 * Math.sin(seed));
  const g = cx.createRadialGradient(x, y, 10, x, y, H * .6);
  g.addColorStop(0, `rgba(255,170,90,${.75 * a})`); g.addColorStop(.4, `rgba(255,80,120,${.35 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
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
  cx.drawImage(cv, -10 * (1 - k), 0); cx.fillStyle = 'rgba(255,0,60,.25)'; cx.fillRect(0, 0, W, H);
  cx.globalCompositeOperation = 'source-over'; cx.restore();
}

// Called right after the video frame is drawn. Returns { hide } to hide captions while a giant word is on screen.
function fxLayer(t, ot, P, x, y, w, h, coral) {
  const B = P.beats; if (!B) return { hide: false };
  const big = B.big.find(b => t >= b.s && t <= b.e);
  const photo = B.photos.find(p => t >= p.s && t <= p.e && p.img);
  let doubleExp = false;
  if (photo) doubleExp = drawPhoto(photo, t, coral);
  if (big) drawBig(big, t, coral);
  if ((big || doubleExp) && on('optBig')) { if (!seg) loadSeg(); else if (updateMask()) drawPerson(x, y, w, h); }
  if (big) drawBigSmall(big, t, coral);
  if (busy) {
    const nb = B.big.find(b => !b.hook && t >= b.s - .55 && t < b.s);
    if (nb && on('optFx') && !fired.has('r' + nb.s)) { fired.add('r' + nb.s); sfx('riser'); }
    if (big && !fired.has('b' + big.s)) { fired.add('b' + big.s); sfx(big.hook ? 'impact' : 'hit'); }
    if (photo && !fired.has('p' + photo.s)) { fired.add('p' + photo.s); sfx(photo.n % 2 ? 'shutter' : 'whoosh'); }
  }
  return { hide: !!big, photoCard: photo && !doubleExp };
}
// Called last: transitions on top of everything.
function fxTop(t, ot, P, si) {
  if (!on('optFx')) return;
  if (on('optHook') && ot < .3) glitch(ot / .3);
  const g = si >= 0 ? P.segs[si] : null;
  if (g && si > 0 && si % 3 === 0 && t - g.s < .15) glitch((t - g.s) / .15);
  const B = P.beats; if (!B) return;
  for (const b of B.big) if (t >= b.s && t < b.s + .7) lightLeak((t - b.s) / .7, b.s);
  if (ot < .9) lightLeak(ot / .9, 1);
}
function whip(t, si, P) {
  if (!on('optFx') || si < 1) return 1;
  const g = P.segs[si];
  return si % 3 === 1 && t - g.s < .2 ? 1 + .22 * (1 - ease((t - g.s) / .2)) : 1;
}
// Extra synthesized sound hooks
function sfxExtra(type, t0) {
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
['optBig', 'optPhotos', 'optEmoji'].forEach(id => { document.getElementById(id).onchange = () => { if (id === 'optBig' && on('optBig')) loadSeg(); build(); }; });


// ================= Themes: each editing type has its own screens, transitions and music =================
const THEMES = {
  coral: { a1: '#FF785C', a2: '#CE2C1A', onA: '#fff', accent: '#F0452F', soft: 'rgba(240,70,48,.18)', ink: '#181616', sub: '#928C86', card: '#fff', line: '#F0EAE2', halo: '#7A241A', night: '#34140E', ctaInk: '#fff', trans: 'blob', music: 'lofi' },
  dark: { a1: '#FFE14D', a2: '#F59E0B', onA: '#111', accent: '#FFE14D', soft: 'rgba(255,225,77,.15)', ink: '#ffffff', sub: '#A1A1B5', card: 'rgba(255,255,255,.08)', line: 'rgba(255,255,255,.16)', halo: '#3b1d6e', night: '#07070b', ctaInk: '#fff', trans: 'zoom', music: 'trap' },
  cine: { a1: '#E8D3A2', a2: '#B08D57', onA: '#14110d', accent: '#E8D3A2', soft: 'rgba(232,211,162,.15)', ink: '#F5F0E6', sub: '#9C9488', card: 'rgba(0,0,0,.45)', line: 'rgba(232,211,162,.25)', halo: '#2a2420', night: '#0a0908', ctaInk: '#F5F0E6', trans: 'fade', music: 'cine' },
  clean: { a1: '#4F8BFF', a2: '#1D4ED8', onA: '#fff', accent: '#2563EB', soft: 'rgba(37,99,235,.12)', ink: '#0f172a', sub: '#64748b', card: '#fff', line: '#e2e8f0', halo: '#dbeafe', night: '#f8fafc', ctaInk: '#0f172a', trans: 'slide', music: 'lofi' }
};
const THEME_OF = { coral: 'coral', viral: 'dark', hormozi: 'dark', editorial: 'cine', minimal: 'clean' };
const theme = () => THEMES[THEME_OF[$('#style').value] || 'coral'];
const SERIF = s => `italic 400 ${s}px "Instrument Serif", "Playfair Display", Georgia, serif`;
const ANTON = s => `400 ${s}px Anton, Impact, "Arial Narrow", sans-serif`;

function screenBg(t) {
  const TH = theme(), k = THEME_OF[$('#style').value] || 'coral';
  if (k === 'coral') return creamBg(t);
  if (k === 'dark') {
    const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07070b'); g.addColorStop(1, '#1a0f2e'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.strokeStyle = 'rgba(168,85,247,.25)'; cx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const y = H * .62 + Math.pow((i + (t * .8) % 1) / 14, 2) * H * .5; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
    for (let i = -8; i <= 8; i++) { cx.beginPath(); cx.moveTo(W / 2 + i * 30, H * .62); cx.lineTo(W / 2 + i * 160, H); cx.stroke(); }
    cx.restore();
    [[W * .2, H * .2, '#a855f7'], [W * .85, H * .45, '#ec4899'], [W * .5, H * .85, TH.accent]].forEach(([x, y, c], i) => {
      const r = 220 + 30 * Math.sin(t + i), gr = cx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + '55'); gr.addColorStop(1, c + '00');
      cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    });
    for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 211.7 + t * 20 * (1 + i % 3)) % H; cx.fillStyle = `rgba(255,255,255,${.15 + .4 * Math.abs(Math.sin(t * 2 + i))})`; cx.fillRect(x, y, 2, 2); }
    return;
  }
  if (k === 'cine') {
    cx.fillStyle = TH.night; cx.fillRect(0, 0, W, H);
    const g = cx.createRadialGradient(W / 2, H * .45, 10, W / 2, H * .45, H * .6); g.addColorStop(0, 'rgba(176,141,87,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { cx.fillStyle = `rgba(255,240,220,${Math.random() * .06})`; cx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
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
  const ws = sc.words, key = ws.reduce((a, w) => (KEYQ.test(norm(w.t)) ? w : clean(w.t).length > clean(a.t).length && !KEYQ.test(norm(a.t)) ? w : a), ws[0]);
  const size = 58, items = ws.map(w => ({ w, k: w === key, f: w === key ? SERIF(size * 1.45) : `800 ${size}px "Plus Jakarta Sans", Inter, sans-serif` }));
  const lines = [[]]; let lw = 0;
  items.forEach(it => { cx.font = it.f; it.wd = cx.measureText(it.w.t).width; if (lw + it.wd > W * .8 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push(it); lw += it.wd + 16; });
  cx.save(); cx.globalAlpha = .18; cx.fillStyle = TH.accent; cx.font = SERIF(320); cx.textBaseline = 'top'; cx.fillText('“', 40, H * .12); cx.restore();
  const lh = size * 1.5, y0 = H * .45 - (lines.length - 1) * lh / 2;
  cx.textBaseline = 'middle';
  lines.forEach((l, li) => {
    const tw = l.reduce((a, it) => a + it.wd, 0) + 16 * (l.length - 1); let x = (W - tw) / 2;
    l.forEach(it => {
      const a = ease((t - it.w.s + .05) / .25);
      if (a > 0) { cx.save(); cx.globalAlpha = a; blur(6 * (1 - a)); cx.font = it.f; cx.fillStyle = it.k ? TH.accent : TH.ink; cx.fillText(it.w.t, x, y0 + li * lh + 14 * (1 - a)); blur(0); cx.restore(); }
      x += it.wd + 16;
    });
  });
}


function render() {
  requestAnimationFrame(render);
  if (v.readyState < 2 || !v.videoWidth || v.seeking) return;
  const P = plan, t = v.currentTime;
  let si = -1;
  if (P) {
    si = P.segs.findIndex(g => t >= g.s - .06 && t < g.e + .02);
    if (si < 0 || t >= P.segs[si].e) {
      const next = P.segs.findIndex(g => g.s > t - .02);
      if (next >= 0 && (si < 0 || next > si)) { v.currentTime = P.segs[next].s; return; }
      if (busy) { finish(); return; }
      v.currentTime = P.segs[0].s; lastSeg = lastChunk = -1; fired.clear(); return;
    }
  }
  const g = si >= 0 ? P.segs[si] : null;
  const ot = g ? g.o + (t - g.s) : t;
  const st = style(), coral = !!st.coral;
  const hookOn = P && on('optHook');
  const ci = P ? P.chunks.findIndex(c => t >= c.s - .02 && t <= c.e + .2) : -1;
  const ch = ci >= 0 ? P.chunks[ci] : null;
  if (ot < .1) fired.clear();

  if (busy && si !== lastSeg) { if (lastSeg >= 0 && si % 2 === 1 && !coral) sfx('whoosh'); lastSeg = si; }
  if (busy && ci !== lastChunk) { if (ci >= 0 && ch.emph) sfx('pop'); lastChunk = ci; }

  let z = g ? (coral ? 1 + (g.z - 1) * .55 : g.z) : 1;
  if (hookOn && !coral && ot < .7) z *= 1 + .35 * (1 - ease(ot / .7));
  if (hookOn && coral && ot < .9) z *= 1 + .1 * (1 - ease(ot / .9));
  if (ch && ch.emph) z *= 1 + (coral ? .04 : .08) * ease((t - ch.s) / .22);
  if (P) z *= whip(t, si, P);
  z *= 1 + .025 * Math.sin(ot * .7) + (coral ? .03 * (ot / Math.max(1, P ? P.total : 1)) : 0);
  let sx = 0, sy = 0;
  if (!coral && ch && ch.emph && t - ch.s < .16) { sx = (Math.random() - .5) * 14; sy = (Math.random() - .5) * 14; }

  const s = Math.max(W / v.videoWidth, H / v.videoHeight) * z, w = v.videoWidth * s, h = v.videoHeight * s;
  const fx = g ? g.fx : .5;
  const x = Math.min(0, Math.max(W - w, W / 2 - w * fx)) + sx, y = Math.min(0, Math.max(H - h, H * .42 - h * .42)) + sy;
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
  cx.drawImage(v, x, y, w, h);

  if (!coral) {
    const gr = cx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
    cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
    if (hookOn && ot < .22) { cx.fillStyle = `rgba(255,255,255,${.9 * (1 - ot / .22)})`; cx.fillRect(0, 0, W, H); }
  }
  const fxs = P ? fxLayer(t, ot, P, x, y, w, h, coral) : { hide: false };
  let covered = false;
  if (P && P.list) {
    const L = P.list;
    covered = screenTrans(t, L.s, L.e, tt => listScreen(L, tt), 3, 'list');
    if (busy) L.items.forEach(it => { const kk = 'n' + it.n; if (t >= it.at && !fired.has(kk)) { fired.add(kk); sfx('pop'); } });
  }
  if (P && P.screens) P.screens.forEach((sc, i) => {
    if (t < sc.s - .4 || t > sc.e + .4) return;
    if (screenTrans(t, sc.s, sc.e, tt => sc.type === 'stat' ? statScreen(sc, tt) : quoteScreen(sc, tt), 11 + i, 'sc' + sc.s)) covered = true;
    if (busy && sc.type === 'stat' && t >= sc.s + .4 && !fired.has('d' + sc.s)) { fired.add('d' + sc.s); sfx('ding'); }
  });
  const ctaS = P ? P.total - 2.4 : 0;
  const inCta = P && P.cta && ot >= ctaS - .35;
  if (P && !covered && !fxs.hide && !(inCta && ot >= ctaS)) { drawCaption(ch, t); drawEmoji(ci, ch, t); }
  if (hookOn && P && P.hook && !covered) { if (coral) drawHookCard(P.hook, ot, P.hookDur); }
  if (inCta) screenTrans(ot, ctaS, 1e9, tt => ctaScreen(P.cta, tt - ctaS), 7, 'cta');
  if (P && !coral) { cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - 8, W, 8); cx.fillStyle = '#ec4899'; cx.fillRect(0, H - 8, W * ot / P.total, 8); }
  if (P && !covered) fxTop(t, ot, P, si);
  if (busy && P) prog(ot / P.total);
}
render();

// ---------- Sound effects (synthesized, no files) ----------
function sfx(type) {
  if (!ac || !dest || !on('optSfx')) return;
  const t0 = ac.currentTime;
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

// ---------- Export ----------
$('#go').onclick = async () => {
  if (busy || !plan) return;
  if (!window.MediaRecorder || !cv.captureStream) { msg('Tu navegador no permite exportar video. Probá con Chrome o Safari actualizado.'); return; }
  busy = true; $('#go').disabled = $('#ai').disabled = true; $('#dl').hidden = true;
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      dest = ac.createMediaStreamDestination();
      ac.createMediaElementSource(v).connect(dest);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
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
    const ext = type.includes('mp4') ? 'mp4' : 'webm', a = $('#dl');
    a.href = URL.createObjectURL(new Blob(chunks, { type })); a.download = 'videora-editado.' + ext; a.hidden = false;
    prog(1); msg(`¡Listo! Tocá Descargar para guardar tu video (${ext.toUpperCase()}).`);
    v.currentTime = plan.segs[0].s; v.play().catch(() => {});
  };
  v.pause(); v.muted = false; v.loop = false; lastSeg = lastChunk = -1;
  v.currentTime = plan.segs[0].s;
  await new Promise(r => { v.onseeked = () => { v.onseeked = null; r(); }; setTimeout(r, 1500); });
  rec.start(500);
  if (!(plan.beats && plan.beats.big.some(b => b.hook))) sfx('boom');
  msg('Exportando… tarda lo mismo que dura el video editado. Dejá esta pestaña abierta.');
  try { await v.play(); } catch (e) { finish(); msg('No se pudo reproducir el video. Probá con un MP4.'); }
};
function finish() { v.pause(); if (rec && rec.state === 'recording') rec.stop(); }
v.onended = () => { if (busy) finish(); else if (plan) { v.currentTime = plan.segs[0].s; v.play().catch(() => {}); } };
['lang', 'task', 'quality'].forEach(id => { $('#' + id).onchange = () => { if (file) runAI(); }; });
if (document.fonts) ['800 40px "Plus Jakarta Sans"', '600 22px "Plus Jakarta Sans"', '800 40px Outfit', '600 40px Outfit', '900 40px Montserrat', 'italic 700 40px "Playfair Display"', '400 40px Anton', 'italic 400 40px "Instrument Serif"'].forEach(f => document.fonts.load(f).catch(() => {}));
if (!matchMedia('(pointer: coarse)').matches) $('#quality').value = 'small';
