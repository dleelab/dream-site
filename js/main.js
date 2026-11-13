/* 글의 바다 — a sea of words
   main.js : the order of the night — threshold, night, waking, letter —
   and the loop that keeps it moving. */
(function () {
  'use strict';
  const D = window.Dream, U = D.U, R = D.R, A = D.Atlas, Wd = D.World, L = D.Lex;
  const qs = new URLSearchParams(location.search);

  const SANS = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Helvetica Neue", Arial, sans-serif';

  D.state = 'threshold';
  D.reduced = false;
  D.motion = 1;
  D.reducedManual = false;
  D.setReduced = function (on, manual) {
    D.reduced = !!on;
    D.motion = on ? 0.3 : 1;
    if (manual) D.reducedManual = true;
    document.body.classList.toggle('calm', !!on);
    const box = document.getElementById('calm');
    if (box) box.checked = !!on;
  };

  function freshNight() {
    return { p: 0, words: [], spin: 0, spinTarget: 0, predawnSaid: false, t: 0 };
  }
  D.night = freshNight();
  D.stats = { ms: 16.7, fps: 60, worst: 16.7, frames: 0, glyphs: 0, quality: 1 };

  /* a night someone kept travels in the address, after the # */
  function parseHash() {
    const h = location.hash || '';
    if (h.indexOf('#n=') !== 0) return [];
    const out = [];
    h.slice(3).split('~').forEach((s) => {
      try {
        const w = L.clean(decodeURIComponent(s));
        if (w) out.push(w);
      } catch (e) { /* a broken address is simply an empty night */ }
    });
    return out.slice(0, 24);
  }
  D.hashFor = function (words) {
    return '#n=' + words.map((w) => encodeURIComponent(w)).join('~');
  };

  /* ---------------------------------------------------------------- flow */
  const Flow = (D.Flow = { t: 0, revealT: -1, wakeT: -1, letterShown: false, replay: [], replayClock: 0 });

  Flow.enter = function (withSound) {
    if (D.state !== 'threshold') return;
    D.state = 'night';
    Flow.revealT = 0;
    Wd.reveal.x = Wd.ptr.x;
    Wd.reveal.y = Wd.ptr.y;
    if (withSound && D.Sound) D.Sound.start();
    Flow.replay = (D.kept || []).slice();
    Flow.replayClock = 6.5;
    if (D.UI) D.UI.onEnter(Flow.replay.length > 0);
  };

  /* a word is given: look it up, say what it is, build it */
  Flow.give = function (raw, quiet) {
    if (D.state !== 'night') return false;
    const hit = L.lookup(raw);
    if (!hit) return false;
    A.ensure(hit.display);
    const N = D.night;
    N.words.push(hit.display);
    if (N.words.length > 60) N.words.shift();
    N.p = Math.min(0.86, N.p + 0.05);
    if (D.Sound) D.Sound.word(hit.display);
    if (D.UI && !quiet) D.UI.define(hit);
    if (D.Things) D.Things.spawn(hit);
    return true;
  };

  Flow.wake = function () {
    if (D.state !== 'night') return;
    D.state = 'waking';
    Flow.wakeT = 0;
    Flow.letterShown = false;
    Flow.released = false;
    Flow.replay = [];
    D.snapWanted = true;                 // keep the last frame of the night
    if (D.UI) D.UI.onWake();
    if (D.Things) D.Things.onWake();
    if (D.Sound) D.Sound.dawn();
  };

  Flow.again = function () {
    Wd.dawn = 0; Wd.paper = 0; Wd.ink = 0; Wd.calm = 0; Wd.fade = 1; Wd.pre = 0;
    Wd.wakeCam = 0; Wd.lensOn = 1; Wd.lightOn = 1; Wd.companion = 0; Wd.lightSize = 1;
    Wd.moonBoost = 1; Wd.moonSize = 1; Wd.moonHalo = 0; Wd.starBoostTarget = 1; Wd.aur = 0;
    Wd.windTarget = 0; Wd.gust = 0; Wd.flightTarget = 0; Wd.flight = 0; Wd.skyAngle = 0;
    D.night = freshNight();
    Flow.wakeT = -1; Flow.letterShown = false; Flow.replay = [];
    D.snapshot = null;
    if (D.Things) D.Things.clear();
    D.state = 'night';
    Flow.revealT = 0;
    Wd.reveal.x = Wd.ptr.x; Wd.reveal.y = Wd.ptr.y;
    if (D.Sound) D.Sound.night();
    if (D.UI) D.UI.onAgain();
  };

  function nightTick(dt) {
    const N = D.night;
    N.t += dt;
    N.p = Math.min(0.86, N.p + dt / 560);
    N.spin += (N.spinTarget - N.spin) * (1 - Math.exp(-dt * 0.45));
    Wd.skyAngle = N.p * 0.42 + N.spin;
    Wd.pre = U.smooth(0.5, 0.86, N.p) * 0.8;
    if (!N.predawnSaid && N.p > 0.62) {
      N.predawnSaid = true;
      if (D.UI) D.UI.predawn();
    }
    if (Flow.replay.length) {
      Flow.replayClock -= dt;
      if (Flow.replayClock <= 0) {
        Flow.give(Flow.replay.shift(), false);
        Flow.replayClock = 4.2;
      }
    }
  }

  function wakeTick(dt) {
    Flow.wakeT += dt;
    const t = Flow.wakeT;
    Wd.dawn = U.smooth(0, 6.5, t);
    Wd.pre *= Math.exp(-dt * 0.6);
    Wd.windTarget = 0;
    Wd.flightTarget = 0;
    Wd.calm = U.smooth(2.5, 8.5, t) * 0.93;
    Wd.lensOn = 1 - U.smooth(1, 4, t);
    Wd.lightOn = 1 - U.smooth(5, 8.5, t);
    Wd.wakeCam = D.reduced ? 0 : U.clamp((t - 3.2) / 7.6, 0, 1);
    Wd.ink = U.smooth(4.2, 8, t);
    Wd.paper = U.smooth(7, 11, t);
    Wd.fade = 1 - U.smooth(11, 15.5, t) * 0.92;   // the sea stays on the page as a watermark
    if (t > 5.4 && !Flow.released) { Flow.released = true; if (D.Things) D.Things.releaseAll(); }
    if (t > 11.6 && !Flow.letterShown) {
      Flow.letterShown = true;
      D.state = 'letter';
      if (D.UI) D.UI.showLetter();
    }
    if (t > 17) Flow.wakeT = -1;
  }

  Flow.update = function (dt) {
    Flow.t += dt;
    const rv = Wd.reveal;
    if (D.state === 'threshold') {
      if (!Wd.ptr.seen && !D.reduced) {
        // until a hand arrives, the light drifts a little on its own
        Wd.ptr.tx = 0.34 * Math.sin(Flow.t * 0.31);
        Wd.ptr.ty = 0.12 + 0.22 * Math.sin(Flow.t * 0.23 + 1);
      }
      rv.x = Wd.ptr.x; rv.y = Wd.ptr.y;
      rv.r = (Wd.small ? 0.6 : 0.52) + (D.reduced ? 0 : 0.02 * Math.sin(Flow.t * 1.3));
      rv.soft = 0.44; rv.bright = 0.14;
    } else if (Flow.revealT >= 0) {
      Flow.revealT += dt;
      const dur = D.reduced ? 2.4 : 4.8;
      const k = U.clamp(Flow.revealT / dur, 0, 1);
      const e = k * k * (3 - 2 * k);
      rv.r = 0.52 + 5.4 * e * e;
      rv.soft = 0.44 + 0.9 * e;
      rv.bright = U.lerp(0.14, 1, U.smooth(0, 0.8, k));
      if (k >= 1) { Flow.revealT = -1; rv.r = 9; rv.bright = 1; }
    }
    if (D.state === 'night') nightTick(dt);
    if (Flow.wakeT >= 0 && (D.state === 'waking' || D.state === 'letter')) wakeTick(dt);
  };

  /* ---------------------------------------------------------------- loop */
  let last = 0, acc = 0, accN = 0, worstWin = 0, slowWins = 0, spoiled = false;

  function adapt() {
    if (spoiled || D.state === 'letter' || document.visibilityState !== 'visible') { slowWins = 0; return; }
    if (D.stats.ms > 25 && Wd.quality > 0.5) {
      if (++slowWins >= 2) {
        Wd.quality = Math.max(0.5, Wd.quality - 0.25);
        D.stats.quality = Wd.quality;
        slowWins = 0;
        Wd.resize();
      }
    } else slowWins = 0;
  }

  function step(dt) {
    Flow.update(dt);
    Wd.update(dt);
    if (D.Things) D.Things.update(dt);
    if (D.UI) D.UI.update(dt);
    const W = R.W;
    W.reset();
    Wd.emitMoon(W);
    if (D.Things) D.Things.emit(W);
    Wd.emitLight(W);
    D.stats.glyphs = W.n + R.nStatic;
    R.draw(Wd.uniforms());
    if (D.snapWanted) {
      D.snapWanted = false;
      try {
        const c = document.createElement('canvas');
        c.width = R.canvas.width; c.height = R.canvas.height;
        c.getContext('2d').drawImage(R.canvas, 0, 0);
        D.snapshot = c;
      } catch (e) { D.snapshot = null; }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    let ms = now - last;
    last = now;
    if (ms > 120) { spoiled = true; ms = 16.7; }     // the tab was away; do not judge this window
    D.stats.frames++;
    acc += ms; accN++;
    if (ms > worstWin) worstWin = ms;
    if (accN >= 60) {
      D.stats.ms = acc / accN;
      D.stats.fps = 1000 / D.stats.ms;
      D.stats.worst = worstWin;
      adapt();
      acc = 0; accN = 0; worstWin = 0; spoiled = false;
    }
    step(Math.min(ms, 50) / 1000);
  }

  /* for checking the dream without waiting for it: advance it by hand */
  D.errors = [];
  window.addEventListener('error', (e) => { D.errors.push(String(e.message || e)); });
  D.debug = {
    run(seconds, fps) {
      const f = fps || 60, n = Math.round(seconds * f);
      for (let i = 0; i < n; i++) step(1 / f);
      return n;
    },
    bench(n) {
      const gl = R.gl;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { step(1 / 60); gl.finish(); }
      return (performance.now() - t0) / n;
    },
  };

  /* ---------------------------------------------------------------- boot */
  function boot() {
    const canvas = document.getElementById('sky');
    if (!document.documentElement.lang) document.documentElement.lang = 'ko';
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    D.setReduced((mq && mq.matches) || qs.get('motion') === 'reduce');
    if (mq) {
      const fn = (e) => { if (!D.reducedManual) D.setReduced(e.matches); };
      if (mq.addEventListener) mq.addEventListener('change', fn);
      else if (mq.addListener) mq.addListener(fn);
    }
    D.coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    D.lowPower = D.coarse || Math.min(window.innerWidth, window.innerHeight) < 560;
    D.kept = parseHash();

    let ok = false;
    try {
      A.init(qs.get('font') === 'sans' ? SANS : null);
      A.ensure(L.allText());
      ok = R.init(canvas, D.lowPower ? 18000 : 32000);
    } catch (e) {
      console.error(e);
      ok = false;
    }
    if (!ok) {
      document.body.className = 'is-nogl';
      const th = document.getElementById('threshold');
      if (th) th.hidden = true;
      document.getElementById('nogl').hidden = false;
      return;
    }
    Wd.resize();
    Wd.buildStatic();

    let rsTimer = 0;
    const onResize = () => {
      Wd.resize();
      clearTimeout(rsTimer);
      rsTimer = setTimeout(() => Wd.buildStatic(), 160);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    window.addEventListener('hashchange', () => {
      if ((location.hash || '').indexOf('#n=') === 0 && !D.ownHash) location.reload();
      D.ownHash = false;
    });

    if (D.UI) D.UI.init();
    if (qs.has('skip')) {
      Flow.enter(false);
      Flow.revealT = -1;
      Wd.reveal.r = 9; Wd.reveal.bright = 1;
    }
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
