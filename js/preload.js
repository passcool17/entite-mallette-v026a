// preload.js : précharge la musique, les voix prêtes du manifeste et les polices avant « Ouvrir la mallette », avec un vrai pourcentage.
// % = octets reçus / octets attendus. Les octets attendus viennent de Content-Length dès que l'en-tête arrive
// (sinon d'une estimation par fichier). Les polices comptent pour leur taille connue, d'un bloc quand elles sont prêtes.
// Les fichiers téléchargés sont gardés ici (une promesse par URL) : audio.js les reprend, sans second téléchargement.
import { loadManifest, MANIFEST_URL, fileOf } from './voice-manifest.js?v=0.2.6a';

export const MUSIC_URL = 'audio/tension.mp3';
const FONTS = [
  ['500 1em "Chakra Petch"', 9956], ['700 1em "Chakra Petch"', 9900], ['500 1em "JetBrains Mono"', 21832],
];
const EST = { music: 192827, voice: 55000 };
const store = new Map(); // url -> Promise<ArrayBuffer|null>

// reprendre un fichier préchargé (une seule fois : decodeAudioData consomme le tampon)
export function takePreloaded(url) { const p = store.get(url); store.delete(url); return p || null; }

export function preloadAll(onProgress) {
  const items = [], failed = [];
  const report = () => {
    let got = 0, total = 0;
    for (const it of items) { got += Math.min(it.got, it.total); total += it.total; }
    onProgress(total ? got / total : 0, items.filter((i) => i.done).length, items.length);
  };
  const track = (url, est) => {
    const it = { url, got: 0, total: est, done: false };
    items.push(it);
    const p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const len = +res.headers.get('content-length');
        if (len > 0) { it.total = len; report(); }
        if (!res.body?.getReader) { const ab = await res.arrayBuffer(); it.got = it.total = ab.byteLength; return ab; }
        const reader = res.body.getReader(), chunks = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); it.got += value.byteLength; report();
        }
        const out = new Uint8Array(it.got); let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.byteLength; }
        it.total = it.got;
        return out.buffer;
      } catch { it.got = it.total; failed.push(url); return null; } // échec : signalé, audio.js se repliera
      finally { it.done = true; report(); }
    })();
    store.set(url, p);
    return p;
  };
  const jobs = [track(MUSIC_URL, EST.music)];
  for (const [desc, size] of FONTS) {
    const it = { url: desc, got: 0, total: size, done: false };
    items.push(it);
    jobs.push((document.fonts?.load(desc) ?? Promise.resolve()).catch(() => {}).finally(() => { it.got = it.total; it.done = true; report(); }));
  }
  // manifeste des voix (réseau d'abord), puis seulement les mp3 marqués prêts (aucune requête pour les autres : 0 erreur 404)
  const manP = fetch(MANIFEST_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { cues: [] })).catch(() => ({ cues: [] }));
  jobs.push(manP.then((m) => { loadManifest(m); return Promise.all((m.cues || []).filter((c) => c.mp3Ready).map((c) => track(fileOf(c.id), EST.voice))); }));
  report();
  return Promise.all(jobs).then(() => ({ failed }));
}
