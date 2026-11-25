// audio.js (v0.2.5) : graphe WebAudio unique (voix / musique / effets, limiteur, L/R), musique de tension, voix de l'Entité (manifeste voix/manifest.json : mp3 si prêt, sinon synthèse française),
// routée dans un AnalyserNode pour animer l'œil.
import { loadManifest, sentence, fileOf, cue } from './voice-manifest.js?v=0.2.6a';
import { takePreloaded, MUSIC_URL } from './preload.js?v=0.2.6a';

let ac = null, master, limiter, sfxBus, voiceBus, analyser, data, muted = false, volume = 0.9;
let musicBus, musicDuck, musicLP, music = null, musicBuf = null, musicLoad = null;
let bed = null, speaking = false, onCaption = () => {};
const buffers = new Map();
export const voiceStats = { fichier: 0, synthese: 0 };
// v0.2.4 : un seul graphe WebAudio, comme le vrai matériel (ESP32 → I2S → 2 x MAX98357A → SPK-L / SPK-R) :
//   voix  ─► bus voix  ─► panoramique (centre : les deux HP) ─┐
//   musique (boucle tension.mp3 + basse pulsée) ─► filtre ─► atténuation sous la voix (−8 dB) ─► bus musique ─► pano ─┤─► master (volume) ─► limiteur ─► sortie stéréo L/R
//   effets (bips, servos, fiches) ─► bus effets ─► pano ─┘
// La voix passe PAR-DESSUS la musique : la boucle continue, baissée de 8 dB (attaque 150 ms, relâche 400 ms) pendant que l'Entité parle.
export const DUCK = { db: -8, gain: Math.pow(10, -8 / 20), attack: 0.15, release: 0.4 };
const SON_KEY = 'entite-son';
try { const s = JSON.parse(localStorage.getItem(SON_KEY) || 'null'); if (s) { muted = !!s.muted; if (typeof s.volume === 'number') volume = Math.max(0, Math.min(1, s.volume)); } } catch { /* privé */ }
const saveSon = () => { try { localStorage.setItem(SON_KEY, JSON.stringify({ muted, volume })); } catch { /* privé */ } };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : volume;
  // limiteur léger : aucun écrêtage quand voix + musique + bips s'additionnent
  limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master.connect(limiter).connect(ac.destination);
  const pan = (v) => { if (!ac.createStereoPanner) return master; const p = ac.createStereoPanner(); p.pan.value = v; p.connect(master); return p; };
  sfxBus = ac.createGain(); sfxBus.connect(pan(0));
  voiceBus = ac.createGain(); voiceBus.gain.value = 1;
  analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
  data = new Uint8Array(analyser.fftSize);
  voiceBus.connect(analyser); voiceBus.connect(pan(0));
  // musique : boucle → filtre → atténuation sous la voix → bus musique → master (donc coupée par le bouton son)
  musicBus = ac.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(pan(0));
  musicDuck = ac.createGain(); musicDuck.connect(musicBus);
  musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 1400; musicLP.Q.value = 0.8; musicLP.connect(musicDuck);
  loadManifest();
  // mobile : le contexte peut naître suspendu ; on le relance au premier geste
  const unlock = () => { if (ac.state === 'suspended') ac.resume(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { passive: true });
  return ac;
}

export function setMuted(m) {
  muted = m; saveSon();
  if (master) master.gain.setTargetAtTime(m ? 0 : volume, ac.currentTime, 0.03);
  if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
  if (m) stopBed();
}
// volume général 0..1 (bus master), gardé avec l'état du bouton son
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v)); saveSon();
  if (master && !muted) master.gain.setTargetAtTime(volume, ac.currentTime, 0.03);
}
export const getVolume = () => volume;
// état du graphe (tests, ?debug=1)
export function audioGraph() {
  return ac ? { state: ac.state, master: +master.gain.value.toFixed(3), duck: +musicDuck.gain.value.toFixed(3), music: +musicBus.gain.value.toFixed(5), ducked: musicStats.sousVoix, speaking, muted, volume, limiter: limiter.threshold.value, panners: !!ac.createStereoPanner } : { state: 'none', muted, volume };
}
export const isMuted = () => muted;
export function setCaptionHandler(fn) { onCaption = fn; }

// niveau de la voix 0..1 (RMS de l'analyseur)
export function voiceLevel() {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(data);
  let s = 0;
  for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
  return Math.min(1, Math.sqrt(s / data.length) * 4.5);
}

// Les effets (clics d'encodeur, servos, fiches banane…) sont dans sfx.js, branchés sur ce bus.
export function bus() { return ac ? { ac, out: sfxBus } : null; }

// ---------- voix (manifeste voix/manifest.json) ----------
// Règle (v0.2.5) : chaque id est joué tout seul. mp3Ready = true → voix/<id>.mp3 (repli synthèse si le fichier
// manque ou échoue). mp3Ready = false → synthèse française de ce morceau, aucun fichier demandé (0 erreur 404).
// Une suite mixte (certains mp3, d'autres pas) enchaîne les deux. Les id consécutifs en synthèse sont dits en une phrase.
// Pas de synthèse possible (ou son coupé) → sous-titre de secours via le gestionnaire de sous-titres.
export const ttsAvailable = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';

// Lit de voix : grondement grave filtré, modulé syllabe par syllabe, envoyé dans l'analyseur (anime l'œil).
function startBed() {
  if (!ac || bed) return;
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 82.4; o2.detune.value = 7;
  f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 1.4;
  g.gain.value = 0.0001;
  o1.connect(f); o2.connect(f); f.connect(g).connect(voiceBus);
  o1.start(); o2.start();
  bed = { o1, o2, f, g, timer: 0 };
  const syll = () => {
    if (!bed) return;
    const t = ac.currentTime, peak = 0.05 + Math.random() * 0.07;
    bed.g.gain.cancelScheduledValues(t);
    bed.g.gain.setTargetAtTime(peak, t, 0.02);
    bed.g.gain.setTargetAtTime(0.01, t + 0.09 + Math.random() * 0.06, 0.05);
    bed.f.frequency.setTargetAtTime(260 + Math.random() * 380, t, 0.04);
    bed.timer = setTimeout(syll, 130 + Math.random() * 110);
  };
  syll();
}
function stopBed() {
  if (!bed) return;
  clearTimeout(bed.timer);
  const b = bed; bed = null;
  const t = ac.currentTime;
  b.g.gain.cancelScheduledValues(t);
  b.g.gain.setTargetAtTime(0.0001, t, 0.08);
  b.o1.stop(t + 0.5); b.o2.stop(t + 0.5);
}

let frVoice = null;
function pickVoice() {
  if (!ttsAvailable()) return null;
  const vs = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
  // voix grave de préférence (noms masculins courants), sinon fr-CA, sinon fr-FR
  frVoice = vs.find((v) => /CA/i.test(v.lang) && /(thomas|nicolas|jean|henri|paul|male|homme)/i.test(v.name))
    || vs.find((v) => /(thomas|nicolas|jean|henri|paul|male|homme)/i.test(v.name))
    || vs.find((v) => /CA/i.test(v.lang)) || vs.find((v) => /FR/i.test(v.lang)) || vs[0] || null;
  return frVoice;
}
if (ttsAvailable()) speechSynthesis.addEventListener?.('voiceschanged', pickVoice);

let speakToken = 0;
let settlePrev = () => {};
const voiceFailed = new Set();
export const voiceLog = []; // [{ ids, mode, lie, t }] pour ?debug=1 et les tests

// speak(['clue_fragment', 'chiffre_4'], { lie }) → Promise résolue à la fin (ou à l'interruption)
export function speak(ids, { lie = false } = {}) {
  if (typeof ids === 'string') ids = [ids];
  const token = ++speakToken;
  if (ttsAvailable()) speechSynthesis.cancel();
  stopBed();
  speaking = true;
  settlePrev(false);
  return new Promise((resolve0) => {
    // une réplique interrompue se résout toujours (false) : la file d'attente d'app.js ne reste jamais bloquée
    let settled = false;
    const resolve = (v) => { if (settled) return; settled = true; if (settlePrev === settleMe) settlePrev = () => {}; resolve0(v); };
    const settleMe = (v) => resolve(v); settlePrev = settleMe;
    const done = () => {
      if (token !== speakToken) { resolve(false); return; }
      speaking = false; stopBed(); duck(false);
      setTimeout(() => token === speakToken && onCaption('', false), 1400);
      resolve(true);
    };
    loadManifest().then(() => {
      if (token !== speakToken) { resolve(false); return; }
      const ready = (id) => !!ac && cue(id)?.mp3Ready === true && !voiceFailed.has(id);
      const allMp3 = ids.length > 0 && ids.every(ready);
      const anyMp3 = ids.some(ready);
      const mode = allMp3 ? 'mp3' : anyMp3 ? 'mix' : (ttsAvailable() && !muted ? 'tts' : 'texte');
      voiceLog.push({ ids: ids.slice(), mode, lie, t: Math.round(performance.now()) });
      playSeq(ids, 0, token, done, lie);
    });
  });
}
function readyMp3(id) { return !!ac && cue(id)?.mp3Ready === true && !voiceFailed.has(id); }
async function playSeq(ids, i, token, done, lie) {
  if (token !== speakToken) return;
  if (i >= ids.length) { done(); return; }
  if (readyMp3(ids[i])) {
    try {
      const buf = await loadVoice(ids[i]);
      if (token !== speakToken) return;
      duck(true);
      voiceStats.fichier++;
      await playBuffer(buf, token);
      playSeq(ids, i + 1, token, done, lie);
    } catch {
      voiceFailed.add(ids[i]);
      if (token === speakToken) speakTTS(sentence([ids[i]]), token, () => playSeq(ids, i + 1, token, done, lie), lie);
    }
    return;
  }
  // id consécutifs sans mp3 : une seule phrase, puis reprise (le suivant peut être un fichier)
  let j = i + 1;
  while (j < ids.length && !readyMp3(ids[j])) j++;
  speakTTS(sentence(ids.slice(i, j)), token, () => playSeq(ids, j, token, done, lie), lie);
}
let voiceFast = false;
// ?debug=1&voix=rapide : tests seulement — pas de synthèse, la réplique « dure » quelques ms (le journal voiceLog reste complet)
export function setVoiceFast(on) { voiceFast = !!on; }
function speakTTS(text, token, done, lie) {
  voiceStats.synthese++;
  if (voiceFast) { setTimeout(done, 30 + text.length * 2); return; }
  const est = 1200 + text.length * 75;
  let fallback = setTimeout(done, est);
  // secours silencieux : pas de synthèse sur l'appareil, ou son coupé → sous-titre court
  if (!ttsAvailable() || muted) { onCaption(text, lie); return; }
  startBed();
  // synthèse : la musique baisse au début réel de l'énoncé (onstart) ; secours si onstart ne vient jamais (certains Android)
  const safety = setTimeout(() => token === speakToken && duck(true), 700);
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => { clearTimeout(safety); if (token === speakToken) duck(true); };
    u.lang = 'fr-CA'; u.voice = frVoice || pickVoice();
    u.pitch = lie ? 0.35 : 0.2; u.rate = lie ? 1.02 : 0.86; u.volume = 1; // grave et calme ; plus pressée quand elle ment
    u.onend = () => { clearTimeout(fallback); clearTimeout(safety); done(); };
    u.onerror = () => { clearTimeout(fallback); clearTimeout(safety); fallback = setTimeout(done, 300); };
    speechSynthesis.speak(u);
  } catch { onCaption(text, lie); }
}

function loadVoice(id) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  return (async () => {
    const url = fileOf(id);
    let ab = await takePreloaded(url);
    if (!ab) { const res = await fetch(url, { cache: 'no-cache' }); if (!res.ok) throw new Error('voix absente'); ab = await res.arrayBuffer(); }
    const buf = await ac.decodeAudioData(ab);
    buffers.set(id, buf);
    return buf;
  })();
}
let curSrc = null;
function playBuffer(buf, token) {
  return new Promise((resolve) => {
    const s = ac.createBufferSource(); s.buffer = buf; s.connect(voiceBus); curSrc = s;
    s.onended = () => { if (curSrc === s) curSrc = null; resolve(); }; s.start();
  });
}

export const isSpeaking = () => speaking;
export function stopVoice() {
  speakToken++; speaking = false; stopBed(); duck(false); settlePrev(false);
  try { curSrc?.stop(); } catch { /* déjà fini */ }
  if (ttsAvailable()) speechSynthesis.cancel();
  onCaption('', false);
}

// ---------- musique de tension ----------
// Boucle MusicGen (audio/tension.mp3) + une couche synthétisée (basse pulsée) qui monte avec l'intensité.
const MUSIC_VOL = 0.42;
const MUSIC_LOOP_S = 16;
export const musicStats = { etat: 'arret', fichier: false, intensite: 0, vitesse: 1, sousVoix: false };
function loadMusic() {
  if (!musicLoad) {
    musicLoad = Promise.resolve(takePreloaded(MUSIC_URL)).then((ab) => ab || fetch(MUSIC_URL).then((r) => { if (!r.ok) throw new Error('musique absente'); return r.arrayBuffer(); }))
      .then((ab) => ac.decodeAudioData(ab)).then((b) => { musicBuf = b; return b; })
      .catch(() => { musicLoad = null; return null; });
  }
  return musicLoad;
}
function duck(on) {
  if (!musicDuck) return;
  const t = ac.currentTime, p = musicDuck.gain;
  // rampes explicites : −8 dB en 150 ms quand la voix démarre, retour à 0 dB en 400 ms quand elle se tait
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
  p.linearRampToValueAtTime(on ? DUCK.gain : 1, t + (on ? DUCK.attack : DUCK.release));
  musicStats.sousVoix = on;
}
export function startMusic() {
  if (!ac) return;
  stopMusic('cut', true);
  const t = ac.currentTime;
  const m = music = { src: null, pulse: null, intensity: -1 };
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(0.0001, t);
  musicBus.gain.exponentialRampToValueAtTime(MUSIC_VOL, t + 2.5);
  musicLP.frequency.setValueAtTime(1400, t);
  // couche synthétisée : basse en dents de scie, filtrée, hachée par un LFO (pulsation) dont le tempo monte
  const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), trem = ac.createGain();
  const lfo = ac.createOscillator(), lfoAmt = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 41.2; o2.type = 'square'; o2.frequency.value = 82.4; o2.detune.value = -8;
  f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 6;
  lfo.type = 'square'; lfo.frequency.value = 2; lfoAmt.gain.value = 0.5; trem.gain.value = 0.5;
  lfo.connect(lfoAmt).connect(trem.gain);
  g.gain.value = 0.0001;
  o.connect(f); o2.connect(f); f.connect(trem).connect(g).connect(musicLP);
  o.start(t); o2.start(t); lfo.start(t);
  m.pulse = { o, o2, f, g, lfo };
  musicStats.etat = 'joue'; musicStats.fichier = false;
  loadMusic().then((buf) => {
    if (!buf || music !== m) return;
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    // boucle de 16,000 s : si le décodeur garde le délai de l'encodeur MP3 (1105 échantillons), on le saute
    if (buf.duration > MUSIC_LOOP_S + 0.01) { src.loopStart = 1105 / 44100; src.loopEnd = src.loopStart + MUSIC_LOOP_S; }
    src.connect(musicLP); src.start(0, src.loopStart || 0);
    m.src = src; musicStats.fichier = true;
    setMusicIntensity(Math.max(0, m.intensity), true);
  });
  setMusicIntensity(0, true);
}
// x = 0 (calme) .. 1 (dernières secondes)
export function setMusicIntensity(x, force = false) {
  const m = music;
  if (!m || !ac) return;
  const q = Math.round(x * 50) / 50;
  if (!force && q === m.intensity) return;
  m.intensity = q;
  const t = ac.currentTime, k = 0.6;
  const rate = 1 + 0.14 * q; // tempo de la boucle : +14 % au maximum
  if (m.src) m.src.playbackRate.setTargetAtTime(rate, t, k);
  musicLP.frequency.setTargetAtTime(1400 + 9000 * q * q, t, k); // le filtre s'ouvre
  const p = m.pulse;
  p.g.gain.setTargetAtTime(0.02 + 0.2 * q, t, k);
  p.lfo.frequency.setTargetAtTime(2 + 6 * q, t, k); // pulsation 2 → 8 Hz
  p.f.frequency.setTargetAtTime(220 + 900 * q, t, k);
  musicStats.intensite = q; musicStats.vitesse = rate;
}
// 'fade' = fondu lent (victoire), 'cut' = coupure rapide (explosion)
export function stopMusic(kind = 'fade', silent = false) {
  const m = music;
  if (!m || !ac) return;
  music = null;
  const t = ac.currentTime, dur = kind === 'fade' ? 3 : 0.12;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), t);
  musicBus.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const end = t + dur + 0.05;
  try { m.src?.stop(end); m.pulse.o.stop(end); m.pulse.o2.stop(end); m.pulse.lfo.stop(end); } catch { /* déjà arrêté */ }
  if (!silent) musicStats.etat = kind === 'fade' ? 'fondu' : 'coupee';
}
