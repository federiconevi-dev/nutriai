import { ollamaChat } from '../lib/ollama.mjs';
// Art direction: turns what the person says (usually Spanish) into short English image prompts, one per moment.
// POST /api/ai-plan  { text, subjects: string[] }  →  { prompts: string[] }
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const subjects = Array.isArray(body.subjects) ? body.subjects.slice(0, 40).map(s => String(s).slice(0, 300)) : [];
  const text = String(body.text || '').slice(0, 4000);
  if (!subjects.length) return Response.json({ prompts: [] });
  const account = Netlify.env.get('CF_ACCOUNT_ID'), token = Netlify.env.get('CF_API_TOKEN');
  if (!account || !token) return Response.json({ error: 'El servidor no tiene configurado Cloudflare.' }, { status: 503 });

  if (body.mode === 'broll') return broll(account, token, subjects, text, Math.max(1, Math.min(6, Number(body.max) || 3)));
  const system = 'You are the art director of viral short-form videos. For each numbered moment, write ONE vivid English image prompt (max 25 words) for a single striking visual metaphor that matches what is being said: one clear subject, centered, no text, no letters, no logos, no people talking to camera. Reply ONLY with lines in the form "N: prompt".';
  const user = `Full transcript (for context): ${text}\n\nMoments:\n${subjects.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 900, temperature: 0.6 })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const out = String((data.result && data.result.response) || '');
      const prompts = subjects.map((s, i) => {
        const m = out.match(new RegExp(`^\\s*${i + 1}\\s*[:.)-]\\s*(.+)$`, 'm'));
        return m ? m[1].replace(/^["']|["']$/g, '').trim() : s;
      });
      return Response.json({ prompts, model });
    } catch { /* try next model */ }
  }
  const alt = await ollamaChat(system, user);
  if (alt) {
    const prompts = subjects.map((s2, i) => { const m = alt.match(new RegExp(`^\\s*${i + 1}\\s*[:.)-]\\s*(.+)$`, 'm')); return m ? m[1].replace(/^["']|["']$/g, '').trim() : s2; });
    return Response.json({ prompts, model: 'ollama' });
  }
  return Response.json({ prompts: subjects, fallback: true });
};

export const config = { path: '/api/ai-plan', method: 'POST' };

// B-roll planning: pick only the sentences where a supporting image makes the message clearer.
async function broll(account, token, sentences, text, max) {
  const system = `You are the editor of a viral short video. From the numbered sentences, choose the ${max} best ones to illustrate with a short cutaway image (b-roll) that shows exactly what is being said: a concrete object, place, action, or a clear visual metaphor of the idea. Skip greetings and calls to action ("comment", "follow", "save this video"). For each pick write a vivid English image prompt (max 22 words, one clear subject, cinematic photorealistic, no text, no logos). Reply ONLY with lines "N: prompt", nothing else.`;
  const user = `Context: ${text.slice(0, 3000)}\n\nSentences:\n${sentences.map((s, i) => `${i + 1}: ${s}`).join('\n')}`;
  let out = '';
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 600, temperature: 0.4 })
      });
      if (!res.ok) continue;
      const data = await res.json();
      out = String((data.result && data.result.response) || '');
      if (out) break;
    } catch { /* next */ }
  }
  if (!out) out = await ollamaChat(system, user);
  const picks = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s*[:.)-]\s*(.+)$/);
    if (m && picks.length < max) { const i = Number(m[1]) - 1; if (sentences[i] && !picks.some(p => p.i === i)) picks.push({ i, prompt: m[2].replace(/^["']|["']$/g, '').trim() }); }
  }
  return Response.json({ picks });
}
