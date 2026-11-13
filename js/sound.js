/* 글의 바다 — a sea of words
   sound.js : everything you hear is synthesised here, and nothing sounds until
   the visitor chooses it. There is no background sound: the night is quiet, and
   something is heard only when something happens. Each letter is a note, so every
   word has a melody; a whale, rain, wind or fire bring their own sound with them. */
(function () {
  'use strict';
  const D = window.Dream;
  const S = (D.Sound = { on: false, muted: true, ctx: null, motifs: [] });

  let ctx = null, master = null, dry = null, verb = null, wet = null;
  const weather = {};
  const SCALE = [0, 2, 4, 7, 9];          // D major pentatonic: no two notes can quarrel
  const ROOT = 293.66;                    // D4

  function noteIndex(ch) {
    let code = 0;
    for (let i = 0; i < ch.length; i++) code = (code * 31 + ch.charCodeAt(i)) >>> 0;
    return (code * 7 + 3) % 15;
  }
  function freqOf(idx) {
    return ROOT * Math.pow(2, (Math.floor(idx / 5) * 12 + SCALE[idx % 5]) / 12);
  }

  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }
  function noise(sec, brown) {
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    const edge = Math.min(n >> 1, Math.floor(ctx.sampleRate * 0.06));    // soften the loop seam
    for (let i = 0; i < edge; i++) { const k = i / edge; d[i] *= k; d[n - 1 - i] *= k; }
    return buf;
  }

  function bell(f, vel, when, dur) {
    if (!ctx || S.muted) return;
    const t = Math.max(ctx.currentTime + 0.005, when || 0);
    const len = dur || 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.16 * vel), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine'; o2.frequency.value = f * 2.005;
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    const o3 = ctx.createOscillator();
    o3.type = 'sine'; o3.frequency.value = f * 3.01;
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.12, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
    g.connect(dry); g.connect(verb);
    const end = t + len + 0.1;
    o1.start(t); o2.start(t); o3.start(t);
    o1.stop(end); o2.stop(end); o3.stop(end);
  }

  /* ---------------------------------------------------------------- public */
  /* two soft notes, once: the only sign that sound is on, now that nothing plays by itself */
  function hello() {
    if (!ctx || S.muted) return;
    const t = ctx.currentTime + 0.3;
    bell(freqOf(5), 0.22, t, 2.4);
    bell(freqOf(8), 0.18, t + 0.24, 2.8);
  }

  S.start = function () {
    if (ctx) { S.setMuted(false); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    S.ctx = ctx;
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.3;
    master.connect(comp); comp.connect(ctx.destination);
    dry = ctx.createGain();
    dry.gain.value = 0.85; dry.connect(master);
    verb = ctx.createConvolver();
    verb.buffer = impulse(3.4, 2.3);
    wet = ctx.createGain();
    wet.gain.value = 0.6;
    verb.connect(wet); wet.connect(master);
    S.on = true; S.muted = false;
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.06);
    if (ctx.state === 'suspended') ctx.resume();
    if (D.UI) D.UI.soundState(true);
    hello();
  };

  S.setMuted = function (m) {
    if (!ctx) return;
    S.muted = !!m;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, m ? 0.15 : 0.06);
    if (!m && ctx.state === 'suspended') ctx.resume();
    if (D.UI) D.UI.soundState(!m);
    if (!m) hello();
  };
  S.toggle = function () {
    if (!ctx) S.start();
    else S.setMuted(!S.muted);
  };

  /* one letter, one note: heard while typing */
  S.note = function (ch) {
    if (!ctx || S.muted || !ch) return;
    bell(freqOf(noteIndex(ch)), 0.32, 0, 1.6);
  };

  /* a whole word: its letters in order, then a low note to set it down */
  S.word = function (word) {
    const parts = D.Lex.graphemes(String(word)).filter((c) => !/^\s+$/.test(c)).slice(0, 24);
    if (!parts.length) return;
    const idx = parts.map(noteIndex);
    S.motifs.push(idx);
    if (S.motifs.length > 40) S.motifs.shift();
    if (!ctx || S.muted) return;
    const t0 = ctx.currentTime + 0.05;
    const step = parts.length > 10 ? 0.085 : 0.115;
    idx.forEach((n, i) => bell(freqOf(n), 0.5, t0 + i * step, 2.6));
    const last = idx[idx.length - 1];
    bell(freqOf(last % 5) / 2, 0.4, t0 + idx.length * step + 0.05, 3.6);
  };

  function makeWeather(name) {
    const g = ctx.createGain();
    g.gain.value = 0;
    const w = { gain: g, level: 0, max: 0.05 };
    const src = ctx.createBufferSource();
    src.loop = true;
    if (name === 'rain') {
      src.buffer = noise(3, false);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2300;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8200;
      src.connect(hp); hp.connect(lp); lp.connect(g);
      w.max = 0.05;
    } else if (name === 'wind') {
      src.buffer = noise(6, true);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 430; bp.Q.value = 1.1;
      const l = ctx.createOscillator(); l.frequency.value = 0.17;
      const lg = ctx.createGain(); lg.gain.value = 210;
      l.connect(lg); lg.connect(bp.frequency); l.start();
      src.connect(bp); bp.connect(g);
      w.max = 0.2;
    } else {
      // fire: a soft hiss, and small cracks at uneven moments
      const sec = 4, n = Math.floor(ctx.sampleRate * sec);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.12;
      for (let k = 0; k < 46; k++) {
        const at = Math.floor(Math.random() * (n - 900));
        const amp = 0.3 + Math.random() * 0.7;
        for (let i = 0; i < 700; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / 90);
      }
      src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.6;
      src.connect(bp); bp.connect(g);
      w.max = 0.09;
    }
    g.connect(dry);
    src.start();
    return w;
  }
  /* rain, wind and fire rise and fall with the thing itself */
  S.weather = function (name, level) {
    if (!ctx) return;
    let w = weather[name];
    if (!w) {
      if (level <= 0.01) return;
      w = weather[name] = makeWeather(name);
    }
    if (Math.abs(level - w.level) < 0.03 && !(level === 0 && w.level !== 0)) return;
    w.level = level;
    w.gain.gain.setTargetAtTime(level * w.max, ctx.currentTime, 0.5);
  };

  S.whale = function () {
    if (!ctx || S.muted) return;
    const t = ctx.currentTime + 0.05;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = o.frequency;
    f.setValueAtTime(150, t);
    f.exponentialRampToValueAtTime(262, t + 1.3);
    f.exponentialRampToValueAtTime(176, t + 2.4);
    f.exponentialRampToValueAtTime(330, t + 3.3);
    f.exponentialRampToValueAtTime(147, t + 5.0);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = 5;
    vib.connect(vg); vg.connect(f);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085, t + 0.7);
    g.gain.setValueAtTime(0.085, t + 3.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.2);
    const send = ctx.createGain();
    send.gain.value = 1.4;
    o.connect(g); g.connect(dry); g.connect(send); send.connect(verb);
    o.start(t); vib.start(t); o.stop(t + 5.4); vib.stop(t + 5.4);
  };

  S.splash = function (power) {
    if (!ctx || S.muted) return;
    const t = ctx.currentTime + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = noise(1.4, false);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11 * Math.min(1.5, power), t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(lp); lp.connect(g); g.connect(dry); g.connect(verb);
    src.start(t); src.stop(t + 1.4);
  };

  S.drop = function () {
    if (!ctx || S.muted) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(dry); g.connect(verb);
    o.start(t); o.stop(t + 0.6);
  };
  S.star = function () {
    if (!ctx || S.muted) return;
    bell(freqOf(10 + ((Math.random() * 5) | 0)), 0.42, 0, 3);
  };

  S.chirp = function () {
    if (!ctx || S.muted) return;
    const t0 = ctx.currentTime + 0.02;
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.13;
      const base = 2300 + Math.random() * 1300;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 1.1, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.022, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g); g.connect(dry); g.connect(verb);
      o.start(t); o.stop(t + 0.13);
    }
  };

  /* something growing: a few notes climbing */
  S.grow = function () {
    if (!ctx || S.muted) return;
    const t0 = ctx.currentTime + 0.9;
    [0, 2, 4, 5, 7, 9, 10, 12].forEach((n, i) => bell(freqOf(n), 0.3, t0 + i * 0.42, 2.4));
  };

  /* a longer line, wandering up and down the scale */
  S.melody = function () {
    if (!ctx || S.muted) return;
    let t = ctx.currentTime + 0.6, n = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < 34; i++) {
      n += [-2, -1, -1, 1, 1, 2, 3, -3][(Math.random() * 8) | 0];
      if (n < 1) n = 2;
      if (n > 13) n = 11;
      const long = Math.random() < 0.3;
      bell(freqOf(n), 0.34, t, long ? 3.2 : 2.2);
      if (i % 4 === 0) bell(freqOf(n % 5) / 2, 0.22, t, 4);
      t += long ? 0.9 : 0.45;
    }
  };

  /* morning: whatever weather was sounding stops, and the night's words are played back, quietly */
  S.dawn = function () {
    if (!ctx) return;
    const t = ctx.currentTime;
    Object.keys(weather).forEach((k) => S.weather(k, 0));
    if (S.muted) return;
    let at = t + 12.5;
    S.motifs.slice(-12).forEach((m) => {
      m.slice(0, 8).forEach((n, i) => bell(freqOf(n), 0.26, at + i * 0.13, 2.6));
      at += Math.min(8, m.length) * 0.13 + 0.75;
    });
  };

  /* night again */
  S.night = function () {
    S.motifs.length = 0;
  };

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!S.muted) ctx.resume();
  });
})();
