// Speech-to-text in a background thread so the page never freezes while it listens to your video.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

let asr = null, loaded = '';
self.onmessage = async e => {
  const { model, audio, opts } = e.data;
  try {
    if (!asr || loaded !== model) {
      const files = {};
      asr = await pipeline('automatic-speech-recognition', model, {
        dtype: 'q8', device: 'wasm',
        progress_callback: p => {
          if (p.status !== 'progress' || !p.total) return;
          files[p.file] = [p.loaded, p.total];
          const [a, b] = Object.values(files).reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);
          self.postMessage({ type: 'progress', a, b });
        }
      });
      loaded = model;
    }
    self.postMessage({ type: 'transcribing' });
    const out = await asr(audio, opts);
    self.postMessage({ type: 'done', out });
  } catch (err) {
    self.postMessage({ type: 'error', err: String(err && err.message || err) });
  }
};
