/* 말로 지은 밤 — a night made of words
   world.js : the place itself. A sea written in the word for sea, a sky of the
   word for star, a moon of the word for moon — and one light that is not a word. */
(function () {
  'use strict';
  const D = window.Dream, U = D.U, V = U.v, A = D.Atlas, R = D.R, L = D.Lex;
  const DEG = U.DEG;
  const SKY_R = 470;
  const POLE = V.norm([-0.3, 0.75, 0.59]);   // the sky turns about this

  const cam = {
    eye: [0, 5.2, 0], F: [0, 0, -1], R: [1, 0, 0], Up: [0, 1, 0],
    fovY: 50 * DEG, aspect: 1.6, tanX: 0.75, tanY: 0.466, focal: 900,
    basePitch: 0.075, height: 5.2,
    proj: new Float32Array(16), view: new Float32Array(16), VP: new Float32Array(16),
  };

  const Wd = (D.World = {
    SKY_R, cam,
    t: 0, seaT: 0, w: 1, h: 1, small: false, portrait: false, quality: 1,
    ptr: { tx: 0.14, ty: 0.2, x: 0.14, y: 0.2, speed: 0, seen: false },
    moonDir: [0.2, 0.33, -0.92], moonAng: 4.4 * DEG, moonSize: 1, moonBoost: 1, moonHalo: 0,
    skyAngle: 0, skyRot: new Float32Array(9), skyInv: new Float32Array(9),
    reveal: { x: 0, y: 0, r: 0.36, soft: 0.3, bright: 0.14 },
    dawn: 0, paper: 0, ink: 0, calm: 0, fade: 1, pre: 0,
    swell: 1, swellNow: 1, wind: 0, windTarget: 0, gust: 0,
    lensR: 0.19, lensOn: 1, lightSize: 1, lightOn: 1, companion: 0,
    pulse: { x: 0, y: 0, r: 9, amp: 0 },
    starBoost: 1, starBoostTarget: 1, aur: 0,
    flight: 0, flightTarget: 0, wakeCam: 0,
    ripsA: [], ripsB: [], ripU: new Float32Array(32),
    PL: new Float32Array(12), PLc: new Float32Array(9), plN: 0,
    staticCount: 0, moonRings: null,
  });

  /* ------------------------------------------------------------ geometry */
  Wd.ray = function (nx, ny) {
    return V.norm([
      cam.F[0] + cam.R[0] * nx * cam.tanX + cam.Up[0] * ny * cam.tanY,
      cam.F[1] + cam.R[1] * nx * cam.tanX + cam.Up[1] * ny * cam.tanY,
      cam.F[2] + cam.R[2] * nx * cam.tanX + cam.Up[2] * ny * cam.tanY,
    ]);
  };
  /* where a screen point meets the water: [x, z, distance] or null */
  Wd.seaPoint = function (nx, ny, maxD) {
    const d = Wd.ray(nx, ny), e = cam.eye;
    if (d[1] > -0.004) return null;
    const t = -e[1] / d[1];
    if (t > (maxD || 600)) return null;
    return [e[0] + d[0] * t, e[2] + d[2] * t, t];
  };
  /* like seaPoint, but a ray that only grazes the horizon lands on the far water instead of nowhere */
  Wd.seaTouch = function (nx, ny, maxD) {
    const d = Wd.ray(nx, ny), e = cam.eye;
    if (d[1] > 0.03) return null;
    const lim = maxD || 300;
    let t = d[1] < -0.0005 ? -e[1] / d[1] : 1e9;
    if (t > lim) {
      const hl = Math.hypot(d[0], d[2]) || 1;
      return [e[0] + (d[0] / hl) * lim, e[2] + (d[2] / hl) * lim, lim];
    }
    return [e[0] + d[0] * t, e[2] + d[2] * t, t];
  };
  /* world point → [ndcX, ndcY, w] */
  Wd.project = function (p) {
    const m = cam.VP;
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const iw = 1 / Math.max(Math.abs(w), 1e-5);
    return [x * iw, y * iw, w];
  };
  /* a screen point pushed out to a distance along its ray */
  Wd.unproject = function (nx, ny, dist) {
    const d = Wd.ray(nx, ny), e = cam.eye;
    return [e[0] + d[0] * dist, e[1] + d[1] * dist, e[2] + d[2] * dist];
  };
  Wd.skyToWorld = (dirSky) => U.m3apply(Wd.skyRot, dirSky);
  Wd.worldToSky = (dir) => U.m3apply(Wd.skyInv, dir);
  /* world units covered by one CSS pixel at a given distance */
  Wd.pxAt = (dist) => dist / cam.focal;

  /* the sea's height, the same swell the shader draws (ripples left out) */
  Wd.seaH = function (x, z) {
    const e = cam.eye;
    const d0 = Math.hypot(x - e[0], e[1], z - e[2]);
    const amp = Wd.swellNow * (1 + d0 * 0.005);
    let h = 0;
    const Ws = R.WAVES, t = Wd.seaT;
    for (let i = 0; i < Ws.length; i++) {
      const w = Ws[i];
      h += w[4] * Math.sin((x * w[0] + z * w[1]) * w[2] - t * w[3] + w[5]);
    }
    return h * amp;
  };
  Wd.seaSlopeX = (x, z) => (Wd.seaH(x + 0.6, z) - Wd.seaH(x - 0.6, z)) / 1.2;

  Wd.addRipple = function (x, z, strength, big) {
    const s = strength * (D.reduced ? 0.5 : 1);
    const list = big ? Wd.ripsB : Wd.ripsA;
    list.push({ x, z, t0: Wd.seaT, s });
    if (list.length > (big ? 3 : 5)) list.shift();
  };
  Wd.firePulse = function (nx, ny, amp) {
    const p = Wd.pulse;
    p.x = nx; p.y = ny; p.r = 0; p.amp = amp * (D.reduced ? 0.5 : 1);
  };
  /* a lamp on the water, registered each frame by whatever is burning */
  Wd.light = function (x, z, radius, intensity, r, g, b) {
    if (Wd.plN >= 3) return;
    const i = Wd.plN++;
    Wd.PL[i * 4] = x; Wd.PL[i * 4 + 1] = z; Wd.PL[i * 4 + 2] = radius; Wd.PL[i * 4 + 3] = intensity;
    Wd.PLc[i * 3] = r; Wd.PLc[i * 3 + 1] = g; Wd.PLc[i * 3 + 2] = b;
  };

  /* ------------------------------------------------------------ pointer */
  Wd.setPointer = function (clientX, clientY) {
    const p = Wd.ptr;
    p.tx = U.clamp((clientX / Wd.w) * 2 - 1, -1, 1);
    p.ty = U.clamp(1 - (clientY / Wd.h) * 2, -1, 1);
    p.seen = true;
  };
  Wd.nudgePointer = function (dx, dy) {
    const p = Wd.ptr;
    p.tx = U.clamp(p.tx + dx, -0.96, 0.96);
    p.ty = U.clamp(p.ty + dy, -0.9, 0.94);
    p.seen = true;
  };

  /* ------------------------------------------------------------- resize */
  Wd.resize = function () {
    const cv = R.canvas;
    const w = Math.max(2, window.innerWidth), h = Math.max(2, window.innerHeight);
    Wd.w = w; Wd.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * Wd.quality;
    cv.width = Math.max(2, Math.round(w * dpr));
    cv.height = Math.max(2, Math.round(h * dpr));
    cam.aspect = w / h;
    cam.fovY = U.clamp(2 * Math.atan(Math.tan(24 * DEG) / cam.aspect), 50 * DEG, 90 * DEG);
    cam.tanY = Math.tan(cam.fovY / 2);
    cam.tanX = cam.tanY * cam.aspect;
    cam.focal = h / 2 / cam.tanY;
    Wd.small = Math.min(w, h) < 560;
    Wd.portrait = cam.aspect < 0.9;
    cam.basePitch = U.lerp(-0.05, 0.075, U.smooth(0.7, 1.3, cam.aspect));
    U.perspective(cam.proj, cam.fovY, cam.aspect, 0.5, 4000);
    Wd.moonAng = (Wd.portrait ? 5.6 : 4.4) * DEG;
    Wd.moonDir = V.norm(U.dirAzEl((Wd.portrait ? 0.1 : 0.2), (Wd.portrait ? 0.4 : 0.31)));
    Wd.lensR = Wd.small ? 0.21 : 0.19;
    updateCamera(0);
  };

  /* -------------------------------------------------------- static parts */
  function weighted(list, heavy) {
    // Korean and English first, then every other tongue once
    const pool = [];
    for (let i = 0; i < heavy[0]; i++) pool.push(list[0]);
    for (let i = 0; i < heavy[1]; i++) pool.push(list[1]);
    for (let i = 2; i < list.length; i++) pool.push(list[i]);
    return pool;
  }

  function buildStars(S, rnd) {
    const n = Wd.small ? 560 : 920;
    const pool = weighted(L.names.star, [9, 4]).concat(['星', '星', '별']);
    for (let i = 0; i < n; i++) {
      const az = (rnd() * 2 - 1) * 2.05;
      const el = Math.asin(0.03 + rnd() * 0.95);
      placeStar(S, rnd, U.dirAzEl(az, el), pool, Math.pow(rnd(), 2.6));
    }
  }
  function placeStar(S, rnd, dir, pool, m) {
    const emPx = 3.0 + m * 6.5;
    const em = (emPx / cam.focal) * SKY_R;
    const g = A.glyphs(pool[(rnd() * pool.length) | 0]);
    const tc = rnd();
    let cr = 0.92, cg = 0.95, cb = 1.0;
    if (tc > 0.9) { cr = 1.0; cg = 0.8; cb = 0.82; }
    else if (tc > 0.72) { cr = 1.0; cg = 0.9; cb = 0.72; }
    else if (tc > 0.5) { cr = 0.74; cg = 0.84; cb = 1.0; }
    const alpha = 0.34 + m * 0.62;
    const seed = rnd();
    const right = V.norm(V.cross(dir, [0, 1, 0]));
    const lens = U.clamp(17 / emPx - 1, 0.7, 4.6);
    const tr = 0.92;
    let xo = -g.w * 0.5 * tr;
    for (let k = 0; k < g.length; k++) {
      const q = g[k], adv = q.a * tr;
      if (!q.sp) {
        const off = ((xo + adv / 2) * em) / SKY_R;
        const p = V.norm([dir[0] + right[0] * off, dir[1] + right[1] * off, dir[2] + right[2] * off]);
        S.sky(p[0] * SKY_R, p[1] * SKY_R, p[2] * SKY_R, em, 0, cr, cg, cb, alpha, q.c, seed, lens, 0.34, right[0], right[1], right[2]);
      }
      xo += adv;
    }
    if (m > 0.16) S.skyGlow(dir[0] * SKY_R, dir[1] * SKY_R, dir[2] * SKY_R, em * (1.5 + m * 2.4), cr, cg, cb, 0.08 + m * 0.5, seed, 0.3, Math.min(lens, 2.3));
  }

  function buildMilky(S, rnd) {
    const n = V.norm(R.BANDN);
    let a = R.BAND_A;
    a = V.norm(V.sub(a, V.scale(n, V.dot(a, n))));
    const b = V.cross(n, a);
    const emPx = Wd.small ? 4.7 : 5.3;
    const em = (emPx / cam.focal) * SKY_R;
    const lens = Math.min(3.2, 17.5 / emPx - 1);
    const offs = [-2.5, -0.85, 0.85, 2.5];
    for (let j = 0; j < 4; j++) {
      const text = L.milky[j];
      const g = A.glyphs(text);
      const wv = offs[j] * DEG;
      const cw = Math.cos(wv), sw = Math.sin(wv);
      let th = -0.5 + rnd() * 0.05, k = 0;
      while (th < 2.15) {
        const q = g[k % g.length]; k++;
        const dth = (q.a * 1.03 * em) / SKY_R;
        if (!q.sp) {
          const tm = th + dth / 2;
          const ct = Math.cos(tm), st = Math.sin(tm);
          const px = (ct * a[0] + st * b[0]) * cw + n[0] * sw;
          const py = (ct * a[1] + st * b[1]) * cw + n[1] * sw;
          const pz = (ct * a[2] + st * b[2]) * cw + n[2] * sw;
          const tx = -st * a[0] + ct * b[0], ty = -st * a[1] + ct * b[1], tz = -st * a[2] + ct * b[2];
          S.sky(px * SKY_R, py * SKY_R, pz * SKY_R, em, 0, 0.8, 0.86, 1.0, 0.36, q.c, rnd(), lens, 0.16, tx, ty, tz);
        }
        th += dth;
      }
    }
    // the band is also where the faint stars crowd
    const pool = weighted(L.names.star, [7, 3]);
    const extra = Wd.small ? 150 : 260;
    for (let i = 0; i < extra; i++) {
      const th = -0.45 + rnd() * 2.5;
      const wv = (rnd() + rnd() + rnd() - 1.5) * 7 * DEG;
      const ct = Math.cos(th), st = Math.sin(th), cw = Math.cos(wv), sw = Math.sin(wv);
      const dir = [(ct * a[0] + st * b[0]) * cw + n[0] * sw, (ct * a[1] + st * b[1]) * cw + n[1] * sw, (ct * a[2] + st * b[2]) * cw + n[2] * sw];
      placeStar(S, rnd, dir, pool, Math.pow(rnd(), 3.4) * 0.8);
    }
  }

  function buildMountains(S, rnd) {
    const Rm = 600;
    const groups = Wd.portrait ? [[-32, -8, 1.0], [12, 34, 0.82]] : [[-56, -17, 1.0], [21, 60, 0.9]];
    const hmax = Rm * Math.tan(3.2 * DEG);
    const prof = (az, g) => {
      const u = (az - g[0]) / (g[1] - g[0]);
      if (u <= 0 || u >= 1) return 0;
      return hmax * g[2] * Math.pow(Math.sin(Math.PI * u), 0.7) * (0.28 + 0.72 * U.fbm1(az * 0.23 + g[0] * 3.1));
    };
    // the dark body of the range: sheared strips whose tops follow the ridge line
    const step = 0.3;
    const halfw = Rm * step * DEG * 0.52;
    groups.forEach((g) => {
      for (let az = g[0]; az < g[1]; az += step) {
        const h0 = prof(az, g), h1 = prof(az + step, g);
        if (h0 < 0.05 && h1 < 0.05) continue;
        const hm = (h0 + h1) / 2;
        const ar = (az + step / 2) * DEG;
        const x = Math.sin(ar) * Rm, z = -Math.cos(ar) * Rm;
        S.quad(x, (hm - 7) / 2, z, Math.cos(ar) * halfw, (h1 - h0) * 0.52, Math.sin(ar) * halfw, 0, (hm + 7) / 2, 0,
          0.014, 0.024, 0.06, 0.96, A.FX.solid, 0, 0, 1);
      }
    });
    const pool = weighted(L.names.mountain, [6, 3]);
    const emPx = Wd.small ? 6.2 : 7.2;
    const em = (emPx / cam.focal) * Rm;
    const gap = em * 1.45;
    const lens = 17 / emPx - 1;
    groups.forEach((g) => {
      for (let y = em * 0.75; y < hmax; y += gap) {
        let az = g[0] + rnd() * 0.5;
        let word = A.glyphs(pool[(rnd() * pool.length) | 0]), k = 0;
        while (az < g[1]) {
          if (k >= word.length) { word = A.glyphs(pool[(rnd() * pool.length) | 0]); k = 0; az += ((em * 0.6) / Rm) / DEG; }
          const q = word[k++];
          const dAz = ((q.a * em * 1.02) / Rm) / DEG;
          const h = prof(az + dAz / 2, g);
          if (!q.sp && y < h - em * 0.25) {
            const ar = (az + dAz / 2) * DEG;
            const top = y > h - gap * 1.15;
            const cr = top ? 0.62 : 0.34, cg = top ? 0.72 : 0.44, cb = top ? 0.93 : 0.66;
            S.bb(Math.sin(ar) * Rm, y, -Math.cos(ar) * Rm, em, 0, cr, cg, cb, top ? 0.78 : 0.42 + 0.2 * (y / hmax), q.c, rnd(), lens, 0);
          }
          az += dAz;
        }
      }
    });
  }

  function buildSea(S, rnd) {
    const targetPx = U.clamp(Math.min(Wd.w, Wd.h) * 0.0225 + 4, 12.5, 21);
    const k = targetPx / cam.focal;
    const bottomAng = Math.max(0.16, cam.fovY / 2 - cam.basePitch);
    const stretch = U.clamp(0.82 / Math.sin(bottomAng), 1.25, 2.4);
    const ratio = 1 + stretch * k * 1.22;
    const zNear = Math.max(4.5, (cam.height / Math.tan(bottomAng)) * 0.8);
    const spread = cam.tanX * 1.22;
    const pool = weighted(L.names.sea, [7, 5]).concat(L.names.wave.slice(0, 3), L.names.wave.slice(0, 2));
    Wd.seaStretch = stretch;
    let z = zNear, row = 0, sinceStand = 1e9;
    while (z < 640 && S.n < S.max - 600) {
      const em = k * z;
      const halfW = z * spread + 10;
      const drift = (row % 2 ? 1 : -1) * (0.35 + rnd() * 0.5) * em * 0.9;
      // rows are packed closer than a standing letter is tall; let every n-th one stand
      // (a row may stand only when the last standing row is a full letter-height behind it on screen)
      const gapPx = (cam.focal * cam.height * (ratio - 1)) / z;
      sinceStand += gapPx;
      const stand = sinceStand >= targetPx * 1.9;
      if (stand) sinceStand = 0;
      const tone = rnd();
      let x = -halfW + rnd() * em * 2;
      while (x < halfW) {
        const g = A.glyphs(pool[(rnd() * pool.length) | 0]);
        const v = rnd() * 0.5 + tone * 0.5;
        const cr = U.lerp(0.2, 0.3, v), cg = U.lerp(0.44, 0.68, v), cb = U.lerp(0.8, 0.76, v);
        const al = 0.52 + rnd() * 0.26;
        for (let i = 0; i < g.length; i++) {
          const q = g[i], adv = q.a * em * 1.04;
          if (!q.sp) S.sea(x + adv / 2, -z, em, halfW, drift, stretch, cr, cg, cb, al, q.c, rnd(), 0.5, stand);
          x += adv;
        }
        x += em * 0.62;
      }
      z *= ratio; row++;
    }
  }

  function buildMoon(rnd) {
    const N = Wd.small ? 8 : 10;
    const names = L.names.moon;
    const pool = ['달', 'moon'].concat(names.slice(2)).concat(['달', 'moon', '月']);
    const emF = 0.8 / N;
    const rings = [];
    let wi = 0;
    for (let j = 0; j < N - 1; j++) {
      const rf = 1 - (j + 0.62) / N;
      const circ = 2 * Math.PI * rf;
      const items = [];
      let acc = 0;
      for (let guard = 0; guard < 200; guard++) {
        const g = A.glyphs(pool[wi % pool.length]);
        const ww = g.w * emF * 0.96 + emF * 0.5;
        if (acc + ww > circ) break;
        wi++;
        let x = acc;
        for (let i = 0; i < g.length; i++) {
          const q = g[i], adv = q.a * emF * 0.96;
          if (!q.sp) items.push({ pos: x + adv / 2, c: q.c, seed: rnd() });
          x += adv;
        }
        acc += ww;
      }
      const sc = acc > 0 ? circ / acc : 1;
      items.forEach((it) => { it.ang = -(it.pos * sc) / rf; });
      rings.push({ rf, items, om: (j % 2 ? -1 : 1) * (0.018 + 0.012 * rnd()), ph: rnd() * 6.28 });
    }
    Wd.moonRings = { rings, emF, core: A.cell('달'), N };
  }

  Wd.buildStatic = function () {
    const rnd = U.rng(20261110);
    const S = new R.Writer(Wd.small ? 26000 : 34000);
    buildStars(S, rnd);
    buildMilky(S, rnd);
    buildMountains(S, rnd);
    buildSea(S, rnd);
    buildMoon(rnd);
    R.setStatic(S);
    Wd.staticCount = S.n;
  };

  /* ------------------------------------------------------------- camera */
  function updateCamera(dt) {
    const p = Wd.ptr;
    const k = dt > 0 ? 1 - Math.exp(-dt * (D.reduced ? 30 : 9)) : 0;
    const ox = p.x, oy = p.y;
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.speed = dt > 0 ? Math.hypot((p.x - ox) * cam.aspect, p.y - oy) / dt : 0;

    let h = cam.height, pitch = cam.basePitch, yaw = 0, x = 0;
    if (!D.reduced) {
      const calm = 1 - Wd.wakeCam;
      x += p.x * 1.5 * calm;
      h += (p.y * 0.45 + Math.sin(Wd.t * 0.21) * 0.12) * calm;
      yaw += p.x * 0.02 * calm;
      pitch += p.y * 0.012 * calm;
    }
    const fl = U.easeInOut(Wd.flight);
    h += fl * 44; pitch -= fl * 0.4;
    const wk = U.easeInOut(Wd.wakeCam);
    h += wk * 85; pitch -= wk * 1.0;
    cam.eye[0] = x; cam.eye[1] = h; cam.eye[2] = -wk * 62;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    cam.F = [Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp];
    cam.R = V.norm(V.cross(cam.F, [0, 1, 0]));
    cam.Up = V.cross(cam.R, cam.F);
    U.viewFromBasis(cam.view, cam.eye, cam.R, cam.Up, cam.F);
    U.mul4(cam.VP, cam.proj, cam.view);
  }

  /* ------------------------------------------------------------- update */
  let wakeClock = 0;
  const trail = [];
  let trailClock = 0;

  Wd.update = function (dt) {
    Wd.t += dt;
    Wd.seaT += dt * D.motion;

    Wd.wind += (Wd.windTarget - Wd.wind) * (1 - Math.exp(-dt * 0.8));
    const sw = (1 + Wd.wind * 1.25 + Wd.gust) * (D.reduced ? 0.55 : 1);
    Wd.swell += (sw - Wd.swell) * (1 - Math.exp(-dt * 1.2));
    Wd.gust *= Math.exp(-dt * 0.12);
    Wd.swellNow = Wd.swell * (1 - Wd.calm);
    Wd.starBoost += (Wd.starBoostTarget - Wd.starBoost) * (1 - Math.exp(-dt * 0.7));

    U.rotAxis(Wd.skyRot, POLE, Wd.skyAngle);
    U.m3transpose(Wd.skyInv, Wd.skyRot);

    const pu = Wd.pulse;
    if (pu.amp > 0.002) {
      pu.r += dt * 1.5;
      pu.amp *= Math.exp(-dt * 0.5);
      if (pu.r > 4.2) pu.amp = 0;
    }

    const fd = Wd.flightTarget - Wd.flight;
    if (Math.abs(fd) > 0.0005) Wd.flight += Math.sign(fd) * Math.min(Math.abs(fd), dt / 5.5);

    updateCamera(dt);

    // the light leaves a wake where it crosses the water
    wakeClock -= dt;
    const p = Wd.ptr;
    if (Wd.lightOn > 0.5 && p.speed > 0.3 && wakeClock <= 0) {
      const sp = Wd.seaPoint(p.x, p.y, 320);
      if (sp) {
        Wd.addRipple(sp[0], sp[1], U.clamp(p.speed * 0.22, 0.12, 0.42) * (1 + sp[2] * 0.012), false);
        wakeClock = 0.24;
      }
    }

    // ripples → uniform
    const ru = Wd.ripU;
    for (let i = 0; i < 8; i++) {
      const r = i < 5 ? Wd.ripsA[i] : Wd.ripsB[i - 5];
      const o = i * 4;
      if (r) {
        const age = Wd.seaT - r.t0;
        ru[o] = r.x; ru[o + 1] = r.z; ru[o + 2] = age; ru[o + 3] = age < 11 ? r.s : 0;
      } else { ru[o + 3] = 0; }
    }

    // comet-tail behind the light
    trailClock -= dt;
    if (trailClock <= 0) {
      trail.unshift([p.x, p.y]);
      if (trail.length > 12) trail.pop();
      trailClock = 0.03;
    }

    // lamps are re-registered every frame
    Wd.plN = 0;
    Wd.PL[3] = 0; Wd.PL[7] = 0; Wd.PL[11] = 0;
  };

  /* --------------------------------------------------------------- emit */
  Wd.emitMoon = function (W) {
    const mr = Wd.moonRings;
    if (!mr) return;
    const md = Wd.moonDir, e = cam.eye, Rv = cam.R, Uv = cam.Up;
    const cx = e[0] + md[0] * SKY_R, cy = e[1] + md[1] * SKY_R, cz = e[2] + md[2] * SKY_R;
    const Rm = SKY_R * Math.tan(Wd.moonAng) * Wd.moonSize;
    const boost = Wd.moonBoost;
    const t = Wd.t * D.motion;

    W.spr(cx, cy, cz, Rm * 3.6, 0, 1, 1, 0.56, 0.66, 0.95, 0.12 * boost, A.FX.glow, 0);
    W.spr(cx, cy, cz, Rm * 1.08, 0, 1, 1, 0.9, 0.88, 0.8, 0.2 * boost, A.FX.disc, 0);
    W.spr(cx, cy, cz, Rm * 1.9, 0, 1, 1, 0.8, 0.84, 1.0, 0.16 * boost, A.FX.glow, 0);

    const em = mr.emF * Rm;
    const emPx = (em / SKY_R) * cam.focal;
    // the moon opens under the glass only when the light is actually on it — never dented from the side
    const mc = Wd.project([cx, cy, cz]);
    const rmN = (Rm / SKY_R) / cam.tanY;
    const dm = Math.hypot((mc[0] - Wd.ptr.x) * cam.aspect, mc[1] - Wd.ptr.y);
    const lens = U.clamp(13 / emPx - 1, 0.4, 1.1) * (1 - U.smooth(rmN * 0.8, rmN * 1.5 + Wd.lensR * 0.5, dm));
    for (let j = 0; j < mr.rings.length; j++) {
      const ring = mr.rings[j];
      const rr = ring.rf * Rm;
      const base = ring.ph + t * ring.om;
      const items = ring.items;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const ang = it.ang + base;
        const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
        const mare = 0.5 + 0.5 * U.noise2((x / Rm) * 2.3 + 5.2, (y / Rm) * 2.3 + 9.1);
        const al = (0.5 + 0.5 * mare) * (1.15 - 0.2 * ring.rf * ring.rf * ring.rf);
        W.bb(cx + Rv[0] * x + Uv[0] * y, cy + Rv[1] * x + Uv[1] * y, cz + Rv[2] * x + Uv[2] * y,
          em, ang - Math.PI / 2, 1.0, 0.96, 0.86, Math.min(1, al * boost), it.c, it.seed, lens, 0.06);
      }
    }
    W.bb(cx, cy, cz, em * 2.6, 0, 1.0, 0.97, 0.88, Math.min(1, 0.95 * boost), mr.core, 0.5, lens * 0.5, 0);
  };

  Wd.emitLight = function (W) {
    const on = Wd.lightOn;
    if (on <= 0.003) return;
    const p = Wd.ptr;
    const Dd = 22;
    const pxu = Wd.pxAt(Dd);
    const k = Wd.lightSize * (Wd.small ? 0.82 : 1);
    const br = D.reduced ? 1 : 1 + 0.06 * Math.sin(Wd.t * 1.7);
    const P = Wd.unproject(p.x, p.y, Dd);

    if (!D.reduced) {
      for (let i = trail.length - 1; i >= 1; i--) {
        const q = Wd.unproject(trail[i][0], trail[i][1], Dd);
        const f = 1 - i / trail.length;
        W.spr(q[0], q[1], q[2], (10 + 24 * f) * pxu * k, 0, 1, 1, 1.0, 0.8, 0.55, 0.1 * f * on, A.FX.glow, 0);
      }
    }
    W.spr(P[0], P[1], P[2], 185 * pxu * k * br, 0, 1, 1, 1.0, 0.76, 0.48, 0.1 * on, A.FX.glow, 0);
    W.spr(P[0], P[1], P[2], 62 * pxu * k, 0, 1, 1, 1.0, 0.86, 0.62, 0.42 * on, A.FX.glow, 0);
    W.spr(P[0], P[1], P[2], 19 * pxu * k * br, 0, 1, 1, 1.0, 0.97, 0.9, 1.0 * on, A.FX.glow, 0);

    // love is kept as a second light rather than as letters
    if (Wd.companion > 0.003) {
      const c = Wd.companion;
      const a = Wd.t * (D.reduced ? 0.25 : 0.85);
      const rad = (52 + 6 * Math.sin(Wd.t * 0.6)) * pxu * k;
      const qx = P[0] + (cam.R[0] * Math.cos(a) + cam.Up[0] * Math.sin(a) * 0.72) * rad;
      const qy = P[1] + (cam.R[1] * Math.cos(a) + cam.Up[1] * Math.sin(a) * 0.72) * rad;
      const qz = P[2] + (cam.R[2] * Math.cos(a) + cam.Up[2] * Math.sin(a) * 0.72) * rad;
      W.spr(qx, qy, qz, 100 * pxu * k, 0, 1, 1, 1.0, 0.6, 0.66, 0.11 * c * on, A.FX.glow, 0);
      W.spr(qx, qy, qz, 34 * pxu * k, 0, 1, 1, 1.0, 0.74, 0.76, 0.5 * c * on, A.FX.glow, 0);
      W.spr(qx, qy, qz, 11 * pxu * k, 0, 1, 1, 1.0, 0.95, 0.93, 1.0 * c * on, A.FX.glow, 0);
    }
  };

  /* ----------------------------------------------------------- uniforms */
  const uni = {
    VP: cam.VP, skyRot: Wd.skyRot, skyInv: Wd.skyInv,
    camPos: new Float32Array(3), camR: new Float32Array(3), camU: new Float32Array(3), camF: new Float32Array(3),
    tanX: 1, tanY: 1, time: 0, seaTime: 0, aspect: 1,
    pointer: new Float32Array(3), lensR: 0.19, swell: 1, rip: Wd.ripU,
    moonDir: new Float32Array(3), moonCos: new Float32Array(2), moonGlit: 1,
    PL: Wd.PL, PLc: Wd.PLc,
    reveal: new Float32Array(4), pulse: new Float32Array(4),
    ink: 0, inkCol: new Float32Array([0.11, 0.1, 0.17]), fade: 1, starBoost: 1,
    dawn: 0, paper: 0, bright: 1, moonGlow: 1, pre: 0, aur: new Float32Array(4), stretch: 0, solid: 1,
  };
  Wd.uniforms = function () {
    const u = uni;
    u.camPos.set(cam.eye); u.camR.set(cam.R); u.camU.set(cam.Up); u.camF.set(cam.F);
    u.tanX = cam.tanX; u.tanY = cam.tanY;
    u.time = Wd.t; u.seaTime = Wd.seaT; u.aspect = cam.aspect;
    u.pointer[0] = Wd.ptr.x; u.pointer[1] = Wd.ptr.y; u.pointer[2] = Wd.lensOn;
    u.lensR = Wd.lensR * (0.85 + 0.15 * Wd.lightSize);
    u.swell = Wd.swellNow;
    u.moonDir.set(Wd.moonDir);
    const ma = Wd.moonAng * Wd.moonSize;
    u.moonCos[0] = Math.cos(ma * 1.22); u.moonCos[1] = Math.cos(ma * 1.0);
    const night = 1 - Wd.dawn;
    u.moonGlit = Wd.moonBoost * night;
    u.moonGlow = Wd.moonBoost * night;
    const rv = Wd.reveal;
    u.reveal[0] = rv.x; u.reveal[1] = rv.y; u.reveal[2] = rv.r; u.reveal[3] = rv.soft;
    u.bright = rv.bright;
    const pu = Wd.pulse;
    u.pulse[0] = pu.x; u.pulse[1] = pu.y; u.pulse[2] = pu.r; u.pulse[3] = pu.amp;
    u.ink = Wd.ink; u.fade = Wd.fade;
    u.starBoost = Wd.starBoost * (1 - Wd.dawn * 0.75);
    u.dawn = Wd.dawn; u.paper = Wd.paper; u.pre = Wd.pre;
    u.aur[0] = Wd.aur * night; u.aur[1] = Wd.t * 0.05;
    u.stretch = Math.max(U.easeInOut(Wd.wakeCam), U.easeInOut(Wd.flight) * 0.85);
    u.solid = 1 - U.smooth(0.05, 0.6, Wd.dawn);
    return u;
  };
})();
