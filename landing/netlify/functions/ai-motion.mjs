import { chat } from '../lib/llm.mjs';
import { guard, fail, readJson } from '../lib/guard.mjs';
// Motion-graphics director: designs full-screen animated scenes (own templates) for the video,
// either the ones the creator asks for in plain words or the best moments picked automatically.
// POST /api/ai-motion { words: "0:Hola 1:hoy ...", request? } → { motions: [...] } (cleaned again in the page)
const TPL = ['reveal', 'counter', 'bars', 'versus', 'roll', 'stamp', 'strike', 'letters', 'morph', 'quote', 'timeline', 'chat', 'progress', 'split'];
const FRAMES = ['none', 'laptop', 'phone', 'card', 'player'];
const THEMES = ['light', 'dark', 'color', 'orange'];
const UNITS = ['$', 'US$', '%', 'k', 'M', 'x', '+', ''];

const GUIDE = `You design premium motion-graphic scenes (Jitter / Apple keynote style) that cover the screen for 2-4 seconds inside a short vertical video.
Templates (tpl):
reveal = 1-3 short lines rise from masks; "key" is the most important words, shown in big italic serif and circled/underlined.
counter = a number counts up inside a ring ("num", "unit"), "lines" = label under it. Only for real numbers said in the video.
bars = bar chart growing: "values" (2-4 numbers), "labels" (same count), "lines"[0] = title. For growth, before/after, comparisons with numbers.
versus = two cards A vs B: "labels" = [A, B], "lines"[0] = title. For comparisons, before/after, myth vs truth.
roll = slot-machine words: "labels" = 2-4 wrong options rolling, "key" = the real answer, "lines"[0] = the phrase before (e.g. "La clave es").
stamp = one huge word slammed with shockwaves: "key" = 1-2 words, "lines" = optional small line above. For strong statements.
letters = the letters of one word fly in from everywhere, lock into place and explode at the end: "key" = 1 word, "lines" = optional line under it. For the hook or a punchline.
morph = a dot pops and stretches into a pill with the word inside, small dots orbiting: "key" = 1-3 words, "lines" = [line above, line below]. For concepts, names, tips.
quote = pull quote with a giant quote mark: "lines" = 1-3 short lines, "key" = the line to highlight (must equal one of the lines). For mantras, quotes, bold claims.
timeline = dashed path with numbered steps: "lines"[0] = title, "labels" = 2-4 steps in order. For steps, phases, "primero/después/al final", years.
chat = phone notifications/messages dropping in: "labels" = 2-4 short messages (as the viewer would read them), "key" = title above. For DMs, comments, "me escriben", distractions.
progress = loading bar fills then a check with confetti: "lines"[0] = what is loading, "key" = the result. For "en minutos", automatic, time saved, results.
split = before/after card with a sweeping handle: "labels" = [before, after], "lines"[0] = title. For transformations, problem vs solution.
strike = list where items get crossed out: "lines"[0] = intro (e.g. "No es"), "labels" = 2-4 items crossed, "key" = the real answer.
frame (how the scene is shown): none = full screen | laptop = the scene plays on a laptop screen in a dark room with reflection (premium, tech, business) | phone = the speaker inside a floating phone with a title above | card = the speaker inside a floating rounded card, title above and "key" over the card | player = the speaker inside a video-player card. phone/card/player show the speaker, so use "lines"[0] + "key" as the title.
theme: light (clean grey-white, default) | dark (black + lime) | color (electric blue + yellow) | orange (orange screen, great on laptop).
Rules: texts in the SAME language as the transcript, natural and correctly spelled (Argentina: voseo), very short (lines max 26 chars, key max 20, labels max 14). Never invent numbers that were not said. Vary templates, frames and themes.
"at" = index of the word where the scene starts (the moment that idea is said). "dur" = seconds (2-4).`;

export default async (req) => {
  const no = guard(req, { perMin: 6 }); if (no) return no;
  let body;
  try { body = await readJson(req); } catch { return fail('Pedido inválido.', 400); }
  const words = String(body.words || '').slice(0, 6000), request = String(body.request || '').slice(0, 400);
  if (!words) return fail('Primero subí un video.', 400);
  const system = `${GUIDE}
${request ? 'Design exactly what the creator asks (1-2 scenes). If they say when ("cuando digo X"), use that word index; otherwise pick the best moment for it.' : 'Pick the 4-5 strongest moments (about one every 12-15 seconds) of the video (numbers, comparisons, lists, bold claims, key lessons), spread out, never in the first 2 seconds, at least 5 seconds apart, and design one scene for each.'}
Reply with ONLY one JSON object: {"motions":[{"at":..,"dur":..,"tpl":..,"frame":..,"theme":..,"lines":[..],"key":..,"num":..,"unit":..,"labels":[..],"values":[..]}]}`;
  const user = `Transcript (index:word): ${words}${request ? `\nCreator request: ${request}` : ''}`;
  let last = '';
  const t0 = Date.now();
  for (let attempt = 0; attempt < 2 && Date.now() - t0 < 3000; attempt++) {
    const { text: out } = await chat(system, user, 1200);
    last = out.slice(0, 200);
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try {
      const raw = JSON.parse(m[0]);
      const s = (x, n) => String(x == null ? '' : x).slice(0, n);
      const arr = (x, n, f) => (Array.isArray(x) ? x : []).slice(0, n).map(f);
      const motions = (Array.isArray(raw.motions) ? raw.motions : []).slice(0, 6).map(r => ({
        at: Math.max(0, Math.round(+r.at || 0)), dur: Math.max(1.6, Math.min(4, +r.dur || 2.6)),
        tpl: TPL.includes(r.tpl) ? r.tpl : 'reveal', frame: FRAMES.includes(r.frame) ? r.frame : 'none', theme: THEMES.includes(r.theme) ? r.theme : 'light',
        lines: arr(r.lines, 3, x => s(x, 30)), key: s(r.key, 22), num: Math.max(0, Math.min(1e9, +r.num || 0)), unit: UNITS.includes(r.unit) ? r.unit : '',
        labels: arr(r.labels, 5, x => s(x, 16)), values: arr(r.values, 4, x => Math.max(0, Math.min(1e9, +x || 0)))
      }));
      if (motions.length) return Response.json({ motions });
    } catch (e) { last += ` | ${e.message}`; }
  }
  console.log('ai-motion failed', last);
  return fail('La IA no respondió. Probá de nuevo.', 502);
};

export const config = { path: '/api/ai-motion', method: 'POST', rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
