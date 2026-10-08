// Videora auto-editor: runs fully in the browser (no server, no cost).
// Whisper (transformers.js) transcribes with word timestamps, then a canvas
// renderer applies jump cuts, zooms, hook, animated captions and synthesized SFX.
const $ = q => document.querySelector(q);
const W = 720, H = 1280, MODEL = 'onnx-community/whisper-base_timestamped';
const cv = $('#cv'), cx = cv.getContext('2d');
const v = document.createElement('video');
v.playsInline = true; v.muted = true; v.loop = true; v.setAttribute('playsinline', '');

let file = null, words = [], speech = null, plan = null, asr = null, busy = false, aiRunning = false;
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
  if (asr) return asr;
  msg('Descargando el motor de subtítulos (solo la primera vez, unos 80 MB)…');
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  const files = {};
  asr = await pipeline('automatic-speech-recognition', MODEL, {
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

  let hook = '';
  if (words.length) {
    const hw = [];
    for (const w of words) { hw.push(w.t); if (hw.length >= 7 || /[.!?]$/.test(w.t)) break; }
    hook = hw.join(' ').replace(/[.,;:]$/, '');
  }
  plan = { segs, chunks, total: acc, hook };
  $('#go').disabled = aiRunning;
}

// ---------- Rendering ----------
const STYLES = {
  viral: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 74, upper: true, hi: '#FFE14D' },
  hormozi: { font: s => `900 ${s}px Montserrat, Inter, sans-serif`, size: 72, upper: true, hi: '#22E06B', box: true },
  editorial: { font: s => `italic 700 ${s}px "Playfair Display", Georgia, serif`, size: 66, upper: false, hi: '#FFD27A', soft: true },
  minimal: { font: s => `700 ${s}px Inter, system-ui, sans-serif`, size: 52, upper: false, hi: '#ffffff', pill: true }
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
    if (Math.max(...lines.map(([a, b]) => width(a, b))) < W * .84 || size < 40) return { size, sp, ws, lines, width, txt };
    size -= 4;
  }
}

function rrect(x, y, w, h, r) { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); }

function drawCaption(ch, t) {
  if (!ch) return;
  const st = STYLES[$('#style').value] || STYLES.viral;
  const L = wordsLayout(ch, st);
  const age = t - ch.s;
  const sc = st.soft ? 1 : .7 + .3 * back(age / .16);
  const alpha = st.soft ? ease(age / .25) : 1;
  const yOff = st.soft ? 18 * (1 - ease(age / .3)) : 0;
  cx.save();
  cx.translate(W / 2, H * .7 + yOff); cx.scale(sc, sc); cx.globalAlpha = alpha;
  cx.font = st.font(L.size); cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  const lh = L.size * 1.12, y0 = -(L.lines.length - 1) * lh / 2;
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
      if (st.soft) { cx.shadowColor = 'rgba(0,0,0,.75)'; cx.shadowBlur = 18; }
      else if (!st.pill) { cx.lineWidth = L.size * .2; cx.strokeStyle = '#000'; cx.strokeText(word, -ww / 2, 0); }
      cx.fillStyle = st.box ? '#fff' : (active || (st.soft && isKey)) ? st.hi : '#fff';
      if (st.pill) cx.fillStyle = active ? '#fff' : 'rgba(255,255,255,.55)';
      cx.fillText(word, -ww / 2, 0);
      cx.restore();
      x += ww + L.sp;
    }
  });
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
      v.currentTime = P.segs[0].s; lastSeg = lastChunk = -1; return;
    }
  }
  const g = si >= 0 ? P.segs[si] : null;
  const ot = g ? g.o + (t - g.s) : t;
  const hookOn = P && on('optHook');
  const ci = P ? P.chunks.findIndex(c => t >= c.s - .02 && t <= c.e + .2) : -1;
  const ch = ci >= 0 ? P.chunks[ci] : null;

  if (busy && si !== lastSeg) { if (lastSeg >= 0 && si % 2 === 1) sfx('whoosh'); lastSeg = si; }
  if (busy && ci !== lastChunk) { if (ci >= 0 && ch.emph) sfx('pop'); lastChunk = ci; }

  let z = g ? g.z : 1;
  if (hookOn && ot < .7) z *= 1 + .35 * (1 - ease(ot / .7));
  if (ch && ch.emph) z *= 1 + .08 * ease((t - ch.s) / .22);
  z *= 1 + .025 * Math.sin(ot * .7);
  let sx = 0, sy = 0;
  if (ch && ch.emph && t - ch.s < .16) { sx = (Math.random() - .5) * 14; sy = (Math.random() - .5) * 14; }

  const s = Math.max(W / v.videoWidth, H / v.videoHeight) * z, w = v.videoWidth * s, h = v.videoHeight * s;
  const fx = g ? g.fx : .5;
  const x = Math.min(0, Math.max(W - w, W / 2 - w * fx)) + sx, y = Math.min(0, Math.max(H - h, H * .42 - h * .42)) + sy;
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
  cx.drawImage(v, x, y, w, h);

  const gr = cx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
  cx.fillStyle = gr; cx.fillRect(0, 0, W, H);

  if (hookOn && ot < .22) { cx.fillStyle = `rgba(255,255,255,${.9 * (1 - ot / .22)})`; cx.fillRect(0, 0, W, H); }
  if (P) drawCaption(ch, t);
  if (hookOn && P.hook) drawHook(P.hook, ot);
  if (P) { cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - 8, W, 8); cx.fillStyle = '#ec4899'; cx.fillRect(0, H - 8, W * ot / P.total, 8); }
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
['lang', 'task'].forEach(id => { $('#' + id).onchange = () => { if (file) runAI(); }; });
