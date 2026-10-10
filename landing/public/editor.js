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
  file = f; words = []; plan = null; lastSeg = lastChunk = -1; aiHookTitle = ''; brollPicks = []; brollFor = null;
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
  viral: { font: s => `800 ${s}px "Plus Jakarta Sans", Inter, sans-serif`, size: 56, upper: false, hi: '#A6F94B', soft: true, glowKey: true },
  hormozi: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 64, upper: true, hi: '#22E06B', box: true },
  editorial: { font: s => SERIF(s), size: 82, upper: false, hi: '#E8D3A2', soft: true },
  minimal: { font: s => `600 ${s}px "Inter Tight", Inter, system-ui, sans-serif`, size: 52, upper: false, hi: '#ffffff', pill: true }
};
const C = { coral: '#F0452F', light: '#FF785C', dark: '#CE2C1A', cream: '#F4EFE6', row: '#F9F5EF', tint: '#FDE4DD', ink: '#181616', grey: '#928C86', night: '#34140E', halo: '#7A241A' };
const HAS_FILTER = 'filter' in cx;
const blur = px => { if (HAS_FILTER) cx.filter = px > .3 ? `blur(${px.toFixed(1)}px)` : 'none'; };
const isNum = s => /\d/.test(s);
const style = () => {
  const st = fontOverride(STYLES[$('#style').value] || STYLES.viral);
  const k = val('cKey', 'auto'), b = val('cBase', 'auto');
  const th = THEMES[themeKey()];
  return { ...st, size: st.size * +val('sBase', 1), hi: k !== 'auto' ? k : st.pill ? st.hi : th.accent, glowC: th.glow || th.accent, base: b === 'auto' ? '#fff' : b };
};

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

let capX = W / 2, capY = H * .69;
function drawCaption(ch, t) {
  if (!ch) return;
  const st = style();
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
let aiDown = false, aiFails = 0, aiQuotaWarned = false;
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
  const dur = words.at(-1).e - words[0].s, max = Math.max(1, Math.min(6, Math.round(dur / 8)));
  try {
    const r = await fetch('/api/ai-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'broll', max, text: key, subjects: se.map(x => x.map(w => w.t).join(' ')) }) });
    if (!r.ok) throw new Error('broll ' + r.status);
    const j = await r.json();
    brollPicks = (j.picks || []).filter(pk => se[pk.i]).map(pk => ({ s: se[pk.i][0].s, e: se[pk.i].at(-1).e + .3, prompt: pk.prompt, label: pk.label || se[pk.i].slice(0, 5).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ') }));
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
  const prompt = `${promptCache.get(subject) || subject}, ${AI_LOOK}, no text, no letters`;
  if (aiCache.has(prompt)) return aiCache.get(prompt);
  const job = (async () => {
    if (aiDown) return null;
    await aiSlot();
    try {
      const r = await fetch(`/api/ai-image?p=${encodeURIComponent(prompt)}`);
      if (r.status === 503 || r.status === 404) { aiDown = true; return null; }      // not configured
      if (r.status === 429) { aiDown = true; if (!aiQuotaWarned) { aiQuotaWarned = true; msg('Se terminó el cupo gratis de imágenes IA de hoy (se renueva a las 21 h de Argentina). El resto de la edición sigue igual.'); } return null; }
      if (!r.ok) { aiCache.delete(prompt); return null; }                            // one refused image: just skip it
      const img = new Image(); img.src = URL.createObjectURL(await r.blob()); await img.decode();
      return img;
    } catch (e) { if (++aiFails >= 5) aiDown = true; aiCache.delete(prompt); return null; }
    finally { aiFree(); }
  })();
  aiCache.set(prompt, job); aiPending.add(job); job.finally(() => aiPending.delete(job));
  return job;
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
  await Promise.all(items.map(x => aiImage(x.subj).then(img => { if (img) { x.o.img = img; dirty = true; } })));
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
    const small = aiHookTitle ? aiHookTitle.toLowerCase() : hw.filter(w => !pick.includes(w)).slice(0, 5).map(w => w.t.replace(/[.,;:!?]+$/, '')).join(' ').toLowerCase();
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
      const ph = { s: s0, e: e0, q: pk.prompt, subj: pk.prompt, label: pk.label, img: null, n: B.photos.length };
      if (ui < userPhotos.length) { ph.img = userPhotos[ui++]; ph.user = true; }
      B.photos.push(ph); busyRanges.push([s0, e0]);
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
  if (f !== 'auto') return `${/Anton|Bebas|Archivo Black|Permanent/.test(f) ? 400 : 900} ${size}px "${f}", Impact, sans-serif`;
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
  let fs = Math.max(56, size * .42) * +val('sAccent', 1); cx.font = SERIF(fs);
  while (cx.measureText(b.small).width > W * .84 && fs > 30) { fs -= 4; cx.font = SERIF(fs); }
  const k = ease(age / .45), tw = cx.measureText(b.small).width;
  cx.save();
  const cxp = Math.min(W - 24 - tw / 2, Math.max(24 + tw / 2, W / 2 + W * .05));
  cx.translate(cxp, (b.hook && galleryOn ? H * .6 : H * .19) + size * .36 - 10 * (1 - k)); cx.rotate(-.05);
  cx.globalAlpha = 1 - outK; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.beginPath(); cx.rect(-tw / 2 - 20, -fs, (tw + 40) * k, fs * 2); cx.clip();
  cx.shadowColor = 'rgba(0,0,0,.85)'; cx.shadowBlur = 26; cx.shadowOffsetY = 2;
  cx.fillStyle = coral ? '#FFD9CF' : TH.accent === '#2563EB' ? '#FFE14D' : TH.accent;
  cx.fillText(b.small, 0, 0);
  cx.restore();
}
function coverDraw(img, alpha, zoom, dx) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih) * zoom, w = iw * s, h = ih * s;
  cx.globalAlpha = alpha; cx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h); cx.globalAlpha = 1;
}
// B-roll: the whole image as a card in the top third while you stay on screen (like viral "visual hook" edits).
function photoCard(img, x, y, maxW, maxH, rot, k, age, cover) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
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
  if (!ph.img) return false;
  const age = t - ph.s, left = ph.e - t, k = Math.min(ease(age / .3), ease(left / .3));
  if (val('brollLayout', 'split') === 'full') { cx.save(); cx.globalAlpha = k; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); coverDraw(ph.img, k, 1.03 + .03 * age, 0); cx.restore(); }
  else photoCard(ph.img, W / 2, H * .2, W * .8, H * .3, (ph.n % 2 ? -1 : 1) * .03, k, age, false);
  return false;
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
  const big = B.big.find(b => t >= b.s && t <= b.e);
  const photo = B.photos.find(p => t >= p.s && t <= p.e && p.img);
  let doubleExp = false;
  if (photo && val('brollLayout', 'split') !== 'split') doubleExp = drawPhoto(photo, t, coral);
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
    if (photo && !fired.has('p' + photo.s)) { fired.add('p' + photo.s); sfx(photo.n % 2 ? 'shutter' : 'whoosh'); }
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
['optBig', 'optPhotos', 'optEmoji', 'optAI', 'optMG', 'optStats', 'optOverlay'].forEach(id => { document.getElementById(id).onchange = () => { if (id === 'optBig' && on('optBig')) loadSeg(); build(); }; });
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
const THEME_OF = { coral: 'coral', viral: 'noir', hormozi: 'dark', editorial: 'cine', minimal: 'clean' };
const themeKey = () => { const m = val('mg', 'auto'); return m !== 'auto' && THEMES[m] ? m : THEME_OF[$('#style').value] || 'coral'; };
const theme = () => THEMES[themeKey()];
const SERIF = s => { const f = val('fAccent', 'auto'); return f === 'auto' ? `italic 400 ${s}px "Instrument Serif", "Playfair Display", Georgia, serif` : `${/Caveat|Marker|Vibes|Pacifico|Dancing/.test(f) ? '' : 'italic '}400 ${s}px "${f}", Georgia, serif`; };
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
const hookTextType = () => { const v2 = val('hookText', 'auto'); return v2 !== 'auto' ? v2 : $('#style').value === 'coral' ? 'card' : 'big'; };
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
  cx.save();
  cx.strokeStyle = 'rgba(52,211,153,.8)'; cx.setLineDash([10, 8]); cx.lineWidth = 2;
  cx.strokeRect(W * .05, H * .1, W * .78, H * .68); cx.setLineDash([]);
  cx.fillStyle = 'rgba(16,185,129,.85)'; rrect(W * .5 - 90, H * .1 + 14, 180, 40, 20); cx.fill();
  cx.fillStyle = '#fff'; cx.font = '700 20px Inter, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('✓ Zona segura', W * .5, H * .1 + 34);
  cx.globalAlpha = .85; cx.font = '40px sans-serif';
  ['♥', '💬', '↗', '⋯'].forEach((ic, i) => cx.fillText(ic, W - 50, H * .5 + i * 86));
  cx.font = '600 22px Inter, sans-serif'; cx.textAlign = 'left'; cx.fillStyle = '#fff';
  cx.fillText('@tucuenta · descripción y hashtags', 30, H - 110); cx.fillText('♫ sonido original', 30, H - 74);
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
  glass: { bg: 'rgba(255,255,255,.16)', border: 'rgba(255,255,255,.45)', ink: '#fff', key: '#fff', label: 'rgba(255,255,255,.7)', blur: 18, font: s => `600 ${s}px "Plus Jakarta Sans", Inter, sans-serif` },
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
  const cw = W * .86, x0 = (W - cw) / 2, fs = 34;
  cx.save(); cx.font = S.font(fs);
  const lines = [[]]; let lw = 0;
  o.words.forEach(w => { const ww = cx.measureText(w.t + ' ').width; if (lw + ww > cw - 60 && lines.at(-1).length) { lines.push([]); lw = 0; } lines.at(-1).push({ w, ww }); lw += ww; });
  const chh = 70 + lines.length * fs * 1.3, y0 = H * .12;
  cx.globalAlpha = k; cx.translate(0, -30 * (1 - k));
  if (S.blur && HAS_FILTER) { cx.save(); rrect(x0, y0, cw, chh, 26); cx.clip(); blur(S.blur); cx.drawImage(cv, x0 - 30, y0 - 30, cw + 60, chh + 60, x0 - 30, y0 - 30, cw + 60, chh + 60); blur(0); cx.restore(); }
  if (S.glow) { cx.shadowColor = S.glow; cx.shadowBlur = 30; }
  rrect(x0, y0, cw, chh, 26); cx.fillStyle = S.bg; cx.fill(); cx.shadowColor = 'transparent';
  cx.lineWidth = 2; cx.strokeStyle = S.border; cx.stroke();
  if (S.grid) { cx.save(); rrect(x0, y0, cw, chh, 26); cx.clip(); cx.strokeStyle = 'rgba(37,99,235,.12)'; cx.lineWidth = 1; for (let gx = x0; gx < x0 + cw; gx += 22) { cx.beginPath(); cx.moveTo(gx, y0); cx.lineTo(gx, y0 + chh); cx.stroke(); } for (let gy = y0; gy < y0 + chh; gy += 22) { cx.beginPath(); cx.moveTo(x0, gy); cx.lineTo(x0 + cw, gy); cx.stroke(); } cx.restore(); }
  cx.fillStyle = S.label; cx.font = `700 18px ${S.mono ? '"JetBrains Mono", monospace' : 'Inter, sans-serif'}`; cx.textBaseline = 'middle';
  cx.fillText((S.mono ? '> ' : '● ') + o.label.toUpperCase(), x0 + 30, y0 + 32);
  cx.font = S.font(fs);
  lines.forEach((l, li) => {
    let x = x0 + 30; const y = y0 + 72 + li * fs * 1.3;
    l.forEach(({ w, ww }) => {
      const a = ease((t - w.s + .1) / .2);
      cx.globalAlpha = k * Math.max(.25, a); cx.fillStyle = w === o.key ? S.key : S.ink; cx.fillText(w.t, x, y);
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
  return { ...base, font: s => `${/Anton|Bebas|Archivo Black/.test(f) ? 400 : 800} ${s}px "${f}", Inter, sans-serif` };
}

// Draws one output frame for source time t from any drawable (the <video> in preview, a decoded VideoFrame when exporting).
let curSrc = v, curOt = 0, fastBusy = false;
function drawFrame(t, src, sw, sh) {
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
  else if (hookOn && hk !== 'none' && ot < 1.2) z *= 1 + .08 * (1 - ease(ot / 1.2));
  if (zoomOn && g) z *= 1 + .035 * Math.min(1, (t - g.s) / Math.max(2, g.e - g.s));
  if (P && on('optPunch')) { const pu = P.punches.find(q => t >= q.s && t <= q.e + .4); if (pu) z *= 1 + .14 * ease((t - pu.s) / .35) * (1 - ease((t - pu.e) / .4)); }
  const sx = 0, sy = 0;

  const framed = on('optFrame');
  const brollLayout = val('brollLayout', 'split');
  const splitPh = P && P.beats && !framed && brollLayout === 'split' ? P.beats.photos.find(q => q.img && t >= q.s && t <= q.e) : null;
  capX = W / 2; capY = splitPh ? H * .5 : H * .69;
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
      const img = splitPh.img, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s3 = Math.max(W / iw, top / ih) * (1.03 + .03 * (t - splitPh.s));
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
  if (P && !covered && !fxs.hide && !(inCta && ot >= ctaS) && on('optCaps')) { drawCaption(ch, t); drawEmoji(ci, ch, t); }
  if (hookOn && P && P.hook && !covered && !framed && hookTextType() === 'card') drawHookCard(P.hook, ot, P.hookDur);
  if (hookOn && P && P.hook && !covered && hookTextType() === 'question') drawHookQuestion(P.hook, ot, P.hookDur);
  if (inCta) screenTrans(ot, ctaS, 1e9, tt => ctaScreen(P.cta, tt - ctaS), 7, 'cta');
  if (P && on('optBar')) { cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - 8, W, 8); cx.fillStyle = theme().accent; cx.fillRect(0, H - 8, W * ot / P.total, 8); }
  if (P && !covered) fxTop(t, ot, P, si);
  if (busy && hookOn && ot < .15 && !fired.has('hooksfx')) {
    fired.add('hooksfx');
    const hs = hookSound();
    if (hs === 'riser') { sfx('riser'); sfx('impact', .5); } else if (hs !== 'none') sfx(hs);
  }
  if (hookOn && hk === 'blur' && ot < .6) { const k = 1 - ease(ot / .6); cx.save(); blur(18 * k); cx.drawImage(cv, 0, 0); blur(0); cx.restore(); }
  if (hookOn && hk === 'cine' && ot < 1.4) { const k = 1 - ease(ot / 1.4), bh = H * .13 * k; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, bh); cx.fillRect(0, H - bh, W, bh); }
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
  await ensureFonts();

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
async function ensureFonts() {
  if (!document.fonts) return;
  const list = ['800 40px "Plus Jakarta Sans"', '600 40px "Plus Jakarta Sans"', '900 40px Montserrat', '400 40px Anton', 'italic 400 40px "Instrument Serif"',
    'italic 600 40px Fraunces', '800 40px Outfit', '600 40px Outfit', '600 40px "Inter Tight"', '800 40px "Inter Tight"', '700 40px Caveat', '600 40px "JetBrains Mono"'];
  ['fBase', 'fKey', 'fAccent'].forEach(id => { const f = val(id, 'auto'); if (f !== 'auto') list.push(`400 40px "${f}"`, `800 40px "${f}"`, `italic 400 40px "${f}"`); });
  await Promise.race([Promise.all(list.map(f => document.fonts.load(f).catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
}
async function realtimeExport() {
  await ensureFonts();
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
