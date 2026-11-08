// Procedural WebAudio engine: positional (HRTF) SFX, synthesized weapons, ambience beds, music stingers.

class AudioEngine {
  constructor() { this.ctx = null; this.voices = 0; this.maxVoices = 40; this.vol = { master: 0.8, sfx: 0.9, music: 0.5, ambience: 0.7 }; this.amb = null; this.listenerPos = { x: 0, y: 0, z: 0 }; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(this.comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.ui = ctx.createGain(); this.ui.connect(this.master);
    // shared noise buffers
    const len = ctx.sampleRate * 2; const white = ctx.createBuffer(1, len, ctx.sampleRate); const w = white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate); const b = brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.white = white; this.brown = brown;
    // small convolution reverb for body
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir; this.revGain = ctx.createGain(); this.revGain.gain.value = 0.18; this.reverb.connect(this.revGain); this.revGain.connect(this.sfx);
    this.applyVolumes();
  }
  get ready() { return !!this.ctx; }
  setVolumes(s) { this.vol = { master: s.master, sfx: s.sfx, music: s.music, ambience: s.ambience }; this.applyVolumes(); }
  applyVolumes() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.vol.master, t, 0.05); this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05); this.ui.gain.setTargetAtTime(this.vol.sfx, t, 0.05); this.music.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.05); this.ambBus.gain.setTargetAtTime(this.vol.ambience, t, 0.05); }

  setListener(pos, fwd) {
    if (!this.ctx) return; const L = this.ctx.listener; this.listenerPos = pos;
    if (L.positionX) { const t = this.ctx.currentTime; L.positionX.setValueAtTime(pos.x, t); L.positionY.setValueAtTime(pos.y, t); L.positionZ.setValueAtTime(pos.z, t); L.forwardX.setValueAtTime(fwd.x, t); L.forwardY.setValueAtTime(fwd.y, t); L.forwardZ.setValueAtTime(fwd.z, t); L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t); }
    else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }

  // Output node for a sound at world position (or UI if pos null). Returns {node, dist} or null when voice budget is exhausted.
  out(pos, ref = 4, max = 400, bus = this.sfx) {
    if (!this.ctx || this.voices >= this.maxVoices) return null;
    if (!pos) return { node: bus, dist: 0 };
    const dx = pos.x - this.listenerPos.x, dy = pos.y - this.listenerPos.y, dz = pos.z - this.listenerPos.z; const dist = Math.hypot(dx, dy, dz);
    if (dist > max) return null;
    const p = this.ctx.createPanner(); p.panningModel = this.lowQuality ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = max;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    // air absorption: distant sounds lose highs
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 16000 / (1 + dist / 25));
    lp.connect(p); p.connect(bus); return { node: lp, dist };
  }
  track(src, dur) { this.voices++; const done = () => { this.voices = Math.max(0, this.voices - 1); }; src.onended = done; setTimeout(() => {}, 0); }

  noise(buf, t, dur, node, { type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.002, decay, sweepTo, rate = 1 } = {}) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + (decay ?? dur));
    s.connect(f); f.connect(g); g.connect(node); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); this.track(s); return g;
  }
  tone(t, dur, node, { type = 'sine', freq = 440, to, gain = 0.5, attack = 0.003 } = {}) {
    const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(node); o.start(t); o.stop(t + dur + 0.05); this.track(o); return o;
  }

  // ---------- Weapons ----------
  gunshot(snd, pos, { local = false, suppressed = false } = {}) {
    const o = this.out(local ? null : pos, 8, 420); if (!o) return; const t = this.ctx.currentTime; const n = o.node;
    const v = (local ? 0.55 : 1.0) * (suppressed ? 0.35 : 1); const p = snd.pitch * (0.96 + Math.random() * 0.08);
    if (snd.thump) { this.tone(t, 0.25, n, { type: 'sine', freq: 140 * p, to: 40, gain: 0.8 * v }); this.noise(this.white, t, 0.3, n, { type: 'lowpass', freq: 900, gain: 0.5 * v, decay: 0.3 }); return; }
    if (!suppressed) this.noise(this.white, t, 0.06, n, { type: 'bandpass', freq: 2600 * p, q: 0.7, gain: snd.crack * 0.9 * v, decay: 0.05 });
    this.noise(this.white, t, 0.12, n, { type: 'lowpass', freq: (suppressed ? 1400 : 4200) * p, gain: 0.7 * v, decay: 0.09 });
    this.tone(t, 0.14, n, { type: 'triangle', freq: snd.body * p, to: snd.body * 0.45, gain: 0.55 * v });
    const tail = this.noise(this.brown, t + 0.01, snd.tail + 0.15, n, { type: 'lowpass', freq: suppressed ? 500 : 1100, gain: 0.55 * v * (local ? 1 : 1.3), attack: 0.01, decay: snd.tail + 0.1 });
    if (!local && o.dist > 30 && this.reverb) tail.connect(this.reverb);
    if (local && this.reverb) tail.connect(this.reverb);
  }
  dryFire() { const o = this.out(null); if (!o) return; const t = this.ctx.currentTime; this.noise(this.white, t, 0.03, o.node, { type: 'highpass', freq: 3000, gain: 0.3 }); }
  reload(stage, pos = null) {
    const o = this.out(pos, 2, 30); if (!o) return; const t = this.ctx.currentTime;
    const f = { out: 1800, in: 2400, rack: 1200, shell: 2000, bolt: 1500 }[stage] || 2000;
    this.noise(this.white, t, 0.05, o.node, { type: 'bandpass', freq: f, q: 4, gain: 0.5 }); this.tone(t, 0.05, o.node, { type: 'square', freq: f / 6, gain: 0.08 });
    if (stage === 'rack' || stage === 'bolt') this.noise(this.white, t + 0.08, 0.06, o.node, { type: 'bandpass', freq: f * 1.4, q: 3, gain: 0.45 });
  }
  melee(pos) { const o = this.out(pos, 2, 40); if (!o) return; const t = this.ctx.currentTime; this.noise(this.white, t, 0.18, o.node, { type: 'bandpass', freq: 900, sweepTo: 3000, q: 2, gain: 0.5 }); }
  footstep(surface, pos, local) {
    const o = this.out(local ? null : pos, 2, 45); if (!o) return; const t = this.ctx.currentTime; const v = local ? 0.18 : 0.6;
    const f = { sand: 500, wood: 900, metal: 2200, concrete: 1300, grass: 600, water: 700 }[surface] || 1100;
    this.noise(surface === 'water' ? this.white : this.brown, t, 0.09, o.node, { type: 'bandpass', freq: f * (0.9 + Math.random() * 0.2), q: surface === 'metal' ? 6 : 1.2, gain: v, decay: 0.08 });
    if (surface === 'wood' || surface === 'metal') this.tone(t, 0.06, o.node, { type: 'sine', freq: surface === 'metal' ? 420 : 140, gain: v * 0.3 });
  }
  impact(kind, pos) {
    const o = this.out(pos, 2, 90); if (!o) return; const t = this.ctx.currentTime;
    if (kind === 'flesh') { this.noise(this.brown, t, 0.08, o.node, { type: 'lowpass', freq: 600, gain: 0.7 }); this.tone(t, 0.06, o.node, { freq: 180, to: 90, gain: 0.3 }); }
    else if (kind === 'metal') { this.tone(t, 0.25, o.node, { type: 'triangle', freq: 1800 + Math.random() * 1200, to: 1400, gain: 0.15 }); this.noise(this.white, t, 0.04, o.node, { type: 'highpass', freq: 3000, gain: 0.3 }); }
    else if (kind === 'water') this.noise(this.white, t, 0.25, o.node, { type: 'bandpass', freq: 1200, sweepTo: 400, gain: 0.4 });
    else this.noise(this.white, t, 0.05, o.node, { type: 'bandpass', freq: 1500 + Math.random() * 1500, q: 1.5, gain: 0.35 });
  }
  whiz(pos) { const o = this.out(pos, 1, 20); if (!o) return; const t = this.ctx.currentTime; this.noise(this.white, t, 0.12, o.node, { type: 'bandpass', freq: 3500, sweepTo: 1600, q: 8, gain: 0.5 }); }
  explosion(pos) {
    const o = this.out(pos, 10, 600); if (!o) return; const t = this.ctx.currentTime;
    this.tone(t, 0.9, o.node, { freq: 90, to: 28, gain: 1.0 }); this.noise(this.brown, t, 1.6, o.node, { type: 'lowpass', freq: 1400, sweepTo: 200, gain: 1.0, decay: 1.5 });
    this.noise(this.white, t, 0.3, o.node, { type: 'lowpass', freq: 5000, gain: 0.7 });
    if (this.reverb) this.noise(this.brown, t, 1.2, this.reverb, { type: 'lowpass', freq: 800, gain: 0.8 });
  }
  glass(pos) { const o = this.out(pos, 3, 80); if (!o) return; const t = this.ctx.currentTime; for (let i = 0; i < 7; i++) this.tone(t + i * 0.025 + Math.random() * 0.02, 0.18, o.node, { type: 'triangle', freq: 2500 + Math.random() * 3000, gain: 0.08 }); this.noise(this.white, t, 0.35, o.node, { type: 'highpass', freq: 2500, gain: 0.4 }); }
  carAlarm(pos) {
    const o = this.out(pos, 6, 160); if (!o) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 10; i++) this.tone(t + i * 0.35, 0.3, o.node, { type: 'square', freq: i % 2 ? 900 : 1300, gain: 0.1 });
  }
  grenadePin(pos) { const o = this.out(pos, 2, 30); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.06, o.node, { type: 'square', freq: 2600, gain: 0.06 }); }
  bounce(pos) { const o = this.out(pos, 2, 40); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.05, o.node, { type: 'triangle', freq: 600, gain: 0.15 }); }
  smoke(pos) { const o = this.out(pos, 4, 60); if (!o) return; const t = this.ctx.currentTime; this.noise(this.white, t, 2.5, o.node, { type: 'highpass', freq: 1500, gain: 0.25, attack: 0.1, decay: 2.5 }); }
  heal(pos) { const o = this.out(pos, 2, 25); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.3, o.node, { freq: 520, to: 780, gain: 0.12 }); }
  pickup() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.08, o.node, { type: 'triangle', freq: 700, gain: 0.2 }); this.tone(t + 0.06, 0.1, o.node, { type: 'triangle', freq: 1050, gain: 0.2 }); }
  crate() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.07, 0.25, o.node, { type: 'triangle', freq: f, gain: 0.15 })); }
  // ---------- UI / feedback ----------
  hitmarker(head) { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.05, o.node, { type: 'square', freq: head ? 1800 : 1300, gain: 0.08 }); if (head) this.tone(t + 0.03, 0.12, o.node, { type: 'sine', freq: 2600, gain: 0.12 }); }
  killConfirm() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.14, o.node, { type: 'sine', freq: 300, to: 180, gain: 0.35 }); this.tone(t + 0.02, 0.2, o.node, { type: 'triangle', freq: 880, gain: 0.15 }); }
  hurt() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.noise(this.brown, t, 0.15, o.node, { type: 'lowpass', freq: 400, gain: 0.6 }); }
  click() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.04, o.node, { type: 'triangle', freq: 1200, gain: 0.08 }); }
  hover() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.03, o.node, { type: 'sine', freq: 2000, gain: 0.025 }); }
  beep(high) { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; this.tone(t, 0.12, o.node, { type: 'square', freq: high ? 1320 : 880, gain: 0.07 }); }
  levelUp() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.08, 0.35, o.node, { type: 'triangle', freq: f, gain: 0.14 })); }
  zoneWarn() { const o = this.out(null, 1, 1, this.ui); if (!o) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.tone(t + i * 0.3, 0.22, o.node, { type: 'sawtooth', freq: 440, to: 330, gain: 0.06 }); }

  // ---------- Music ----------
  stinger(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime + 0.05; const n = this.music;
    const seq = kind === 'victory' ? [[523, 0, 0.3], [659, 0.15, 0.3], [784, 0.3, 0.3], [1046, 0.45, 0.9], [784, 0.45, 0.9], [659, 0.45, 0.9]] : [[440, 0, 0.5], [415, 0.4, 0.5], [392, 0.8, 0.5], [349, 1.2, 1.4]];
    for (const [f, d, len] of seq) { this.tone(t + d, len, n, { type: 'sawtooth', freq: f, gain: 0.12, attack: 0.02 }); this.tone(t + d, len, n, { type: 'triangle', freq: f / 2, gain: 0.15, attack: 0.02 }); }
  }
  startMenuMusic() {
    if (!this.ctx || this.menuMusic) return; const c = this.ctx;
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
    const out = c.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(0.5, c.currentTime + 2); out.connect(this.music);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
    let step = 0; const play = () => {
      const t = c.currentTime + 0.05; const ch = chords[step % chords.length];
      for (const f of ch) for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 0.8); g.gain.linearRampToValueAtTime(0.0, t + 4); o.connect(g); g.connect(lp); o.start(t); o.stop(t + 4.1); }
      const b = c.createOscillator(); b.type = 'triangle'; b.frequency.value = ch[0] / 2; const bg = c.createGain(); bg.gain.setValueAtTime(0.12, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 3.8); b.connect(bg); bg.connect(out); b.start(t); b.stop(t + 4);
      for (let k = 0; k < 8; k++) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = ch[k % 3] * 2; const g = c.createGain(); const tt = t + k * 0.5; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.03, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.45); o.connect(g); g.connect(out); o.start(tt); o.stop(tt + 0.5); }
      step++;
    };
    play(); this.menuMusic = { timer: setInterval(play, 4000), out };
  }
  stopMenuMusic() { if (!this.menuMusic) return; clearInterval(this.menuMusic.timer); const o = this.menuMusic.out; o.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4); setTimeout(() => o.disconnect(), 2000); this.menuMusic = null; }

  // ---------- Ambience ----------
  startAmbience(kind) {
    this.stopAmbience(); if (!this.ctx) return; const c = this.ctx; const nodes = []; const timers = [];
    const bed = (buf, type, freq, gain, lfoRate = 0, lfoDepth = 0) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(this.ambBus); s.start();
      if (lfoRate) { const l = c.createOscillator(); l.frequency.value = lfoRate; const lg = c.createGain(); lg.gain.value = lfoDepth; l.connect(lg); lg.connect(g.gain); l.start(); nodes.push(l); }
      nodes.push(s); return g;
    };
    const around = (d) => { const a = Math.random() * Math.PI * 2; const p = this.listenerPos; return { x: p.x + Math.cos(a) * d, y: p.y + 5, z: p.z + Math.sin(a) * d }; };
    const every = (min, max, fn) => { const loop = () => { fn(); timers.push(setTimeout(loop, (min + Math.random() * (max - min)) * 1000)); }; timers.push(setTimeout(loop, min * 1000)); };
    if (kind === 'beach') {
      bed(this.brown, 'lowpass', 500, 0.35, 0.13, 0.25); bed(this.white, 'bandpass', 700, 0.05, 0.09, 0.04); bed(this.brown, 'bandpass', 300, 0.08, 0.05, 0.05);
      every(4, 10, () => { const o = this.out(around(40 + Math.random() * 40), 10, 300, this.ambBus); if (!o) return; const t = c.currentTime; for (let i = 0; i < 2 + Math.random() * 3; i++) this.tone(t + i * 0.22, 0.2, o.node, { type: 'sawtooth', freq: 1800 + Math.random() * 400, to: 1100, gain: 0.05 }); });
      every(6, 12, () => { const o = this.out(around(30), 10, 300, this.ambBus); if (!o) return; this.noise(this.white, c.currentTime, 2.5, o.node, { type: 'lowpass', freq: 1200, sweepTo: 300, gain: 0.3, attack: 0.8, decay: 2.4 }); });
    } else if (kind === 'city') {
      bed(this.brown, 'lowpass', 220, 0.45, 0.07, 0.1); bed(this.white, 'bandpass', 1800, 0.012, 0.3, 0.008);
      every(3, 7, () => { const o = this.out(around(60 + Math.random() * 60), 10, 400, this.ambBus); if (!o) return; this.noise(this.brown, c.currentTime, 2.2, o.node, { type: 'bandpass', freq: 300, sweepTo: 160, q: 1.5, gain: 0.6, attack: 0.9, decay: 2.1 }); });
      every(8, 18, () => { const o = this.out(around(90), 10, 400, this.ambBus); if (!o) return; const t = c.currentTime; this.tone(t, 0.35, o.node, { type: 'square', freq: 392, gain: 0.04 }); this.tone(t, 0.35, o.node, { type: 'square', freq: 494, gain: 0.04 }); });
      every(20, 45, () => { const o = this.out(around(160), 20, 600, this.ambBus); if (!o) return; const t = c.currentTime; for (let i = 0; i < 6; i++) this.tone(t + i * 0.9, 0.9, o.node, { type: 'sine', freq: 650, to: 1150, gain: 0.05 }); });
      every(5, 11, () => { const o = this.out(around(25 + Math.random() * 25), 6, 200, this.ambBus); if (!o) return; const t = c.currentTime; for (let i = 0; i < 6; i++) this.noise(this.white, t + i * 0.18 + Math.random() * 0.1, 0.15, o.node, { type: 'bandpass', freq: 500 + Math.random() * 1200, q: 5, gain: 0.05, attack: 0.03 }); });
    }
    this.amb = { nodes, timers };
  }
  stopAmbience() { if (!this.amb) return; for (const n of this.amb.nodes) try { n.stop(); } catch (e) { /* already stopped */ } for (const t of this.amb.timers) clearTimeout(t); this.amb = null; }
}

export const audio = new AudioEngine();
