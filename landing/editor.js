// Videora auto-editor: runs fully in the browser (no server, no cost).
// Whisper (transformers.js) transcribes with word timestamps, then a canvas
// renderer applies jump cuts, zooms, hook, animated captions and synthesized SFX.
const $ = q => document.querySelector(q);
const W = 720, H = 1280, MODELS = { base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped' };
const cv = $('#cv'), cx = cv.getContext('2d');
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
  viral: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 74, upper: true, hi: '#FFE14D' },
  hormozi: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 72, upper: true, hi: '#22E06B', box: true },
  editorial: { font: s => `italic 700 ${s}px "Playfair Display", Georgia, serif`, size: 66, upper: false, hi: '#FFD27A', soft: true },
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
  creamBg(t);
  const cardW = W * .92, cardH = 128, x0 = (W - cardW) / 2, top = 280;
  L.items.forEach((it, k) => {
    const lt = t - it.at, y = top + k * 156;
    // big number pop before the card lands
    if (lt > -.05 && lt < .75) {
      const a = back(lt / .28), o = lt > .5 ? 1 - ease((lt - .5) / .25) : 1, cy = y + cardH / 2 + 60;
      cx.save(); cx.globalAlpha = Math.max(0, o);
      for (let p = 0; p < 22; p++) {
        const ang = p * 2.4, dist = 60 + ease(lt / .6) * (90 + (p % 5) * 18);
        cx.fillStyle = p % 2 ? C.coral : C.grey; cx.globalAlpha = Math.max(0, o) * .6;
        cx.beginPath(); cx.arc(W / 2 + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 3 + (p % 3), 0, 7); cx.fill();
      }
      cx.globalAlpha = Math.max(0, o);
      cx.translate(W / 2, cy); cx.scale(a, a);
      const gg = cx.createLinearGradient(0, -80, 0, 80); gg.addColorStop(0, C.light); gg.addColorStop(1, C.dark);
      cx.shadowColor = 'rgba(206,44,26,.4)'; cx.shadowBlur = 30; cx.shadowOffsetY = 12;
      rrect(-80, -80, 160, 160, 36); cx.fillStyle = gg; cx.fill(); cx.shadowColor = 'transparent';
      cx.fillStyle = '#fff'; cx.font = '800 110px Outfit, Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(it.n, 0, 6);
      cx.restore();
    }
    const ct = lt - .4;
    if (ct < 0) return;
    const e = ease(ct / .5);
    cx.save(); cx.globalAlpha = Math.min(1, ct / .2); cx.translate(0, 90 * (1 - e)); blur(10 * (1 - e));
    cx.shadowColor = 'rgba(120,40,20,.14)'; cx.shadowBlur = 26; cx.shadowOffsetY = 8;
    rrect(x0, y, cardW, cardH, 26); cx.fillStyle = '#fff'; cx.fill(); cx.shadowColor = 'transparent';
    cx.lineWidth = 2; cx.strokeStyle = '#F0EAE2'; cx.stroke();
    const bg = cx.createLinearGradient(0, y + 22, 0, y + 96); bg.addColorStop(0, C.light); bg.addColorStop(1, C.dark);
    rrect(x0 + 22, y + 22, 74, 74, 18); cx.fillStyle = bg; cx.fill();
    cx.fillStyle = '#fff'; cx.font = '800 46px Outfit, Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(it.n, x0 + 59, y + 61);
    cx.textAlign = 'left';
    let fs = 38; cx.font = `800 ${fs}px "Plus Jakarta Sans", Inter, sans-serif`;
    while (cx.measureText(it.title.join(' ')).width > cardW - 190 && fs > 22) { fs -= 2; cx.font = `800 ${fs}px "Plus Jakarta Sans", Inter, sans-serif`; }
    let tx = x0 + 120; const ty = it.sub ? y + 46 : y + 60;
    it.title.forEach((w, i) => { cx.fillStyle = i === it.title.length - 1 && it.title.length > 1 ? C.coral : C.ink; cx.fillText(w, tx, ty); tx += cx.measureText(w + ' ').width; });
    if (it.sub) {
      const st = ease((ct - .25) / .4);
      cx.globalAlpha *= st; cx.font = '600 25px "Plus Jakarta Sans", Inter, sans-serif'; cx.fillStyle = C.grey;
      let sub = it.sub; while (cx.measureText(sub).width > cardW - 190 && sub.includes(' ')) sub = sub.slice(0, sub.lastIndexOf(' ')) + '…';
      cx.fillText(sub, x0 + 120, y + 84);
    }
    cx.strokeStyle = C.coral; cx.lineWidth = 4; cx.lineCap = 'round'; cx.globalAlpha = 1;
    cx.beginPath(); cx.moveTo(x0 + cardW - 58, y + 70); cx.lineTo(x0 + cardW - 46, y + 56); cx.lineTo(x0 + cardW - 38, y + 64); cx.lineTo(x0 + cardW - 26, y + 50); cx.stroke();
    blur(0); cx.restore();
  });
}
function ctaScreen(word, lt) {
  const g = cx.createRadialGradient(W / 2, H * .45, 20, W / 2, H * .45, H * .7);
  g.addColorStop(0, C.halo); g.addColorStop(1, C.night); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  const cy = H * .45, R = 190;
  cx.save(); cx.lineWidth = 16; cx.lineCap = 'round';
  cx.strokeStyle = 'rgba(240,70,48,.18)'; cx.beginPath(); cx.arc(W / 2, cy, R, 0, 7); cx.stroke();
  cx.shadowColor = '#F04630'; cx.shadowBlur = 30; cx.strokeStyle = '#F04630';
  const a0 = -Math.PI / 2 + lt * 2.2; cx.beginPath(); cx.arc(W / 2, cy, R, a0, a0 + Math.PI * (1.1 + .5 * Math.sin(lt * 2))); cx.stroke();
  cx.restore();
  const e = back(lt / .45);
  cx.save(); cx.translate(W / 2, cy); cx.scale(e, e); cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = '#fff'; cx.font = '600 44px Outfit, Inter, sans-serif'; cx.fillText('Comentá', 0, -56);
  let fs = 104; cx.font = `800 ${fs}px Outfit, Inter, sans-serif`;
  while (cx.measureText(word).width > R * 1.75 && fs > 40) { fs -= 6; cx.font = `800 ${fs}px Outfit, Inter, sans-serif`; }
  cx.lineWidth = 3; cx.strokeStyle = '#F04630'; cx.fillStyle = 'rgba(240,70,48,.18)'; cx.fillText(word, 0, 30); cx.strokeText(word, 0, 30);
  cx.restore();
  [[110, H * .72], [W - 120, H * .7], [W - 90, H * .3], [140, H * .25]].forEach(([x, y], i) => {
    const k = ease((lt - .2 - i * .12) / .4); if (k <= 0) return;
    cx.save(); cx.globalAlpha = k; cx.translate(x, y + Math.sin(lt * 1.5 + i) * 8); cx.scale(k, k);
    rrect(-26, -20, 52, 38, 12); cx.fillStyle = i % 2 ? '#fff' : '#F04630'; cx.fill();
    cx.beginPath(); cx.moveTo(-8, 18); cx.lineTo(-16, 30); cx.lineTo(4, 18); cx.fill();
    cx.fillStyle = i % 2 ? '#F04630' : '#fff'; [-12, 0, 12].forEach(dx => { cx.beginPath(); cx.arc(dx, -1, 3.5, 0, 7); cx.fill(); });
    cx.restore();
  });
  for (let i = 0; i < 6; i++) sparkle((i * 137) % W, (i * 311 + 90) % H, 6 + i % 3 * 2, 'rgba(240,70,48,.6)');
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
  let covered = false;
  if (P && coral && P.list) {
    const L = P.list;
    covered = screenWithBlobs(t, L.s, L.e, tt => listScreen(L, tt), 3, 'list');
    if (busy) L.items.forEach(it => { const kk = 'n' + it.n; if (t >= it.at && !fired.has(kk)) { fired.add(kk); sfx('pop'); } });
  }
  const ctaS = P ? P.total - 2.4 : 0;
  const inCta = P && coral && P.cta && ot >= ctaS - .35;
  if (P && !covered && !(inCta && ot >= ctaS)) drawCaption(ch, t);
  if (hookOn && P && P.hook && !covered) coral ? drawHookCard(P.hook, ot, P.hookDur) : drawHook(P.hook, ot);
  if (inCta) screenWithBlobs(ot, ctaS, 1e9, tt => ctaScreen(P.cta, tt - ctaS), 7, 'cta');
  if (P && !coral) { cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - 8, W, 8); cx.fillStyle = '#ec4899'; cx.fillRect(0, H - 8, W * ot / P.total, 8); }
  if (busy && P) prog(ot / P.total);
}
render();

// ---------- Sound effects (synthesized, no files) ----------
function sfx(type) {
  if (!ac || !dest || !on('optSfx')) return;
  const t0 = ac.currentTime, out = ac.createGain(); out.connect(dest);
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
  sfx('boom');
  msg('Exportando… tarda lo mismo que dura el video editado. Dejá esta pestaña abierta.');
  try { await v.play(); } catch (e) { finish(); msg('No se pudo reproducir el video. Probá con un MP4.'); }
};
function finish() { v.pause(); if (rec && rec.state === 'recording') rec.stop(); }
v.onended = () => { if (busy) finish(); else if (plan) { v.currentTime = plan.segs[0].s; v.play().catch(() => {}); } };
['lang', 'task', 'quality'].forEach(id => { $('#' + id).onchange = () => { if (file) runAI(); }; });
if (document.fonts) ['800 40px "Plus Jakarta Sans"', '600 22px "Plus Jakarta Sans"', '800 40px Outfit', '600 40px Outfit', '900 40px Montserrat', 'italic 700 40px "Playfair Display"'].forEach(f => document.fonts.load(f).catch(() => {}));
if (!matchMedia('(pointer: coarse)').matches) $('#quality').value = 'small';
