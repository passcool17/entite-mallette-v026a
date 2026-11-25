// sfx.js : effets procéduraux WebAudio (aucun fichier). Branchés sur le bus d'effets d'audio.js (donc coupés par le bouton son).
import { bus } from './audio.js?v=0.2.6a';

let noiseBuf = null;
function ctx() { return bus(); }
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.004 } = {}) {
  const b = ctx(); if (!b) return;
  const { ac, out } = b, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  env(g, t, attack, dur, vol);
  o.connect(g).connect(out); o.start(t); o.stop(t + attack + dur + 0.05);
}
function noise(dur, { vol = 0.3, at = 0, lp = 1200, hp = 0, q = 0.7 } = {}) {
  const b = ctx(); if (!b) return;
  const { ac, out } = b, t = ac.currentTime + at;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = q;
  const g = ac.createGain(); env(g, t, 0.004, dur, vol);
  let node = src.connect(f);
  if (hp) { const h = ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node = node.connect(h); }
  node.connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
const SIMON = { rouge: 330, vert: 415, bleu: 523, ambre: 622 };

export const sfx = {
  tick(urgent) { tone(urgent ? 1900 : 1250, 0.03, { type: 'square', vol: urgent ? 0.08 : 0.04 }); },
  detent() { noise(0.012, { vol: 0.32, lp: 7000, hp: 2500 }); tone(2600, 0.008, { type: 'square', vol: 0.025 }); },   // cran d'encodeur
  push() { noise(0.02, { vol: 0.4, lp: 4000, hp: 1200 }); tone(140, 0.05, { vol: 0.12 }); },                         // poussoir
  coverUp() { noise(0.07, { vol: 0.22, lp: 2600, hp: 500 }); tone(520, 0.08, { type: 'triangle', vol: 0.07, slide: 1.6 }); },
  coverDown() { noise(0.05, { vol: 0.3, lp: 2200, hp: 400 }); tone(300, 0.06, { type: 'triangle', vol: 0.08, slide: 0.5 }); },
  toggleSnap() { noise(0.018, { vol: 0.55, lp: 6000, hp: 1800 }); tone(95, 0.09, { vol: 0.2 }); },
  keyTurn() { noise(0.05, { vol: 0.3, lp: 3500, hp: 900 }); noise(0.04, { vol: 0.34, lp: 3500, hp: 900, at: 0.09 }); tone(85, 0.14, { vol: 0.18, at: 0.09 }); },
  plugPull() { noise(0.06, { vol: 0.4, lp: 5000, hp: 1400 }); tone(1800, 0.05, { type: 'triangle', vol: 0.06, slide: 0.5, at: 0.02 }); },
  plugIn() { noise(0.018, { vol: 0.45, lp: 6500, hp: 1800 }); tone(950, 0.03, { type: 'square', vol: 0.05 }); tone(420, 0.04, { vol: 0.09, at: 0.012 }); },   // fiche banane enfoncée : clic sec
  servo() { tone(130, 0.5, { type: 'sawtooth', vol: 0.045, slide: 1.5, attack: 0.03 }); noise(0.5, { vol: 0.07, lp: 1800, hp: 600 }); noise(0.04, { vol: 0.3, lp: 4000, hp: 800, at: 0.52 }); },
  keypad() { tone(1480, 0.045, { type: 'square', vol: 0.05 }); },
  simon(c) { tone(SIMON[c] || 440, 0.22, { type: 'triangle', vol: 0.12 }); },
  rfPulse() { tone(13560 / 10, 0.05, { type: 'sine', vol: 0.05 }); tone(1760, 0.06, { type: 'square', vol: 0.04, at: 0.12 }); tone(2640, 0.12, { type: 'square', vol: 0.05, at: 0.2 }); },
  joy() { tone(900, 0.02, { type: 'square', vol: 0.03 }); },
  wall() { tone(110, 0.08, { type: 'square', vol: 0.07 }); },
  strike() { tone(160, 0.24, { type: 'sawtooth', vol: 0.16 }); tone(152, 0.24, { type: 'square', vol: 0.08, at: 0.02 }); },
  confirm() { tone(880, 0.08, { type: 'triangle', vol: 0.12 }); tone(1320, 0.16, { type: 'triangle', vol: 0.11, at: 0.07 }); tone(1760, 0.2, { type: 'sine', vol: 0.05, at: 0.14 }); },
  glitch() { for (let i = 0; i < 5; i++) noise(0.03 + Math.random() * 0.04, { vol: 0.14, lp: 3000 + Math.random() * 5000, hp: 300, at: i * 0.05 }); tone(60, 0.25, { type: 'sawtooth', vol: 0.05 }); },
  lowBatt() { tone(1568, 0.06, { type: 'sine', vol: 0.035 }); tone(1175, 0.09, { type: 'sine', vol: 0.03, at: 0.11 }); },   // batterie < 15 % : deux notes douces descendantes, une fois
  alarm() { for (let i = 0; i < 3; i++) tone(980, 0.12, { type: 'square', vol: 0.08, at: i * 0.18 }); },
  arm() { tone(220, 0.6, { type: 'sawtooth', vol: 0.06, slide: 4, attack: 0.05 }); tone(880, 0.12, { type: 'square', vol: 0.05, at: 0.62 }); },
  lidOpen() { noise(0.35, { vol: 0.12, lp: 900 }); tone(70, 0.4, { vol: 0.14, slide: 1.4 }); },
  hold() { tone(70, 2, { type: 'sawtooth', vol: 0.09, slide: 4, attack: 0.05 }); },
  boom() {
    noise(2.6, { vol: 1, lp: 900, q: 0.4 }); noise(0.35, { vol: 0.8, lp: 6000 });
    tone(70, 2.2, { vol: 0.8, slide: 0.3, attack: 0.002 }); tone(42, 2.8, { type: 'triangle', vol: 0.5, slide: 0.5 });
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1.2, { type: 'sine', vol: 0.1, at: i * 0.14, attack: 0.02 }));
    tone(98, 3, { type: 'triangle', vol: 0.12, attack: 0.3 });
  },
};
