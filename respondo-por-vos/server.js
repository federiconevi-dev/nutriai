// Respondo por vos: asistente de WhatsApp con IA y control de costos.
// Sin dependencias. Node 18+. Ver README.md.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const E = process.env;
const PORT = E.PORT || 3000;
const VENTANA_MS = 24 * 60 * 60 * 1000; // ventana de atención de Meta
// Precios aproximados en USD por plantilla (Argentina). Revisalos en la tabla de Meta.
const PRECIO = {
  marketing: Number(E.PRECIO_MARKETING || 0.0618),
  utility: Number(E.PRECIO_UTILITY || 0.026),
};
const MODELO = E.MODELO_IA || 'claude-haiku-5-5';
const DB_PATH = path.join(DIR, 'data', 'db.json');
const NEG_PATH = path.join(DIR, 'data', 'negocio.json');

// ---------- datos ----------
const leer = (p, def) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } };
let negocio = leer(NEG_PATH, leer(path.join(DIR, 'data', 'negocio.ejemplo.json'), {}));
const db = leer(DB_PATH, { chats: {}, vistos: [], stats: {} });
db.stats = Object.assign({ recibidos: 0, respGratis: 0, respFaq: 0, respIA: 0, tokensIA: 0, plantillas: 0, costoUSD: 0, bloqueados: 0 }, db.stats);
let guardarT;
const guardar = () => { clearTimeout(guardarT); guardarT = setTimeout(() => fs.writeFileSync(DB_PATH, JSON.stringify(db)), 300); };

const chat = (tel) => (db.chats[tel] ||= { tel, nombre: '', humano: false, ultimoCliente: 0, msgs: [] });
const enVentana = (c) => Date.now() - c.ultimoCliente < VENTANA_MS;
const anotar = (c, de, texto, extra = {}) => { c.msgs.push({ de, texto, t: Date.now(), ...extra }); if (c.msgs.length > 200) c.msgs.shift(); guardar(); };

// ---------- cerebro ----------
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function respuestaFaq(texto) {
  const t = norm(texto);
  for (const f of negocio.faq || []) if (f.claves.some((k) => t.includes(norm(k)))) return f.respuesta;
  for (const p of negocio.catalogo || []) {
    const palabras = norm(p.producto).split(/\s+/).filter((w) => w.length > 3);
    if (palabras.length && palabras.every((w) => t.includes(w)) && /precio|cuanto|sale|vale/.test(t))
      return `${p.producto}: $${p.precio.toLocaleString('es-AR')}${p.variantes ? ` (${p.variantes})` : ''}. ¿Te lo separo?`;
  }
  const lista = () => (negocio.catalogo || []).map((p) => `• ${p.producto}: $${Number(p.precio).toLocaleString('es-AR')}`).join('\n');
  if (/^(hola|buen[oa]s|holis|hey)\b/.test(t) && t.length < 25) return `${negocio.bienvenida}\n\n${lista()}`;
  if (/comprar|lo quiero|me lo llevo|pagar|link/.test(t)) return `¡Genial! 🙌 Pagás acá: ${negocio.linkPago}\nDespués pasame tu nombre y qué producto elegiste.`;
  if (/precio|precios|cuanto|catalogo|que tenes|que venden|productos/.test(t)) return `Esto es lo que tenemos:\n${lista()}\n¿Cuál te interesa?`;
  return null;
}

function promptSistema() {
  const n = negocio;
  const cat = (n.catalogo || []).map((p) => `- ${p.producto}: $${p.precio}${p.variantes ? ` (${p.variantes})` : ''}`).join('\n');
  return `Sos el asistente de WhatsApp de ${n.nombre}, ${n.rubro} en ${n.zona}.
Hablás en español rioplatense, con voseo, ${n.tono}. Respondé en UN solo mensaje de máximo 3 líneas.
Horario de atención humana: ${n.horario}. Fuera de horario contestás igual.
Envíos: ${n.envios}
Pagos: ${n.pagos} Link de pago: ${n.linkPago || 'pedíselo a una persona'}
Cambios: ${n.cambios}
Catálogo (únicos precios válidos):
${cat}
Reglas:
- Si un producto no está en el catálogo, no inventes: decí que lo consultás.
- Nunca: ${n.prohibido}.
- Si el cliente quiere comprar, pasale el link de pago y pedile nombre y producto.
- Si se enoja, reclama o pregunta algo que no sabés, respondé exactamente: [HUMANO]`;
}

async function respuestaIA(c) {
  if (!E.ANTHROPIC_API_KEY) return /reclamo|roto|enojad|estafa|devolu|queja/.test(norm(c.msgs.at(-1)?.texto || '')) ? '[HUMANO]' : `No estoy seguro de eso 🤔 Te paso lo que tenemos:\n${(negocio.catalogo || []).map((p) => `• ${p.producto}: $${Number(p.precio).toLocaleString('es-AR')}`).join('\n')}\nSi preferís, escribí "persona" y te atiende alguien.`;
  const historial = c.msgs.slice(-8).map((m) => ({ role: m.de === 'cliente' ? 'user' : 'assistant', content: m.texto }));
  while (historial.length && historial[0].role !== 'user') historial.shift();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': E.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, max_tokens: 250, system: promptSistema(), messages: historial }),
  });
  const j = await r.json();
  if (!r.ok) { console.error('IA', j); return '[HUMANO]'; }
  db.stats.tokensIA += (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0);
  return j.content?.[0]?.text?.trim() || '[HUMANO]';
}

// ---------- WhatsApp ----------
async function enviarWA(tel, cuerpo) {
  if (!E.WA_TOKEN || !E.WA_PHONE_ID) return { ok: true, simulado: true };
  const r = await fetch(`https://graph.facebook.com/v21.0/${E.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.WA_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: tel, ...cuerpo }),
  });
  const j = await r.json();
  if (!r.ok) console.error('WA', j);
  return { ok: r.ok, ...j };
}

// Respuesta libre: solo dentro de la ventana de 24 h, donde Meta no cobra.
async function responder(c, texto, por = 'bot') {
  if (!enVentana(c)) { db.stats.bloqueados++; guardar(); return { ok: false, error: 'Fuera de la ventana de 24 h: solo se puede mandar una plantilla (paga).' }; }
  const r = await enviarWA(c.tel, { type: 'text', text: { body: texto } });
  if (r.ok) { db.stats.respGratis++; anotar(c, por, texto); }
  return r;
}

// Plantilla: la única forma de escribir fuera de la ventana. Se cuenta el costo.
async function plantilla(c, nombre, categoria = 'utility', idioma = 'es_AR') {
  const r = await enviarWA(c.tel, { type: 'template', template: { name: nombre, language: { code: idioma } } });
  if (r.ok) {
    const costo = PRECIO[categoria] ?? PRECIO.marketing;
    db.stats.plantillas++; db.stats.costoUSD += costo;
    anotar(c, 'humano', `[plantilla ${nombre}]`, { costoUSD: costo });
  }
  return r;
}

async function procesarEntrante(tel, nombre, texto, id) {
  if (id) { if (db.vistos.includes(id)) return null; db.vistos.push(id); if (db.vistos.length > 500) db.vistos.shift(); }
  const c = chat(tel);
  const nuevo = c.msgs.length === 0;
  if (nombre) c.nombre = nombre;
  c.ultimoCliente = Date.now();
  db.stats.recibidos++;
  anotar(c, 'cliente', texto);
  if (c.humano) return null; // lo atiende una persona desde el panel

  let resp = /\bpersona\b|humano|asesor/.test(norm(texto)) ? '[HUMANO]' : respuestaFaq(texto);
  if (resp) db.stats.respFaq++;
  else { resp = await respuestaIA(c); db.stats.respIA++; }
  if (resp.includes('[HUMANO]')) { c.humano = true; resp = negocio.derivacion; }
  if (nuevo && negocio.bienvenida && !resp.includes(negocio.bienvenida)) resp = `${negocio.bienvenida}\n\n${resp}`; // todo en un solo mensaje
  await responder(c, resp);
  return resp;
}

// ---------- HTTP ----------
const cuerpo = (req) => new Promise((ok) => { let d = ''; req.on('data', (x) => (d += x)); req.on('end', () => ok(d)); });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

function autorizado(req) {
  if (!E.PANEL_PASS) return true;
  const [, b64] = (req.headers.authorization || '').split(' ');
  return Buffer.from(b64 || '', 'base64').toString().split(':')[1] === E.PANEL_PASS;
}

function firmaOk(req, raw) {
  if (!E.WA_APP_SECRET) return true;
  const esperado = 'sha256=' + crypto.createHmac('sha256', E.WA_APP_SECRET).update(raw).digest('hex');
  const llega = req.headers['x-hub-signature-256'] || '';
  return llega.length === esperado.length && crypto.timingSafeEqual(Buffer.from(llega), Buffer.from(esperado));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    // Webhook de Meta
    if (url.pathname === '/webhook' && req.method === 'GET') {
      const ok = url.searchParams.get('hub.verify_token') === E.WA_VERIFY_TOKEN;
      res.writeHead(ok ? 200 : 403); return res.end(ok ? url.searchParams.get('hub.challenge') : '');
    }
    if (url.pathname === '/webhook' && req.method === 'POST') {
      const raw = await cuerpo(req);
      if (!firmaOk(req, raw)) { res.writeHead(401); return res.end(); }
      res.writeHead(200); res.end(); // Meta pide respuesta rápida
      const v = JSON.parse(raw).entry?.[0]?.changes?.[0]?.value || {};
      for (const m of v.messages || []) {
        const texto = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || '[audio/imagen]';
        const nombre = v.contacts?.find((x) => x.wa_id === m.from)?.profile?.name;
        procesarEntrante(m.from, nombre, texto, m.id).catch(console.error);
      }
      return;
    }

    // Panel
    if (!autorizado(req)) { res.writeHead(401, { 'www-authenticate': 'Basic realm="panel"' }); return res.end('Clave'); }
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(DIR, 'panel.html'))); }
    if (url.pathname === '/api/estado') {
      const chats = Object.values(db.chats).map((c) => ({ ...c, enVentana: enVentana(c), venceEn: Math.max(0, c.ultimoCliente + VENTANA_MS - Date.now()) }))
        .sort((a, b) => (b.msgs.at(-1)?.t || 0) - (a.msgs.at(-1)?.t || 0));
      return json(res, 200, { stats: db.stats, chats, negocio, conectado: !!(E.WA_TOKEN && E.WA_PHONE_ID), ia: !!E.ANTHROPIC_API_KEY, precios: PRECIO });
    }
    if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
    const b = JSON.parse((await cuerpo(req)) || '{}');
    if (url.pathname === '/api/negocio') { negocio = b; fs.writeFileSync(NEG_PATH, JSON.stringify(b, null, 2)); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/reiniciar') { delete db.chats.prueba; guardar(); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/probar') { if (db.chats.prueba) db.chats.prueba.humano = false; } if (url.pathname === '/api/probar') return json(res, 200, { respuesta: await procesarEntrante(b.tel || 'prueba', 'Prueba', b.texto) });
    const c = db.chats[b.tel];
    if (!c) return json(res, 404, { error: 'No existe el chat' });
    if (url.pathname === '/api/humano') { c.humano = !!b.humano; guardar(); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/enviar') return json(res, 200, await responder(c, b.texto, 'humano'));
    if (url.pathname === '/api/plantilla') return json(res, 200, await plantilla(c, b.nombre, b.categoria));
    res.writeHead(404); res.end();
  } catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, () => console.log(`Respondo por vos en http://localhost:${PORT}`));
