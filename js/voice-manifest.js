// voice-manifest.js : lit voix/manifest.json (liste de TOUTES les répliques de l'Entité, avec leur texte exact).
// Une réplique = un id ou une suite d'ids, ex. ['clue_fragment', 'chiffre_4'] ou (v0.2.3, baie banane)
// ['clue_patch_route', 'cable_rouge', 'prise_3']. Catégories : intro, clue, digit, color, socket, letter, taunt, sabotage, outcome.
// Pour remplacer une voix : déposer voix/<id>.mp3 et mettre "mp3Ready": true dans le manifeste. Aucun code à changer.
export const VOICE_VER = '0.2.6a';
export const MANIFEST_URL = `voix/manifest.json?v=${VOICE_VER}`;
const cues = new Map();
let loading = null;

export function loadManifest(prefetched) {
  if (!loading) {
    loading = (prefetched ? Promise.resolve(prefetched) : fetch(MANIFEST_URL, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { cues: [] })))
      .catch(() => ({ cues: [] }))
      .then((m) => { for (const c of m.cues || []) cues.set(c.id, c); return m; });
  }
  return loading;
}
export const cue = (id) => cues.get(id);
export const allCues = () => [...cues.values()];
// texte complet d'une suite d'ids (pour la synthèse vocale ou le sous-titre de secours)
export function sentence(ids) {
  return ids.map((id) => cues.get(id)?.text ?? '').filter(Boolean).join(' ').replace(/\s+([:!?])/g, '\u202f$1');
}
// vrai si chaque id de la suite a son mp3 prêt
export const allReady = (ids) => ids.length > 0 && ids.every((id) => cues.get(id)?.mp3Ready === true);
export const fileOf = (id) => {
  const f = cues.get(id)?.file ?? `voix/${id}.mp3`;
  return `${f}${f.includes('?') ? '&' : '?'}v=${VOICE_VER}`;
};
