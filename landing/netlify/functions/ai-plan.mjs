import { chat } from '../lib/llm.mjs';
import { guard, fail, readJson } from '../lib/guard.mjs';
// Art direction: turns what the person says (usually Spanish) into short English image prompts, one per moment.
// POST /api/ai-plan  { text, subjects: string[] }  →  { prompts: string[] }

export default async (req) => {
  const no = guard(req, { perMin: 12 }); if (no) return no;
  let body;
  try { body = await readJson(req); } catch { return fail('Pedido inválido.', 400); }
  const subjects = Array.isArray(body.subjects) ? body.subjects.slice(0, 40).map(s => String(s).slice(0, 300)) : [];
  const text = String(body.text || '').slice(0, 4000);
  if (!subjects.length) return Response.json({ prompts: [] });
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  if (body.mode === 'broll') return broll(account, token, subjects, text, Math.max(1, Math.min(8, Number(body.max) || 3)));
  const system = 'You are the art director of viral short-form videos. For each numbered moment, write ONE vivid English image prompt (max 25 words) for a single concrete visual (object, hands, place, screen or close-up, never a stranger face) that matches what is being said: one clear subject, centered, premium cinematic commercial photo, 85mm, shallow depth of field, soft key light, teal and amber grade, no text, no letters, no logos. Reply ONLY with lines in the form "N: prompt".';
  const user = `Full transcript (for context): ${text}\n\nMoments:\n${subjects.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  const { text: out, model } = await chat(system, user, 900);
  const prompts = subjects.map((s2, i) => {
    const m = out.match(new RegExp(`^\\s*${i + 1}\\s*[:.)-]\\s*(.+)$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '').trim() : s2;
  });
  return Response.json({ prompts, model, fallback: !out });
};

export const config = { path: '/api/ai-plan', method: 'POST', rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] } };

// B-roll planning: pick only the sentences where a supporting image makes the message clearer.
async function broll(account, token, sentences, text, max) {
  const system = `You are the editor of a viral short video. From the numbered sentences, choose the ${max} best ones to illustrate with a short cutaway image (b-roll) that shows exactly what is being said: a concrete object, place, action, or a clear visual metaphor of the idea. First understand what the whole video is about (its topic and goal). Every pick must clearly relate to BOTH its sentence and that overall topic, so the viewer instantly gets the connection (e.g. in a video about reaching sales goals, \"subir de nivel\" means growing sales, so show a rising sales dashboard, never a video game or an animal). Include sentence 1 (the opening image is the visual hook) only if it can be shown as a concrete thing; otherwise show the main topic object of the video. Skip calls to action ("comment", "follow", "save this video"). Skip a sentence when it is a greeting, filler or transition, when it is too abstract or personal to show as a concrete object, place or screen without inventing an unrelated scene, or when it is about a person's identity or face. For each pick write ONE English image prompt (35-55 words) in this order: concrete subject, setting, light, camera. Show the literal object, hands, place, screen or macro close-up that the sentence names, never a stranger's face; people only as hands, a back view or a silhouette. Abstract ideas become one tangible thing (growth -> a phone showing a rising sales chart). Subject in the center third with empty space around it. Same style every time: premium cinematic commercial photograph, 85mm, shallow depth of field, soft directional key light, deep teal and warm amber grade, clean uncluttered background, sharp detail. No text, letters, numbers, logos, watermarks, collage or extra fingers. Reply ONLY with lines "N: prompt || kicker || title || search": kicker is a 2-4 word elegant intro phrase and title a 2-4 word bold on-screen title, both in the SAME language as the sentence, natural and grammatically perfect with correct accents (e.g. "Tu viaje comienza || Aprendé lo esencial"); search is 2-3 simple English keywords naming a LITERAL, filmable scene with people or objects that shows the same meaning (e.g. "person climbing stairs", "laptop sales chart"); never metaphors, never animals or nature unless the sentence talks about them. Nothing else.`;
  const user = `Context: ${text.slice(0, 3000)}\n\nSentences:\n${sentences.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  const { text: out } = await chat(system, user, 700);
  const picks = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s*[:.)-]\s*(.+)$/);
    if (m && picks.length < max) { const i = Number(m[1]) - 1; if (sentences[i] && !picks.some(p => p.i === i)) { const [pr, a, b, sq] = m[2].split('||').map(x => x.replace(/[*_#`]/g, '').replace(/^[\s"']+|[\s"']+$/g, '')); picks.push({ i, prompt: pr, kicker: b ? a : '', label: (b || a || ''), search: (sq || '').slice(0, 60) }); } }
  }
  return Response.json({ picks });
}
