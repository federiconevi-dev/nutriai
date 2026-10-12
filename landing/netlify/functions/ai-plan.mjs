import { chat } from '../lib/llm.mjs';
// Art direction: turns what the person says (usually Spanish) into short English image prompts, one per moment.
// POST /api/ai-plan  { text, subjects: string[] }  →  { prompts: string[] }

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const subjects = Array.isArray(body.subjects) ? body.subjects.slice(0, 40).map(s => String(s).slice(0, 300)) : [];
  const text = String(body.text || '').slice(0, 4000);
  if (!subjects.length) return Response.json({ prompts: [] });
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  if (body.mode === 'broll') return broll(account, token, subjects, text, Math.max(1, Math.min(8, Number(body.max) || 3)));
  const system = 'You are the art director of viral short-form videos. For each numbered moment, write ONE vivid English image prompt (max 25 words) for a single striking visual metaphor that matches what is being said: one clear subject, centered, no text, no letters, no logos, no people talking to camera. Reply ONLY with lines in the form "N: prompt".';
  const user = `Full transcript (for context): ${text}\n\nMoments:\n${subjects.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  const { text: out, model } = await chat(system, user, 900);
  const prompts = subjects.map((s2, i) => {
    const m = out.match(new RegExp(`^\\s*${i + 1}\\s*[:.)-]\\s*(.+)$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '').trim() : s2;
  });
  return Response.json({ prompts, model, fallback: !out });
};

export const config = { path: '/api/ai-plan', method: 'POST' };

// B-roll planning: pick only the sentences where a supporting image makes the message clearer.
async function broll(account, token, sentences, text, max) {
  const system = `You are the editor of a viral short video. From the numbered sentences, choose the ${max} best ones to illustrate with a short cutaway image (b-roll) that shows exactly what is being said: a concrete object, place, action, or a clear visual metaphor of the idea. Always include sentence 1 (the opening image is the visual hook). Skip calls to action ("comment", "follow", "save this video"). For each pick write a vivid English image prompt (max 22 words, one clear subject, cinematic, glossy, dramatic lighting, rich colors, photorealistic or polished 3D, no text, no letters, no logos). Reply ONLY with lines "N: prompt || kicker || title || search": kicker is a 2-4 word elegant intro phrase and title a 2-4 word bold on-screen title, both in the SAME language as the sentence, natural and grammatically perfect with correct accents (e.g. "Tu viaje comienza || Aprendé lo esencial"); search is 2-3 simple English keywords to find a matching real stock video clip (e.g. "person climbing stairs"). Nothing else.`;
  const user = `Context: ${text.slice(0, 3000)}\n\nSentences:\n${sentences.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  const { text: out } = await chat(system, user, 700);
  const picks = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s*[:.)-]\s*(.+)$/);
    if (m && picks.length < max) { const i = Number(m[1]) - 1; if (sentences[i] && !picks.some(p => p.i === i)) { const [pr, a, b, sq] = m[2].split('||').map(x => x.replace(/[*_#`]/g, '').replace(/^[\s"']+|[\s"']+$/g, '')); picks.push({ i, prompt: pr, kicker: b ? a : '', label: (b || a || ''), search: (sq || '').slice(0, 60) }); } }
  }
  return Response.json({ picks });
}
