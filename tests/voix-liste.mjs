// Met à jour voix/voix.json d'après les fichiers voix/<id>.mp3 présents (ids de js/voix.js).
// Usage : node tests/voix-liste.mjs   (à relancer quand le bot Voix livre des fichiers)
import { readdirSync, writeFileSync } from 'node:fs';
import { LINES } from '../js/voix.js';
const dir = new URL('../voix/', import.meta.url);
const ids = readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
const files = ids.filter((id) => LINES[id]);
const unknown = ids.filter((id) => !LINES[id]);
writeFileSync(new URL('voix.json', dir), JSON.stringify({ files }, null, 2) + '\n');
console.log(`${files.length} voix listées${unknown.length ? ` ; ignorées (id inconnu) : ${unknown.join(', ')}` : ''}`);
