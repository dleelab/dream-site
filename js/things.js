/* 말로 지은 밤 — a night made of words
   things.js : what a word turns into. Part one: the shared craft (name pools,
   calligram filling, letters in flight), constellations, weather, birds, stars. */
(function () {
  'use strict';
  const D = window.Dream, U = D.U, V = U.v, A = D.Atlas, L = D.Lex, Wd = D.World;
  const TAU = U.TAU, SKY_R = Wd.SKY_R, FX = A.FX, cam = Wd.cam;

  const T = (D.Things = {
    list: [], extras: [], rings: [], touched: [], makers: {},
    targets: { companion: 0, lightSize: 1, moonBoost: 1, moonSize: 1 },
    flightClock: 0, saidForget: false,
  });

  /* ---------------------------------------------------------------- craft */
  const noSp = (g) => g.filter((q) => !q.sp);
  T.noSp = noSp;

  /* the visitor's own word, and the same name in every tongue I can set */
  T.namePool = function (kind, typed) {
    const k = L.kinds[kind];
    const others = k && k.names && L.names[k.names] ? L.names[k.names] : [];
    const pool = [];
    const share = Math.max(3, Math.round(others.length * 0.9));
    for (let i = 0; i < share; i++) pool.push(typed);
    const low = typed.toLowerCase();
    for (const o of others) if (o.toLowerCase() !== low) pool.push(o);
    pool.forEach((w) => A.glyphs(w));
    return pool;
  };

  /* glyph after glyph, word after word, with a breath between words */
  T.stream = function (pool) {
    let g = A.glyphs(U.pick(pool)), i = 0;
    return function next() {
      if (i >= g.length) { g = A.glyphs(U.pick(pool)); i = 0; return { c: -1, a: 0.5, sp: true }; }
      return g[i++];
    };
  };

  /* set lines of type inside a silhouette; inside(x, y) > 0 means "in" and is kept as .d */
  T.fillShape = function (inside, x0, x1, y0, y1, em, gap, next, out, tr) {
    tr = tr || 1.02;
    for (let y = y1 - gap * 0.5; y > y0; y -= gap) {
      let x = x0 + Math.random() * em * 0.8;
      while (x < x1) {
        const q = next();
        const w = q.a * em * tr;
        if (!q.sp) {
          const d = inside(x + w * 0.5, y);
          if (d > 0) out.push({ x: x + w * 0.5, y, c: q.c, d, s: Math.random() });
        }
        x += w;
      }
    }
    return out;
  };

  T.horizonNdc = () => -Math.tan(Math.asin(U.clamp(cam.F[1], -1, 1))) / cam.tanY;
  T.lightInSky = () => { const p = Wd.ptr; return p.y > T.horizonNdc() + 0.14 && p.y < 0.82 && Math.abs(p.x) < 0.9; };
  T.lightOnSea = () => { const p = Wd.ptr; return p.y < T.horizonNdc() - 0.03 && p.y > -0.46; };
  /* where the visitor's words leave from: just above the place they are typed */
  T.handPoint = () => Wd.unproject(U.rr(-0.1, 0.1), -0.74, 15);

  const ang = (a, b) => Math.acos(U.clamp(V.dot(a, b), -1, 1));

  /* a free patch of sky (world direction), near the light when the light is up there */
  T.skySpot = function (rad) {
    const hz = T.horizonNdc();
    let best = null, bestScore = -1e9;
    const useLight = T.lightInSky();
    const lim = Math.max(0.08, 0.9 - (rad || 0) / Math.atan(cam.tanX));
    for (let i = 0; i < 18; i++) {
      let d;
      if (i === 0 && useLight) d = Wd.ray(U.clamp(Wd.ptr.x, -lim, lim), Wd.ptr.y);
      else d = Wd.ray(U.rr(-lim, lim), U.rr(hz + 0.24, 0.8));
      if (d[1] < 0.1) continue;
      let score = ang(d, Wd.moonDir) - Wd.moonAng * 2.3 - rad;
      for (const o of T.list) {
        if (o.dying || !o.skyDir) continue;
        score = Math.min(score, ang(d, Wd.skyToWorld(o.skyDir)) - o.skyRad - rad);
      }
      if (i === 0 && useLight && score > 0.02) score += 0.14;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best || Wd.ray(0, 0.5);
  };

  /* a free patch of sea [x, z, dist], near the light when the light is on the water */
  T.seaSpot = function (minD, maxD, rad) {
    let best = null, bestScore = -1e9;
    const useLight = T.lightOnSea();
    for (let i = 0; i < 18; i++) {
      let x, z, d;
      if (i === 0 && useLight) {
        const sp = Wd.seaPoint(Wd.ptr.x, Wd.ptr.y, 900);
        if (!sp) continue;
        d = U.clamp(sp[2], minD, maxD);
        const s = d / sp[2];
        x = cam.eye[0] + (sp[0] - cam.eye[0]) * s;
        z = sp[1] * s;
      } else {
        d = U.rr(minD, maxD);
        const half = d * cam.tanX * 0.66;
        x = cam.eye[0] + U.rr(-half, half);
        z = -d;
      }
      // crowding is judged as the eye sees it: by how far apart things stand across the view
      const sx = (x - cam.eye[0]) / d;
      let score = 0.6;
      for (const o of T.list) {
        if (o.dying || !o.seaPos) continue;
        const od = Math.hypot(o.seaPos[0] - cam.eye[0], o.seaPos[1]) || 1;
        score = Math.min(score, Math.abs(sx - (o.seaPos[0] - cam.eye[0]) / od) - ((o.seaRad || 10) / od + (rad || 8) / d) * 0.8);
      }
      if (i === 0 && useLight && score > 0) score += 0.12;
      if (score > bestScore) { bestScore = score; best = [x, z, d]; }
    }
    return best || [0, -minD, minD];
  };

  /* ------------------------------------------------- small passing effects */

  /* letters leaving the visitor's hands for the place where they become a thing */
  class Flight {
    constructor(word, to, n, dur, col, emPx) {
      const g = noSp(A.glyphs(word));
      this.from = T.handPoint();
      this.to = to;
      this.dur = dur;
      this.t = 0;
      this.col = col || [1, 0.93, 0.78];
      this.emPx = emPx || 12;
      this.p = [];
      for (let i = 0; i < n; i++) {
        this.p.push({
          c: g[i % g.length].c, delay: (i / n) * dur * 0.55 + Math.random() * 0.08,
          ox: U.rr(-1, 1), oy: U.rr(-0.2, 1), s: Math.random(),
        });
      }
      this.end = dur * 1.6;
    }
    update(dt) { this.t += dt; return this.t < this.end; }
    emit(W) {
      const a = this.from, b = this.to, col = this.col;
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      for (const p of this.p) {
        const k = (this.t - p.delay) / this.dur;
        if (k <= 0 || k >= 1) continue;
        const e = U.easeInOut(k);
        const arc = Math.sin(Math.PI * k) * dist * 0.08;
        const x = a[0] + (b[0] - a[0]) * e + cam.R[0] * p.ox * arc + cam.Up[0] * p.oy * arc;
        const y = a[1] + (b[1] - a[1]) * e + cam.R[1] * p.ox * arc + cam.Up[1] * p.oy * arc;
        const z = a[2] + (b[2] - a[2]) * e + cam.R[2] * p.ox * arc + cam.Up[2] * p.oy * arc;
        const dd = Math.hypot(x - cam.eye[0], y - cam.eye[1], z - cam.eye[2]);
        const em = Wd.pxAt(dd) * U.lerp(22, this.emPx, e);
        const al = Math.pow(Math.sin(Math.PI * k), 0.6);
        W.bb(x, y, z, em, (p.s - 0.5) * (1 - e), col[0], col[1], col[2], al, p.c, p.s, 0, 0);
      }
    }
  }
  T.Flight = Flight;
  T.fly = function (word, to, n, dur, col, emPx) {
    if (D.reduced) return 0;
    T.extras.push(new Flight(word, to, n, dur, col, emPx));
    return dur * 0.75;       // how long to wait before the thing should start to appear
  };

  /* drops thrown up from the water — and the water is made of its own name */
  class Splash {
    constructor(x, z, n, power, spread, up) {
      this.p = [];
      const pool = L.names.water;
      for (let i = 0; i < n; i++) {
        const g = noSp(A.glyphs(pool[(Math.random() * pool.length) | 0]));
        const a = Math.random() * TAU;
        const sp = power * (0.35 + Math.random() * 0.8);
        const el = (up || 0.9) * (0.55 + Math.random() * 0.45);
        this.p.push({
          x: x + Math.cos(a) * spread * Math.random(), y: 0.2, z: z + Math.sin(a) * spread * Math.random() * 0.4,
          vx: Math.cos(a) * sp * Math.cos(el) * 0.75, vy: sp * Math.sin(el), vz: Math.sin(a) * sp * Math.cos(el) * 0.3,
          c: g[(Math.random() * g.length) | 0].c, life: 0, max: 1.2 + Math.random() * 1.6, s: Math.random(),
        });
      }
    }
    update(dt) {
      const q = dt * (D.reduced ? 0.6 : 1);
      let alive = false;
      for (const p of this.p) {
        p.life += q;
        if (p.life > p.max || p.y < -1) continue;
        p.vy -= 17 * q;
        p.x += p.vx * q; p.y += p.vy * q; p.z += p.vz * q;
        alive = true;
      }
      return alive;
    }
    emit(W) {
      for (const p of this.p) {
        if (p.life > p.max || p.y < -0.5) continue;
        const dd = Math.hypot(p.x - cam.eye[0], p.y - cam.eye[1], p.z - cam.eye[2]);
        const em = Wd.pxAt(dd) * (Wd.small ? 8 : 10);
        const al = Math.min(1, p.life * 8) * (1 - p.life / p.max) * 0.9;
        W.bb(p.x, p.y, p.z, em, p.s * 6 + p.life * 2, 0.8, 0.92, 1.0, al, p.c, p.s, 0.4, 0);
      }
    }
  }
  T.splash = function (x, z, n, power, spread, up) {
    T.extras.push(new Splash(x, z, D.lowPower ? Math.ceil(n * 0.6) : n, power, spread, up));
  };

  /* a ring widening on the water */
  T.ring = function (x, z, size, life, alpha, r, g, b) {
    if (T.rings.length > 70) T.rings.shift();
    T.rings.push({ x, z, size, life, t: 0, a: alpha, r: r === undefined ? 0.72 : r, g: g === undefined ? 0.88 : g, b: b === undefined ? 1 : b });
  };

  /* the visitor touches the water */
  T.touchSea = function (x, z, dist) {
    Wd.addRipple(x, z, 0.9 * (1 + dist * 0.012), false);
    T.ring(x, z, 2 + dist * 0.07, 1.5, 0.75);
    T.ring(x, z, 1 + dist * 0.04, 0.9, 0.5);
    T.splash(x, z, 9, 4 + dist * 0.07, 0.5 + dist * 0.01, 1.2);
  };

  /* the visitor touches the sky: one more star, with a name */
  T.touchSky = function (dirWorld) {
    const names = L.names.star;
    const word = Math.random() < 0.5 ? '별' : names[(Math.random() * names.length) | 0];
    if (T.touched.length >= 48) T.touched.shift();
    T.touched.push({ dir: Wd.worldToSky(dirWorld), g: noSp(A.glyphs(word)), w: A.glyphs(word).w, born: Wd.t, s: Math.random() });
  };

  function emitTouched(W) {
    const e = cam.eye, pxu = Wd.pxAt(SKY_R);
    for (const s of T.touched) {
      const d = Wd.skyToWorld(s.dir);
      const hz = U.smooth(0.012, 0.085, d[1]);
      if (hz <= 0) continue;
      const age = Wd.t - s.born;
      const pop = U.backOut(Math.min(1, age / 0.6));
      const flash = Math.exp(-age * 2.4);
      const em = pxu * (Wd.small ? 10 : 12) * pop;
      const right = V.norm(V.cross(d, [0, 1, 0]));
      let xo = -s.w * 0.5;
      for (const q of s.g) {
        const off = ((xo + q.a * 0.5) * em) / SKY_R;
        const p = V.norm([d[0] + right[0] * off, d[1] + right[1] * off, d[2] + right[2] * off]);
        W.bb(e[0] + p[0] * SKY_R, e[1] + p[1] * SKY_R, e[2] + p[2] * SKY_R, em, 0, 1.0, 0.95, 0.8, 0.95 * hz, q.c, s.s, -0.7, 0.3);
        xo += q.a;
      }
      W.spr(e[0] + d[0] * SKY_R, e[1] + d[1] * SKY_R, e[2] + d[2] * SKY_R, pxu * (17 + flash * 60), 0, 1, 1, 1.0, 0.9, 0.7, (0.3 + flash * 0.6) * hz, FX.glow, 0);
    }
  }

  function emitRings(W) {
    for (const r of T.rings) {
      const k = r.t / r.life;
      const half = r.size * (0.15 + 0.85 * U.easeOut(k));
      const y = Wd.seaH(r.x, r.z) + 0.08;
      W.quad(r.x, y, r.z, half, 0, 0, 0, 0, -half, r.r, r.g, r.b, r.a * (1 - k) * (1 - k), FX.ring, 0, 0, 0);
    }
  }

  /* --------------------------------------------------------------- things */
  class Thing {
    constructor(hit) {
      this.kind = hit.kind;
      this.word = hit.display;
      this.age = 0;
      this.fade = 1;
      this.dying = false;
      this.dead = false;
      this.weather = false;
    }
    tick(dt) {
      this.age += dt;
      if (this.dying) {
        this.fade -= dt / 3.2;
        if (this.fade <= 0) { this.fade = 0; this.dead = true; if (this.onDead) this.onDead(); }
      }
      this.update(dt);
    }
    update() {}
    emit() {}
    release() { this.dying = true; }
  }
  T.Thing = Thing;

  /* ------------------------------------------------------- constellations */
  const FIGS = {
    heart: [[0, -0.92], [-0.52, -0.42], [-0.92, 0.12], [-0.86, 0.62], [-0.46, 0.9], [0, 0.52], [0.46, 0.9], [0.86, 0.62], [0.92, 0.12], [0.52, -0.42], [0, -0.92]],
  };

  class Constellation extends Thing {
    constructor(hit) {
      super(hit);
      const g = noSp(A.glyphs(this.word));
      const n = Math.max(1, g.length);
      const fig = hit.fig && FIGS[hit.fig];
      const pts = [];
      let rad;
      if (fig) {
        const s = Wd.small ? 0.085 : 0.1;
        fig.forEach((p) => pts.push([p[0] * s, p[1] * s]));
        rad = s * 1.25;
      } else {
        const stepX = U.clamp((Wd.portrait ? 0.3 : 0.42) / n, 0.026, 0.064);
        const w = stepX * (n - 1);
        const bend = U.rr(-1, 1) * 0.04;
        let y = U.rr(-0.01, 0.01);
        for (let i = 0; i < n; i++) {
          const u = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
          pts.push([-w / 2 + i * stepX + (n > 1 ? U.rr(-0.22, 0.22) * stepX : 0), y + bend * (1 - u * u)]);
          y += U.rr(-1, 1) * 0.026;
          y *= 0.82;
        }
        rad = Math.max(0.07, w * 0.5 + 0.05);
      }
      const dW = T.skySpot(rad);
      const e1 = V.norm(V.cross(dW, [0, 1, 0]));
      const e2 = V.cross(e1, dW);
      this.skyDir = Wd.worldToSky(dW);
      this.e1 = Wd.worldToSky(e1);
      this.e2 = Wd.worldToSky(e2);
      this.skyRad = rad;
      this.from = T.handPoint();
      this.stars = pts.map((p, i) => ({ x: p[0], y: p[1], c: g[i % g.length].c, t0: 0.1 + i * (D.reduced ? 0.03 : 0.11), s: Math.random() }));
      let minY = 1e9;
      pts.forEach((p) => { if (p[1] < minY) minY = p[1]; });
      this.labelY = minY - 0.034;
      this.label = A.glyphs(this.word);
      this.fly = D.reduced ? 0.02 : 1.15;
      this.closed = !!fig;
      this.P = [];
    }
    emit(W) {
      const e = cam.eye, fa = this.fade;
      const d = Wd.skyToWorld(this.skyDir), e1 = Wd.skyToWorld(this.e1), e2 = Wd.skyToWorld(this.e2);
      const hz = U.smooth(0.012, 0.09, d[1]) * fa;
      if (hz <= 0) return;
      const pxu = Wd.pxAt(SKY_R);
      const emPx = Wd.small ? 16 : 20;
      const emFar = pxu * emPx;
      const lift = (1 - fa) * 14;
      const P = this.P;
      P.length = 0;
      const st = this.stars;
      for (let i = 0; i < st.length; i++) {
        const s = st[i];
        const k = U.clamp((this.age - s.t0) / this.fly, 0, 1);
        const dir = V.norm([d[0] + e1[0] * s.x + e2[0] * s.y, d[1] + e1[1] * s.x + e2[1] * s.y, d[2] + e1[2] * s.x + e2[2] * s.y]);
        let x = e[0] + dir[0] * SKY_R, y = e[1] + dir[1] * SKY_R + lift, z = e[2] + dir[2] * SKY_R;
        let em = emFar, al = 1;
        if (k < 1) {
          const ek = U.easeInOut(k);
          x = this.from[0] + (x - this.from[0]) * ek;
          y = this.from[1] + (y - this.from[1]) * ek;
          z = this.from[2] + (z - this.from[2]) * ek;
          const dd = Math.hypot(x - e[0], y - e[1], z - e[2]);
          em = Wd.pxAt(dd) * U.lerp(26, emPx, ek);
          al = Math.min(1, k * 7);
        }
        const flash = k >= 1 ? Math.exp(-(this.age - s.t0 - this.fly) * 2.2) : 0;
        if (k > 0) {
          W.bb(x, y, z, em, 0, 1.0, 0.94, 0.78, 0.96 * al * hz, s.c, s.s, 0.3, 0.2);
          W.spr(x, y, z, em * (1.05 + flash * 1.7), 0, 1, 1, 1.0, 0.86, 0.6, (0.15 + 0.5 * flash) * al * hz, FX.glow, 0);
        }
        P.push(x, y, z, k);
      }
      // threads between neighbours, drawn once both have arrived
      const segs = st.length - 1;
      for (let i = 0; i < segs; i++) {
        const j = i + 1;
        const ka = P[i * 4 + 3], kb = P[j * 4 + 3];
        if (ka < 1 || kb < 1) continue;
        const gk = U.clamp((this.age - Math.max(st[i].t0, st[j].t0) - this.fly) / 0.55, 0, 1);
        if (gk <= 0) continue;
        const ax = P[i * 4], ay = P[i * 4 + 1], az = P[i * 4 + 2];
        const bx = P[j * 4], by = P[j * 4 + 1], bz = P[j * 4 + 2];
        let dx = bx - ax, dy = by - ay, dz = bz - az;
        const len = Math.hypot(dx, dy, dz);
        const pad = Math.min(len * 0.32, emFar * 0.62);
        if (len < pad * 2.2) continue;
        dx /= len; dy /= len; dz /= len;
        const l2 = (len - pad * 2) * gk;
        const mx = ax + dx * (pad + l2 / 2), my = ay + dy * (pad + l2 / 2), mz = az + dz * (pad + l2 / 2);
        const rot = Math.atan2(dx * cam.Up[0] + dy * cam.Up[1] + dz * cam.Up[2], dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2]);
        W.spr(mx, my, mz, l2 / 2, rot, 1, (pxu * 9.5) / Math.max(l2 / 2, 0.001), 0.74, 0.82, 1.0, 0.36 * hz, FX.bar, 0);
      }
      // its name, small, underneath
      const lastT = st[st.length - 1].t0 + this.fly;
      const la = U.smooth(lastT + 0.3, lastT + 1.6, this.age) * 0.55 * hz;
      if (la > 0.004) {
        const em = pxu * (Wd.small ? 8.5 : 10);
        const tr = 1.5;
        let xo = -this.label.w * tr * 0.5;
        for (const q of this.label) {
          if (!q.sp) {
            const sx = ((xo + q.a * tr * 0.5) * em) / SKY_R;
            const dir = V.norm([d[0] + e1[0] * sx + e2[0] * this.labelY, d[1] + e1[1] * sx + e2[1] * this.labelY, d[2] + e1[2] * sx + e2[2] * this.labelY]);
            W.bb(e[0] + dir[0] * SKY_R, e[1] + dir[1] * SKY_R + lift, e[2] + dir[2] * SKY_R, em, 0, 0.8, 0.86, 1.0, la, q.c, 0.3, 0.9, 0);
          }
          xo += q.a * tr;
        }
      }
    }
  }
  T.Constellation = Constellation;

  /* ----------------------------------------------------------------- rain */
  class Rain extends Thing {
    constructor(hit) {
      super(hit);
      this.weather = true;
      this.pool = T.namePool('rain', this.word);
      this.n = D.lowPower ? 64 : 118;
      this.dur = 58;
      this.drops = [];
      for (let i = 0; i < this.n; i++) this.drops.push(this.drop(true));
      this.k = 0;
      this.ringTurn = 0;
    }
    drop(first) {
      const d = 9 + 140 * Math.pow(Math.random(), 1.4);
      const half = d * cam.tanX * 1.2 + 5;
      return {
        x: cam.eye[0] + U.rr(-half, half), z: -d, y: first ? U.rr(0, 72) : U.rr(52, 78),
        v: U.rr(32, 50), g: noSp(A.glyphs(U.pick(this.pool))), em: d * 0.0128 + 0.1, s: Math.random(),
      };
    }
    extend() { this.age = Math.min(this.age, 4); this.dying = false; this.fade = 1; }
    update(dt) {
      this.k = U.smooth(0, 3.5, this.age) * (1 - U.smooth(this.dur - 7, this.dur, this.age));
      if (this.age > this.dur && !this.dying) this.release();
      const q = dt * D.motion;
      const drift = Wd.wind * 16;
      for (let i = 0; i < this.n; i++) {
        const p = this.drops[i];
        p.y -= p.v * q;
        p.x += drift * q;
        if (p.y < 0) {
          if (this.k > 0.2 && (this.ringTurn++ % 3) === 0) T.ring(p.x, p.z, 0.7 - p.z * 0.02, 0.75, 0.42 * this.k);
          this.drops[i] = this.drop(false);
        }
      }
      if (D.Sound) D.Sound.weather('rain', this.k * this.fade);
    }
    emit(W) {
      const al = 0.58 * this.k * this.fade;
      if (al <= 0.004) return;
      const slant = Wd.wind * 0.34;
      const sx = Math.sin(slant);
      for (let i = 0; i < this.n; i++) {
        const p = this.drops[i];
        const g = p.g, m = g.length;
        for (let j = 0; j < m; j++) {
          const yy = p.y + (m - 1 - j) * p.em * 1.08;
          W.bb(p.x + sx * (m - 1 - j) * p.em, yy, p.z, p.em, slant * 0.8, 0.7, 0.85, 1.0, al, g[j].c, p.s, 0.45, 0, 0.9, 1.28);
        }
      }
    }
    onDead() { if (D.Sound) D.Sound.weather('rain', 0); }
  }

  /* ----------------------------------------------------------------- snow */
  class Snow extends Thing {
    constructor(hit) {
      super(hit);
      this.weather = true;
      this.pool = T.namePool('snow', this.word);
      this.n = D.lowPower ? 170 : 310;
      this.dur = 80;
      this.f = [];
      for (let i = 0; i < this.n; i++) this.f.push(this.flake(true));
      this.k = 0;
    }
    flake(first) {
      const d = 7 + 125 * Math.pow(Math.random(), 1.7);
      const half = d * cam.tanX * 1.2 + 5;
      const g = noSp(A.glyphs(U.pick(this.pool)));
      return {
        x: cam.eye[0] + U.rr(-half, half), z: -d, y: first ? U.rr(0, 62) : U.rr(46, 66),
        v: U.rr(2.2, 5.2), c: g[(Math.random() * g.length) | 0].c, em: d * 0.0125 + 0.08, ph: Math.random() * TAU, s: Math.random(),
      };
    }
    extend() { this.age = Math.min(this.age, 4); this.dying = false; this.fade = 1; }
    update(dt) {
      this.k = U.smooth(0, 4, this.age) * (1 - U.smooth(this.dur - 9, this.dur, this.age));
      if (this.age > this.dur && !this.dying) this.release();
      const q = dt * D.motion, t = Wd.t;
      for (let i = 0; i < this.n; i++) {
        const p = this.f[i];
        p.y -= p.v * q;
        p.x += (Math.sin(t * 0.6 + p.ph) * 1.1 + Wd.wind * 10) * q;
        if (p.y < 0) this.f[i] = this.flake(false);
      }
    }
    emit(W) {
      const al = 0.84 * this.k * this.fade;
      if (al <= 0.004) return;
      const t = Wd.t * D.motion;
      for (let i = 0; i < this.n; i++) {
        const p = this.f[i];
        W.bb(p.x, p.y, p.z, p.em, Math.sin(t * 0.5 + p.ph) * 0.7, 0.93, 0.96, 1.0, al, p.c, p.s, 0.5, 0.22);
      }
    }
  }

  /* ----------------------------------------------------------------- wind */
  class Wind extends Thing {
    constructor(hit) {
      super(hit);
      this.weather = true;
      this.pool = T.namePool('wind', this.word);
      this.dur = 24;
      this.n = D.lowPower ? 7 : 11;
      this.s = [];
      for (let i = 0; i < this.n; i++) this.s.push(this.streak(true));
      this.k = 0;
    }
    streak(first) {
      const d = U.rr(26, 190);
      const half = d * cam.tanX * 1.25;
      const g = [];
      const reps = 2 + ((Math.random() * 2) | 0);
      for (let r = 0; r < reps; r++) {
        if (r > 0) g.push({ c: -1, a: 0.9, sp: true });
        noSp(A.glyphs(U.pick(this.pool))).forEach((q) => g.push(q));
      }
      const em = d * 0.016 + 0.1;
      return {
        d, half, g, em, z: -d, y0: U.rr(3, 8 + d * 0.3), amp: U.rr(1, 3.2) * (0.4 + d * 0.012), kx: U.rr(0.03, 0.07) * (60 / (d + 20)),
        ph: Math.random() * TAU, x: first ? U.rr(-half, half) : -half - 4, v: U.rr(36, 56) * (0.5 + d * 0.006), s: Math.random(),
      };
    }
    extend() { this.age = Math.min(this.age, 3); this.dying = false; this.fade = 1; }
    update(dt) {
      this.k = U.smooth(0, 2.5, this.age) * (1 - U.smooth(this.dur - 6, this.dur, this.age));
      Wd.windTarget = this.k > 0.02 && !this.dying ? 1 : 0;
      if (this.age > this.dur && !this.dying) { this.release(); Wd.windTarget = 0; }
      const q = dt * D.motion;
      for (let i = 0; i < this.n; i++) {
        const p = this.s[i];
        p.x += p.v * q;
        let len = 0;
        for (const g of p.g) len += g.a * p.em;
        if (p.x - len > p.half + 4) this.s[i] = this.streak(false);
      }
      if (D.Sound) D.Sound.weather('wind', this.k * this.fade);
    }
    emit(W) {
      const base = 0.8 * this.k * this.fade;
      if (base <= 0.004) return;
      const t = Wd.t * D.motion;
      for (let i = 0; i < this.n; i++) {
        const p = this.s[i];
        const m = p.g.length;
        let x = p.x + cam.eye[0];
        for (let j = 0; j < m; j++) {
          const g = p.g[m - 1 - j];
          const w = g.a * p.em * 1.12;
          x -= w * 0.5;
          if (!g.sp) {
            const a = x * p.kx + p.ph + t * 0.7;
            const y = p.y0 + p.amp * Math.sin(a);
            const rot = Math.atan(p.amp * p.kx * Math.cos(a));
            const al = base * Math.pow(1 - j / m, 1.3);
            W.bb(x, y, p.z, p.em, rot, 0.82, 0.92, 1.0, al, g.c, p.s, 0.4, 0);
          }
          x -= w * 0.5;
        }
      }
    }
    onDead() { Wd.windTarget = 0; if (D.Sound) D.Sound.weather('wind', 0); }
  }

  /* ---------------------------------------------------------------- birds */
  class Birds extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('bird', this.word);
      this.n = D.lowPower ? 15 : 25;
      this.b = [];
      const hand = T.handPoint();
      for (let i = 0; i < this.n; i++) {
        const g = A.glyphs(U.pick(this.pool));
        this.b.push({
          p: [hand[0] + U.rr(-3, 3), hand[1] + U.rr(-1, 2), hand[2] + U.rr(-3, 1)],
          v: [U.rr(-6, 6), U.rr(7, 13), U.rr(-22, -12)],
          g: noSp(g), w: g.w, ph: Math.random() * TAU, fl: U.rr(6.5, 9), s: Math.random(), wait: i * 0.07,
          off: [U.rr(-30, 30), U.rr(-13, 13), U.rr(-24, 24)],
        });
      }
      this.chirp = 1.5;
      if (D.reduced) {
        this.b.forEach((b) => { b.p = [U.rr(-70, 70), U.rr(24, 70), U.rr(-200, -90)]; b.v = [U.rr(-10, 10), 0, U.rr(-4, 4)]; b.wait = 0; });
      }
    }
    update(dt) {
      const q = dt * D.motion, t = Wd.t;
      let tx = 62 * Math.sin(t * 0.13), ty = 44 + 15 * Math.sin(t * 0.21), tz = -150 + 46 * Math.cos(t * 0.17);
      if (T.lightInSky()) {
        const r = Wd.ray(Wd.ptr.x, Wd.ptr.y);
        tx = cam.eye[0] + r[0] * 140; ty = cam.eye[1] + r[1] * 140; tz = cam.eye[2] + r[2] * 140;
      }
      const B = this.b, n = this.n;
      for (let i = 0; i < n; i++) {
        const b = B[i];
        if (this.age < b.wait) continue;
        const p = b.p, v = b.v;
        const o3 = b.off, sw = Math.sin(t * 0.3 + b.ph), cw = Math.cos(t * 0.3 + b.ph);
        let ax = (tx + o3[0] * cw - o3[2] * sw - p[0]) * 0.22, ay = (ty + o3[1] - p[1]) * 0.3, az = (tz + o3[0] * sw + o3[2] * cw - p[2]) * 0.22;
        let cx = 0, cy = 0, cz = 0, cn = 0;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const o = B[j].p;
          const dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 240 && d2 > 0.0001) { const f = 60 / d2; ax += dx * f; ay += dy * f; az += dz * f; }
          if (d2 < 900) { cx += B[j].v[0]; cy += B[j].v[1]; cz += B[j].v[2]; cn++; }
        }
        if (cn) { ax += (cx / cn - v[0]) * 0.35; ay += (cy / cn - v[1]) * 0.35; az += (cz / cn - v[2]) * 0.35; }
        if (p[1] < 13) ay += (13 - p[1]) * 2.2;
        if (p[1] > 96) ay -= (p[1] - 96) * 1.2;
        ax += Wd.wind * 5;
        v[0] += ax * q; v[1] += ay * q; v[2] += az * q;
        const sp = Math.hypot(v[0], v[1], v[2]) || 1;
        const lim = U.clamp(sp, 13, 27) / sp;
        v[0] *= lim; v[1] *= lim * 0.985; v[2] *= lim;
        p[0] += v[0] * q; p[1] += v[1] * q; p[2] += v[2] * q;
      }
      this.chirp -= dt;
      if (this.chirp <= 0 && !this.dying) {
        this.chirp = U.rr(2.5, 7);
        if (D.Sound) D.Sound.chirp();
      }
    }
    emit(W) {
      const fa = this.fade, t = Wd.t, e = cam.eye, Rv = cam.R, Uv = cam.Up;
      const lift = (1 - fa) * 8;
      for (let i = 0; i < this.n; i++) {
        const b = this.b[i];
        if (this.age < b.wait) continue;
        const p = b.p;
        const dd = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
        const em = Wd.pxAt(dd) * (Wd.small ? 11 : 13.5);
        const flap = D.reduced ? 0.4 : Math.sin(t * b.fl + b.ph);
        const vs = b.v[0] * Rv[0] + b.v[1] * Rv[1] + b.v[2] * Rv[2];
        const vu = b.v[0] * Uv[0] + b.v[1] * Uv[1] + b.v[2] * Uv[2];
        const bank = U.clamp(Math.atan2(vu, Math.abs(vs) + 6), -0.5, 0.5) * (vs >= 0 ? 1 : -1);
        const cb = Math.cos(bank), sb = Math.sin(bank);
        const g = b.g, m = g.length;
        const al = 0.92 * fa * Math.min(1, (this.age - b.wait) * 3);
        if (m === 1) {
          W.bb(p[0], p[1] + lift, p[2], em * 1.25, bank + flap * 0.12, 0.96, 0.96, 1.0, al, g[0].c, b.s, 0.5, 0, 1, 0.72 + 0.28 * flap);
          continue;
        }
        let xo = -b.w * 0.5;
        const mid = b.w * 0.5;
        for (let j = 0; j < m; j++) {
          const q = g[j];
          const cx = xo + q.a * 0.5;
          const lx = cx * em;
          const ly = (Math.abs(cx) / (mid || 1)) * mid * em * 0.42 * flap;
          const wx = lx * cb - ly * sb, wy = lx * sb + ly * cb;
          const tilt = (cx < 0 ? -1 : 1) * flap * 0.36;
          W.bb(p[0] + Rv[0] * wx + Uv[0] * wy, p[1] + Rv[1] * wx + Uv[1] * wy + lift, p[2] + Rv[2] * wx + Uv[2] * wy,
            em, bank + tilt, 0.96, 0.96, 1.0, al, q.c, b.s, 0.5, 0);
          xo += q.a;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- stars */
  class Meteor {
    constructor(pool) {
      const hz = T.horizonNdc();
      const a = Wd.ray(U.rr(-0.8, 0.5), U.rr(hz + 0.5, 0.95));
      const b = Wd.ray(U.rr(-0.5, 0.9), U.rr(hz + 0.15, 0.6));
      this.a = a; this.b = V.norm(V.mix(a, b, 0.75));
      this.g = noSp(A.glyphs(U.pick(pool)));
      this.t = 0; this.dur = U.rr(0.85, 1.25);
      this.s = Math.random();
    }
    update(dt) { this.t += dt * (D.reduced ? 0.6 : 1); return this.t < this.dur + 0.5; }
    emit(W) {
      const e = cam.eye, pxu = Wd.pxAt(SKY_R);
      const em = pxu * (Wd.small ? 11 : 14);
      const g = this.g, m = g.length;
      const k = this.t / this.dur;
      const life = Math.min(1, k * 6) * (1 - U.smooth(0.75, 1.25, k));
      const step = 0.016;
      for (let j = 0; j < m; j++) {
        const kk = k - j * step;
        if (kk < 0) continue;
        const d = V.norm(V.mix(this.a, this.b, kk));
        const al = life * Math.pow(1 - j / (m + 1.5), 1.6);
        W.bb(e[0] + d[0] * SKY_R, e[1] + d[1] * SKY_R, e[2] + d[2] * SKY_R, em, 0, 1.0, 0.96, 0.84, al, g[j].c, this.s, 0, 0);
      }
      const h = V.norm(V.mix(this.a, this.b, k));
      const tl = V.norm(V.mix(this.a, this.b, Math.max(0, k - 0.22)));
      const hx = e[0] + h[0] * SKY_R, hy = e[1] + h[1] * SKY_R, hz2 = e[2] + h[2] * SKY_R;
      const tx = e[0] + tl[0] * SKY_R, ty = e[1] + tl[1] * SKY_R, tz = e[2] + tl[2] * SKY_R;
      const dx = hx - tx, dy = hy - ty, dz = hz2 - tz;
      const len = Math.hypot(dx, dy, dz);
      if (len > 0.01) {
        const rot = Math.atan2(dx * cam.Up[0] + dy * cam.Up[1] + dz * cam.Up[2], dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2]);
        W.spr((hx + tx) / 2, (hy + ty) / 2, (hz2 + tz) / 2, len / 2, rot, 1, (pxu * 13) / (len / 2), 1.0, 0.92, 0.75, 0.5 * life, FX.bar, 0);
      }
      W.spr(hx, hy, hz2, pxu * 26, 0, 1, 1, 1.0, 0.92, 0.75, 0.55 * life, FX.glow, 0);
    }
  }

  class Stars extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('star', this.word);
      this.n = D.lowPower ? 26 : 44;
      this.from = T.handPoint();
      const hz = T.horizonNdc();
      this.st = [];
      for (let i = 0; i < this.n; i++) {
        const d = Wd.ray(U.rr(-0.95, 0.95), U.rr(hz + 0.12, 0.98));
        const g = A.glyphs(U.pick(this.pool));
        this.st.push({ dir: Wd.worldToSky(d), g: noSp(g), w: g.w, t0: 0.1 + i * (D.reduced ? 0.01 : 0.05), s: Math.random(), m: 0.5 + Math.random() * 0.5 });
      }
      this.meteorClock = 2.2;
      this.meteors = D.reduced ? 3 : 9;
      this.fly = D.reduced ? 0.02 : 1.3;
    }
    update(dt) {
      this.meteorClock -= dt;
      if (this.meteors > 0 && this.meteorClock <= 0 && !this.dying) {
        this.meteors--;
        this.meteorClock = U.rr(2.2, 5.5);
        T.extras.push(new Meteor(this.pool));
      }
    }
    emit(W) {
      const e = cam.eye, fa = this.fade, pxu = Wd.pxAt(SKY_R);
      for (const s of this.st) {
        const k = U.clamp((this.age - s.t0) / this.fly, 0, 1);
        if (k <= 0) continue;
        const d = Wd.skyToWorld(s.dir);
        const hz = U.smooth(0.012, 0.085, d[1]) * fa;
        if (hz <= 0) continue;
        const ek = U.easeInOut(k);
        let cx = e[0] + d[0] * SKY_R, cy = e[1] + d[1] * SKY_R, cz = e[2] + d[2] * SKY_R;
        cx = this.from[0] + (cx - this.from[0]) * ek;
        cy = this.from[1] + (cy - this.from[1]) * ek;
        cz = this.from[2] + (cz - this.from[2]) * ek;
        const dd = Math.hypot(cx - e[0], cy - e[1], cz - e[2]);
        const emPx = (Wd.small ? 8 : 9.5) + s.m * 3;
        const em = Wd.pxAt(dd) * U.lerp(20, emPx, ek);
        const flash = k >= 1 ? Math.exp(-(this.age - s.t0 - this.fly) * 2) : 0;
        let xo = -s.w * 0.5;
        for (const q of s.g) {
          const off = (xo + q.a * 0.5) * em;
          W.bb(cx + cam.R[0] * off, cy + cam.R[1] * off, cz + cam.R[2] * off, em, 0, 1.0, 0.95, 0.82, 0.9 * hz * Math.min(1, k * 6), q.c, s.s, -0.9, 0.3);
          xo += q.a;
        }
        W.spr(cx, cy, cz, pxu * (12 + s.m * 10 + flash * 40) * (dd / SKY_R), 0, 1, 1, 1.0, 0.9, 0.7, (0.28 + 0.5 * flash) * hz, FX.glow, 0);
      }
    }
  }

  /* ------------------------------------------------------------ the roster */
  const M = T.makers;
  M.rain = (hit) => new Rain(hit);
  M.snow = (hit) => new Snow(hit);
  M.wind = (hit) => { Wd.gust += 0.5; return new Wind(hit); };
  M.bird = (hit) => new Birds(hit);
  M.star = (hit) => new Stars(hit);
  M.plain = (hit) => new Constellation(hit);

  /* words that change the night itself rather than adding a thing to it */
  M.love = () => {
    T.targets.companion = 1;
    Wd.firePulse(Wd.ptr.x, Wd.ptr.y, 1.0);
    return null;
  };
  M.light = () => {
    T.targets.lightSize = Math.min(1.9, T.targets.lightSize + 0.4);
    Wd.firePulse(Wd.ptr.x, Wd.ptr.y, 0.8);
    return null;
  };
  M.you = M.light;
  M.name = () => { Wd.firePulse(Wd.ptr.x, Wd.ptr.y, 1.5); return null; };
  M.night = () => {
    Wd.starBoostTarget = Math.min(2.3, Wd.starBoostTarget + 0.6);
    D.night.spinTarget += 0.06;
    return null;
  };
  M.time = () => {
    D.night.spinTarget += 0.5;
    D.night.p = Math.min(0.86, D.night.p + 0.1);
    return null;
  };
  M.sea = () => { Wd.gust += 1.3; Wd.addRipple(0, -150, 3.4, true); return null; };
  M.wave = M.sea;
  M.mountain = () => { Wd.firePulse(0, T.horizonNdc(), 1.2); return null; };
  M.dream = () => {
    if (D.reduced) Wd.firePulse(Wd.ptr.x, Wd.ptr.y, 1.4);
    else { Wd.flightTarget = 1; T.flightClock = 15; }
    return null;
  };
  M.morning = () => { if (D.UI) D.UI.readyWake(); return null; };

  const SINGLE = { rain: 1, snow: 1, wind: 1, star: 1, bird: 1, aurora: 1, butterfly: 1, fish: 1, moon: 1, cloud: 1, road: 1, song: 1, lighthouse: 1, home: 1 };

  T.spawn = function (hit) {
    const kind = hit.kind;
    // weather and flocks are renewed rather than doubled
    if (SINGLE[kind]) {
      for (const o of T.list) {
        if (o.kind === kind && !o.dead) {
          if (o.extend && !o.dying) { o.extend(hit); return; }
          if (!o.dying) o.release();
        }
      }
    }
    const make = M[kind] || M.plain;
    let th = null;
    try {
      th = make(hit);
    } catch (err) {
      console.error(err);
      th = null;
    }
    if (th) {
      T.list.push(th);
      limit();
    }
  };

  function limit() {
    const max = D.lowPower ? 7 : 10;
    const live = T.list.filter((o) => !o.dying && !o.weather);
    if (live.length > max) {
      live[0].release();
      if (!T.saidForget) { T.saidForget = true; if (D.UI) D.UI.forgetting(); }
    }
    // never more than two of one kind
    const seen = {};
    for (let i = T.list.length - 1; i >= 0; i--) {
      const o = T.list[i];
      if (o.dying || o.kind === 'plain') continue;
      seen[o.kind] = (seen[o.kind] || 0) + 1;
      if (seen[o.kind] > 2) o.release();
    }
  }

  T.update = function (dt) {
    const tg = T.targets;
    const k = 1 - Math.exp(-dt * 0.9);
    Wd.companion += (tg.companion - Wd.companion) * k;
    Wd.lightSize += (tg.lightSize - Wd.lightSize) * k;
    Wd.moonBoost += (tg.moonBoost - Wd.moonBoost) * k;
    Wd.moonSize += (tg.moonSize - Wd.moonSize) * k;
    if (T.flightClock > 0) {
      T.flightClock -= dt;
      if (T.flightClock <= 0) Wd.flightTarget = 0;
    }
    let aur = 0;
    for (let i = T.list.length - 1; i >= 0; i--) {
      const o = T.list[i];
      try {
        o.tick(dt);
      } catch (err) {
        console.error(err);
        o.dead = true;
      }
      if (o.kind === 'aurora') aur = Math.max(aur, o.glow || 0);
      if (o.dead) T.list.splice(i, 1);
    }
    Wd.aur += (aur - Wd.aur) * (1 - Math.exp(-dt * 1.5));
    for (let i = T.extras.length - 1; i >= 0; i--) {
      let alive = false;
      try { alive = T.extras[i].update(dt); } catch (err) { console.error(err); }
      if (!alive) T.extras.splice(i, 1);
    }
    for (let i = T.rings.length - 1; i >= 0; i--) {
      const r = T.rings[i];
      r.t += dt * D.motion;
      if (r.t >= r.life) T.rings.splice(i, 1);
    }
  };

  T.emit = function (W) {
    for (const o of T.list) {
      try {
        o.emit(W);
      } catch (err) {
        console.error(err);
        o.dead = true;
      }
    }
    emitTouched(W);
    emitRings(W);
    for (const x of T.extras) {
      try { x.emit(W); } catch (err) { console.error(err); x.end = 0; x.dur = 0; }
    }
  };

  T.releaseAll = function () {
    for (const o of T.list) if (!o.dying) o.release();
    Wd.windTarget = 0;
    T.flightClock = 0;
    Wd.flightTarget = 0;
  };
  T.onWake = function () {
    for (const o of T.list) if (o.weather && !o.dying) o.release();
    Wd.windTarget = 0;
    T.flightClock = 0;
    Wd.flightTarget = 0;
    if (D.Sound) { D.Sound.weather('rain', 0); D.Sound.weather('wind', 0); }
  };
  T.clear = function () {
    for (const o of T.list) if (o.onDead) o.onDead();
    T.list.length = 0; T.extras.length = 0; T.rings.length = 0; T.touched.length = 0;
    T.targets.companion = 0; T.targets.lightSize = 1; T.targets.moonBoost = 1; T.targets.moonSize = 1;
    T.flightClock = 0; T.saidForget = false;
    Wd.windTarget = 0; Wd.aur = 0;
  };
})();
