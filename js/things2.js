/* 말로 지은 밤 — a night made of words
   things2.js : what a word turns into. Part two: the larger things — whale, tree,
   flowers, boat, fire, aurora, butterflies, fish, clouds, home, lighthouse, road,
   island, the moon's halo, and a name that keeps the light company. */
(function () {
  'use strict';
  const D = window.Dream, U = D.U, V = U.v, A = D.Atlas, L = D.Lex, Wd = D.World, T = D.Things;
  const TAU = U.TAU, SKY_R = Wd.SKY_R, FX = A.FX, cam = Wd.cam;
  const Thing = T.Thing, noSp = T.noSp, M = T.makers;

  /* a little ground lying on the water, written in the word for ground */
  function makeIslet(a, b, em, pool) {
    const st = Wd.seaStretch || 1.6;
    const next = T.stream(pool);
    const out = [];
    const gap = em * st * 1.12;
    for (let z = -b + gap * 0.5; z < b; z += gap) {
      let x = -a + Math.random() * em;
      while (x < a) {
        const q = next();
        const w = q.a * em * 1.03;
        if (!q.sp) {
          const u = (x + w / 2) / a, v = z / b;
          const d = 1 - u * u - v * v;
          if (d > 0) out.push({ x: x + w / 2, z, c: q.c, d: Math.min(1, d * 2.2), s: Math.random() });
        }
        x += w;
      }
    }
    out.em = em; out.st = st;
    return out;
  }
  function emitIslet(W, isl, x, z, alpha, r, g, b) {
    if (alpha <= 0.004) return;
    for (const q of isl) W.flat(x + q.x, 0.14, z + q.z, isl.em, isl.st, r, g, b, alpha * q.d, q.c, q.s, 0.5);
  }

  /* ---------------------------------------------------------------- whale */
  class Whale extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('whale', this.word);
      const sp = T.seaSpot(84, 130, 30);
      this.z = sp[1];
      this.dist = sp[2];
      this.sc = U.clamp((this.dist * cam.tanX * 1.5) / 100, 0.42, 1);
      this.L = 60 * this.sc;
      this.x0 = sp[0];
      this.dir = this.x0 > cam.eye[0] ? -1 : 1;
      this.seaPos = [this.x0, this.z];
      this.seaRad = 30;
      this.arcs = 0;
      this.state = 'arc';
      this.build();
      this.begin(!D.reduced);
      const wait = T.fly(this.word, [this.x0 - this.dir * this.span * 0.32, 0, this.z], 26, 1.3, [0.8, 0.93, 1.0], 11);
      this.hold = wait + 0.15;
      this._x = 0; this._y = 0; this._a = 0;
    }
    build() {
      const Lw = this.L, dir = this.dir;
      const em = Lw * 0.0235, gap = em * 1.3;
      const cs = Math.cos(0.56), sn = Math.sin(0.56);
      const inside = (x, y) => {
        const s = (x * dir) / Lw + 0.5, yy = y / Lw;
        if (s > 0.045 && s < 1) {
          const Tk = 0.155 * Math.pow(Math.max(Math.sin(Math.PI * Math.pow(s, 1.45)), 0), 0.62);
          const c0 = 0.012 * Math.sin(Math.PI * s);
          const top = c0 + Tk, bot = c0 - Tk * 0.86;
          if (yy < top && yy > bot) return 1 + (yy - bot) / (top - bot);        // 1 belly … 2 back
        }
        if (s > -0.03 && s < 0.105) {                                            // the flukes
          const u = (s + 0.03) / 0.135;
          const H = 0.175 * Math.pow(1 - u, 0.75) + 0.016;
          const notch = s < 0.02 ? 0.075 * (1 - (s + 0.03) / 0.05) : 0;
          if (Math.abs(yy) < H && Math.abs(yy) > notch) return 3;
        }
        const dx = s - 0.6, dy = yy + 0.118;                                     // the fin, swept back and down
        const xr = dx * cs + dy * sn, yr = -dx * sn + dy * cs;
        if ((xr * xr) / (0.085 * 0.085) + (yr * yr) / (0.028 * 0.028) < 1) return 4;
        return 0;
      };
      this.g = T.fillShape(inside, -Lw * 0.56, Lw * 0.52, -Lw * 0.2, Lw * 0.2, em, gap, T.stream(this.pool), []);
      this.em = em;
    }
    /* one arc through the surface: up out of the deep, over, and back down */
    begin(breach) {
      const sc = this.sc;
      this.breach = breach;
      const span = (breach ? 100 : 80) * sc, top = (breach ? 27 : 3.3) * sc, deep = (breach ? -35 : -12.5) * sc;
      const pw = breach ? 2.0 : 2.4;
      const N = 140;
      this.px = new Float32Array(N + 1); this.py = new Float32Array(N + 1); this.pl = new Float32Array(N + 1);
      let len = 0;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const x = (k - 0.5) * span;
        const y = deep + (top - deep) * (1 - Math.pow(Math.abs(2 * k - 1), pw));
        if (i > 0) len += Math.hypot(x - this.px[i - 1], y - this.py[i - 1]);
        this.px[i] = x; this.py[i] = y; this.pl[i] = len;
      }
      this.len = len; this.span = span; this.top = top;
      this.u = -this.L * 0.45;
      this.vmin = breach ? 7.5 : 5;
      this.grav = breach ? 8 : 3;
      this.headWas = 0;
      this.spouted = false;
      this.sung = false;
    }
    at(a) {
      const px = this.px, py = this.py, pl = this.pl, N = pl.length - 1;
      if (a <= 0) {
        const dx = px[1] - px[0], dy = py[1] - py[0], l = Math.hypot(dx, dy) || 1;
        this._x = px[0] + (dx / l) * a; this._y = py[0] + (dy / l) * a; this._a = Math.atan2(dy, dx);
        return;
      }
      if (a >= this.len) {
        const dx = px[N] - px[N - 1], dy = py[N] - py[N - 1], l = Math.hypot(dx, dy) || 1, o = a - this.len;
        this._x = px[N] + (dx / l) * o; this._y = py[N] + (dy / l) * o; this._a = Math.atan2(dy, dx);
        return;
      }
      let lo = 0, hi = N;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pl[mid] <= a) lo = mid; else hi = mid; }
      const f = (a - pl[lo]) / (pl[hi] - pl[lo] || 1);
      this._x = px[lo] + (px[hi] - px[lo]) * f;
      this._y = py[lo] + (py[hi] - py[lo]) * f;
      this._a = Math.atan2(py[hi] - py[lo], px[hi] - px[lo]);
    }
    burst(x, power) {
      const sc = this.sc;
      Wd.addRipple(x, this.z, 2.4 * power, true);
      T.ring(x, this.z, 15 * sc * power, 2.2, 0.6);
      T.ring(x, this.z, 8 * sc * power, 1.4, 0.5);
      T.splash(x, this.z, Math.round(110 * power), 15 * sc * Math.sqrt(power), 4 * sc, 1.1);
      if (D.Sound) D.Sound.splash(power);
    }
    update(dt) {
      if (this.age < this.hold) return;
      if (this.state === 'under') {
        this.wait -= dt;
        if (this.wait <= 0 && !this.dying) {
          const endX = this.x0 + this.dir * this.span * 0.5;
          const half = this.dist * cam.tanX * 0.8;
          this.arcs++;
          const breach = !D.reduced && this.arcs % 3 === 0;      // two quiet rolls, then another leap
          const nextSpan = (breach ? 100 : 80) * this.sc;
          let x0 = endX + this.dir * (nextSpan * 0.5 + U.rr(4, 16) * this.sc);
          if (Math.abs(x0 + this.dir * nextSpan * 0.5 - cam.eye[0]) > half) {
            this.dir = -this.dir;
            x0 = endX + this.dir * nextSpan * 0.5;
            this.build();
          }
          this.x0 = x0;
          this.begin(breach);
          this.state = 'arc';
        }
        return;
      }
      const q = dt * (D.reduced ? 0.5 : 1);
      this.at(this.u);
      const v = Math.sqrt(this.vmin * this.vmin + 2 * this.grav * Math.max(0, this.top - this._y));
      this.u += v * q;
      this.seaPos[0] = this.x0 + this.dir * this._x;

      this.at(this.u + this.L * 0.46);
      const hx = this.x0 + this.dir * this._x;
      const headUp = this._y > 0 ? 1 : 0;
      if (this.headWas === 0 && headUp === 1) {
        this.burst(hx, this.breach ? 1 : 0.35);
        if (!this.sung && D.Sound) { this.sung = true; D.Sound.whale(); }
      }
      if (this.headWas === 1 && headUp === 0) this.burst(hx, this.breach ? 1.5 : 0.4);
      this.headWas = headUp;

      if (!this.spouted && !this.breach && this.u > this.len * 0.5 - this.L * 0.3) {
        this.spouted = true;
        this.at(this.u + this.L * 0.3);
        T.splash(this.x0 + this.dir * this._x, this.z, 44, 11 * this.sc, 0.4, 1.45);
      }
      if (this.u - this.L * 0.52 > this.len) { this.state = 'under'; this.wait = U.rr(12, 20); }
    }
    emit(W) {
      if (this.state !== 'arc' || this.age < this.hold) return;
      const fa = this.fade, Lw = this.L, dir = this.dir, z = this.z, t = Wd.t * D.motion, em = this.em;
      const appear = U.smooth(this.hold, this.hold + 1.2, this.age);
      const lift = (1 - fa) * 10;
      const G = this.g;
      for (let i = 0; i < G.length; i++) {
        const g = G[i];
        const s = (g.x * dir) / Lw + 0.5;
        this.at(this.u + g.x * dir);
        const a = this._a, ca = Math.cos(a), sa = Math.sin(a);
        const ly = g.y + Math.sin(t * 2.2 - s * 4.2) * 0.012 * Lw * (1 - s);
        const wx = this.x0 + dir * (this._x - sa * ly);
        const wy = this._y + ca * ly;
        const above = U.smooth(-1.6, 0.9, wy - Wd.seaH(wx, z));
        let r, gg, b;
        if (g.d >= 3) { r = 0.68; gg = 0.87; b = 1.0; }
        else {
          const v = g.d - 1;
          const rim = v > 0.82 ? 1.32 : 1;
          r = U.lerp(0.93, 0.6, v) * rim; gg = U.lerp(0.98, 0.8, v) * rim; b = rim;
        }
        W.bb(wx, wy + lift * g.s, z, em, dir > 0 ? a : -a, r, gg, b, (0.05 + 0.87 * above) * fa * appear, g.c, g.s, 0.45, 0);
      }
    }
  }

  /* ----------------------------------------------------------------- tree */
  class Tree extends Thing {
    constructor(hit) {
      super(hit);
      const pool = T.namePool('tree', this.word);
      const sp = T.seaSpot(40, 76, 17);
      this.x = sp[0]; this.z = sp[1];
      this.seaPos = [this.x, this.z];
      this.seaRad = 17;
      const sc = (this.sc = (sp[2] / 60) * (Wd.portrait ? 1.1 : 1));
      this.limbs = [];
      this.leaves = [];
      const next = T.stream(pool);
      const leafPool = L.names.leaf;
      const speed = 6.2, maxDepth = 4;
      const cols = [[0.56, 0.95, 0.6], [0.7, 1.0, 0.56], [0.5, 0.88, 0.7], [1.0, 0.88, 0.52], [0.8, 1.0, 0.7]];
      const perEnd = D.lowPower ? 7 : 11;
      const grow = (x, y, a, len, em, depth, t0) => {
        const flip = Math.cos(a) < -0.12;
        const n = Math.max(2, Math.round(len / (em * 0.84)));
        const qs = [];
        while (qs.length < n) { const q = next(); if (!q.sp) qs.push(q); }
        const curve = U.rr(-1, 1) * 0.07;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let i = 0; i < n; i++) {
          const k = depth === 0 ? (i + 0.5) / n : 0.1 + (0.9 * (i + 0.5)) / n;
          const bend = Math.sin(k * Math.PI) * len * curve;
          const q = qs[flip ? n - 1 - i : i];
          this.limbs.push({
            x: x + ca * len * k - sa * bend, y: y + sa * len * k + ca * bend,
            rot: flip ? a + Math.PI : a, em, c: q.c, t: t0 + (k * len) / speed, depth, s: Math.random(),
          });
        }
        const ex = x + ca * len, ey = y + sa * len, t1 = t0 + len / speed;
        if (depth >= maxDepth) {
          for (let i = 0; i < perEnd; i++) {
            const g = noSp(A.glyphs(leafPool[(Math.random() * leafPool.length) | 0]));
            const rr = Math.sqrt(Math.random()) * 2.7, aa = Math.random() * TAU;
            this.leaves.push({
              x: ex + Math.cos(aa) * rr, y: ey + Math.sin(aa) * rr * 0.8 + 0.5,
              c: g[(Math.random() * g.length) | 0].c, em: U.rr(0.72, 1.05), col: cols[(Math.random() * cols.length) | 0],
              t: t1 + 0.2 + Math.random() * 0.9, ph: Math.random() * TAU, s: Math.random(), fall: -1, fx: 0, fy: 0,
            });
          }
          return;
        }
        const kids = depth === 0 ? 3 : Math.random() < 0.3 ? 3 : 2;
        for (let k = 0; k < kids; k++) {
          let da;
          if (kids === 3) da = (k - 1) * U.rr(0.42, 0.66) + U.rr(-0.1, 0.1);
          else da = (k === 0 ? -1 : 1) * U.rr(0.3, 0.58);
          const na = U.clamp(a + da, 0.2, Math.PI - 0.2);         // limbs reach outward, never down
          grow(ex, ey, na, len * U.rr(0.66, 0.8), em * 0.8, depth + 1, t1);
        }
      };
      grow(0, 0, Math.PI / 2 + U.rr(-0.07, 0.07), 9.5, 1.9, 0, 0);
      this.isl = makeIslet(9 * sc, 5.5 * sc, 0.95 * sc, L.names.earth);
      this.hold = T.fly(this.word, [this.x, 1, this.z], 18, 1.1, [0.9, 1.0, 0.7], 14);
      this.fallClock = 7;
      if (D.Sound) D.Sound.grow();
    }
    update(dt) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      this.fallClock -= dt;
      if (this.fallClock <= 0 && !this.dying) {
        this.fallClock = U.rr(1.2, 2.8) / (1 + Wd.wind * 2);
        const lf = this.leaves[(Math.random() * this.leaves.length) | 0];
        if (lf && lf.fall < 0 && ga > lf.t + 1) { lf.fall = 0; lf.fx = 0; lf.fy = 0; }
      }
      const q = dt * D.motion;
      for (const lf of this.leaves) {
        if (lf.fall < 0) continue;
        lf.fall += q;
        lf.fy -= (2.1 + Math.sin(lf.fall * 3 + lf.ph) * 0.8) * q;
        lf.fx += (Math.sin(lf.fall * 2.2 + lf.ph) * 1.6 + Wd.wind * 6) * q;
        if ((lf.y + lf.fy) * this.sc <= 0.1) {
          T.ring(this.x + (lf.x + lf.fx) * this.sc, this.z, 1.6 * this.sc, 0.9, 0.5, 0.8, 1.0, 0.8);
          lf.fall = -1; lf.fx = 0; lf.fy = 0; lf.t = ga + 1.5;        // another leaf grows where it was
        }
      }
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade, sc = this.sc, x0 = this.x, z = this.z;
      const base = Wd.seaH(x0, z) * 0.35;
      const t = Wd.t * D.motion, wind = 0.22 + Wd.wind * 1.5;
      const lift = (1 - fa) * 9;
      emitIslet(W, this.isl, x0, z, 0.55 * fa * U.smooth(0, 1.2, ga), 0.78, 0.64, 0.46);
      for (const g of this.limbs) {
        const k = (ga - g.t) / 0.45;
        if (k <= 0) continue;
        const pop = k < 1 ? U.backOut(k) : 1;
        const sway = (Math.sin(t * 0.9 + g.y * 0.13) * (g.y * g.y) / 600) * wind;
        const v = g.depth / 4;
        W.bb(x0 + (g.x + sway) * sc, base + g.y * sc + lift * g.s, z, g.em * sc * pop, g.rot,
          U.lerp(0.95, 0.8, v), U.lerp(0.74, 0.86, v), U.lerp(0.5, 0.6, v), Math.min(1, k) * 0.95 * fa, g.c, g.s, 0.4, 0);
      }
      for (const lf of this.leaves) {
        const k = (ga - lf.t) / 0.5;
        if (k <= 0) continue;
        const pop = k < 1 ? U.backOut(k) : 1;
        const sway = (Math.sin(t * 0.9 + lf.y * 0.13) * (lf.y * lf.y) / 600) * wind + Math.sin(t * 1.7 + lf.ph) * 0.28 * wind;
        const c = lf.col;
        W.bb(x0 + (lf.x + lf.fx + sway) * sc, base + (lf.y + lf.fy) * sc + lift * lf.s, z, lf.em * sc * pop,
          Math.sin(t * 1.3 + lf.ph) * 0.35 + (lf.fall >= 0 ? lf.fall * 2 : 0), c[0], c[1], c[2], Math.min(1, k) * 0.9 * fa, lf.c, lf.s, 0.5, 0.12);
      }
    }
  }

  /* -------------------------------------------------------------- flowers */
  class Flowers extends Thing {
    constructor(hit) {
      super(hit);
      const typed = this.word;
      const pool = T.namePool('flower', typed);
      const sp = T.seaSpot(20, 52, 14);
      this.seaPos = [sp[0], sp[1]];
      this.seaRad = 14;
      const n = D.lowPower ? 9 : 13;
      const cols = [[1.0, 0.62, 0.6], [1.0, 0.72, 0.86], [1.0, 0.96, 0.88], [0.84, 0.74, 1.0], [1.0, 0.86, 0.5]];
      this.f = [];
      for (let i = 0; i < n; i++) {
        const g = noSp(A.glyphs(i < 2 ? typed : U.pick(pool)));
        const z = Math.min(-12, sp[1] + U.rr(-9, 7));
        const x = sp[0] + U.rr(-13, 13) * (i === 0 ? 0.2 : 1) * (Wd.portrait ? 0.6 : 1);
        const sc = Math.hypot(x - cam.eye[0], z) / 40;
        const petals = Math.max(5, Math.min(9, g.length < 3 ? 6 + ((Math.random() * 3) | 0) : g.length));
        const h = U.rr(2.6, 6.5) * sc;
        this.f.push({
          x, z, sc, h, g, petals, stemN: Math.max(3, Math.round(h / (0.52 * sc * 1.05))),
          col: cols[i % cols.length], t0: 0.15 + i * 0.2 + Math.random() * 0.15, ph: Math.random() * TAU, spin: U.rr(-0.2, 0.2), s: Math.random(),
        });
      }
      this.hold = T.fly(typed, [sp[0], 2, sp[1]], 16, 1.0, [1.0, 0.8, 0.85], 14);
      if (D.Sound) D.Sound.grow();
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade, t = Wd.t * D.motion, Rv = cam.R, Uv = cam.Up;
      const wind = 0.3 + Wd.wind * 1.4;
      for (const f of this.f) {
        const k1 = U.smooth(f.t0, f.t0 + 0.9, ga);
        if (k1 <= 0) continue;
        const base = Wd.seaH(f.x, f.z);
        const sc = f.sc, m = f.g.length;
        const sway = Math.sin(t * 1.1 + f.ph) * f.h * 0.07 * wind;
        const lift = (1 - fa) * 6 * f.s;
        const emS = 0.52 * sc;
        const shown = f.stemN * k1;
        for (let j = 0; j < f.stemN; j++) {
          if (j > shown) break;
          const u = (j + 0.5) / f.stemN;
          W.bb(f.x + sway * u * u, base + u * f.h + lift, f.z, emS, Math.PI / 2, 0.5, 0.9, 0.58, 0.8 * fa * Math.min(1, shown - j), f.g[j % m].c, f.s, 0.4, 0);
        }
        const k2 = U.clamp((ga - f.t0 - 0.75) / 0.9, 0, 1);
        if (k2 <= 0) continue;
        const open = U.backOut(k2);
        const emP = 1.05 * sc * open, rad = 1.02 * sc * open;
        const tx = f.x + sway, ty = base + f.h + lift, tz = f.z;
        const c = f.col;
        for (let j = 0; j < f.petals; j++) {
          const a = (j / f.petals) * TAU + f.spin + Math.sin(t * 0.6 + f.ph) * 0.08 + Math.PI / 2;
          const ca = Math.cos(a) * rad, sa = Math.sin(a) * rad;
          W.bb(tx + Rv[0] * ca + Uv[0] * sa, ty + Rv[1] * ca + Uv[1] * sa, tz + Rv[2] * ca + Uv[2] * sa,
            emP, a - Math.PI / 2, c[0], c[1], c[2], 0.95 * fa * k2, f.g[j % m].c, f.s, 0.35, 0);
        }
        W.spr(tx, ty, tz, 1.5 * sc * open, 0, 1, 1, 1.0, 0.85, 0.5, 0.5 * fa * k2, FX.glow, 0);
      }
    }
  }

  /* ----------------------------------------------------------------- boat */
  function inTri(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }
  class Boat extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('boat', this.word);
      const sp = T.seaSpot(36, 66, 12);
      this.x = sp[0]; this.z = sp[1]; this.dist = sp[2];
      this.sc = (sp[2] / 40) * (Wd.portrait ? 0.85 : 1);
      this.dir = this.x > cam.eye[0] ? -1 : 1;
      this.seaPos = [this.x, this.z];
      this.seaRad = 11;
      this.build();
      this.hold = T.fly(this.word, [this.x, 3, this.z], 14, 1.0, [1.0, 0.9, 0.7], 13);
      this.wake = 0;
    }
    build() {
      const dir = this.dir;
      const inside = (x0, y) => {
        const x = x0 * dir;                       // mirrored when she sails left; the text still reads left to right
        if (y >= 0 && y <= 1.75) {
          const k = y / 1.75;
          if (x > -(3.0 + 0.9 * k) && x < 3.2 + 2.0 * Math.pow(k, 0.6)) return 1;
        }
        if (inTri(x, y, -0.5, 2.4, -0.5, 9.7, -5.3, 2.75)) return 2;     // mainsail
        if (inTri(x, y, 0.5, 2.9, 0.5, 8.3, 3.7, 3.0)) return 3;         // jib
        return 0;
      };
      this.g = T.fillShape(inside, -5.6, 5.6, 0, 10, 0.46, 0.62, T.stream(this.pool), []);
      const next = T.stream(this.pool);
      for (let y = 2.0; y < 10.2; y += 0.5) {
        let q = next();
        if (q.sp) q = next();
        this.g.push({ x: 0, y, c: q.c, d: 4, s: Math.random() });
      }
    }
    update(dt) {
      if (this.age < this.hold) return;
      const q = dt * D.motion;
      this.x += this.dir * 0.55 * this.sc * q;
      const half = this.dist * cam.tanX * 0.92;
      if ((this.x - cam.eye[0]) * this.dir > half) { this.dir = -this.dir; this.build(); }
      this.seaPos[0] = this.x;
      this.wake -= q;
      if (this.wake <= 0) { this.wake = 1.6; T.ring(this.x - this.dir * 3.4 * this.sc, this.z, 2.4 * this.sc, 1.6, 0.34); }
      Wd.light(this.x, this.z, 8 * this.sc, 0.5 * this.fade, 1.0, 0.8, 0.5);
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade * U.smooth(0, 1.4, ga), sc = this.sc, z = this.z;
      const bob = Wd.seaH(this.x, z) * 0.85 - 0.12 * sc;
      const roll = -Math.atan(Wd.seaSlopeX(this.x, z)) * 0.7 + Math.sin(Wd.t * 0.8 * D.motion) * 0.03;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const lift = (1 - this.fade) * 6;
      for (const g of this.g) {
        const lx = g.x * sc, ly = g.y * sc;
        let r = 1.0, gg = 0.8, b = 0.5, al = 1.0;
        if (g.d === 2 || g.d === 3) { r = 0.9; gg = 0.94; b = 1.0; al = 0.8; }
        else if (g.d === 4) { r = 0.95; gg = 0.8; b = 0.6; }
        W.bb(this.x + lx * cr - ly * sr, bob + lx * sr + ly * cr + lift * g.s, z, 0.46 * sc, roll, r, gg, b, al * fa, g.c, g.s, 0.45, 0);
      }
      const mx = this.x - 10.5 * sc * sr, my = bob + 10.5 * sc * cr + lift;
      W.spr(mx, my, z, 2.6 * sc, 0, 1, 1, 1.0, 0.8, 0.5, 0.5 * fa, FX.glow, 0);
      W.spr(mx, my, z, 0.8 * sc, 0, 1, 1, 1.0, 0.95, 0.8, 0.95 * fa, FX.glow, 0);
    }
  }

  /* ----------------------------------------------------------------- fire */
  class Fire extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('fire', this.word);
      const sp = T.seaSpot(26, 50, 10);
      this.x = sp[0]; this.z = sp[1];
      this.sc = sp[2] / 38;
      this.seaPos = [this.x, this.z];
      this.seaRad = 10;
      this.n = D.lowPower ? 130 : 220;
      this.p = [];
      for (let i = 0; i < this.n; i++) this.p.push(this.spark(true));
      this.isl = makeIslet(5.5 * this.sc, 3.4 * this.sc, 0.8 * this.sc, L.names.earth);
      this.hold = T.fly(this.word, [this.x, 1, this.z], 16, 1.0, [1.0, 0.7, 0.35], 14);
    }
    spark(first) {
      const g = noSp(A.glyphs(U.pick(this.pool)));
      const high = Math.random() < 0.05;
      const max = U.rr(1.0, 2.1) * (high ? 1.8 : 1);
      return {
        x: U.rr(-1, 1) * 1.15, y: 0, vy: U.rr(3.6, 7.4) * (high ? 1.7 : 1), life: first ? Math.random() * max : 0, max,
        c: g[(Math.random() * g.length) | 0].c, ph: Math.random() * TAU, s: Math.random(), high,
      };
    }
    update(dt) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const q = dt * (D.reduced ? 0.55 : 1), t = Wd.t;
      for (let i = 0; i < this.n; i++) {
        const p = this.p[i];
        p.life += q;
        if (p.life >= p.max) { this.p[i] = this.spark(false); continue; }
        p.y += p.vy * q;
        p.vy *= 1 - 0.35 * q;
        p.x += (Math.sin(t * 3.1 + p.ph + p.y * 0.7) * 0.9 + Wd.wind * 3.2 - p.x * 0.5) * q;
      }
      const flick = 0.82 + 0.12 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 23.3);
      Wd.light(this.x, this.z, 10 * this.sc, 0.7 * flick * this.fade * U.smooth(0, 1.5, ga), 1.0, 0.6, 0.26);
      if (D.Sound) D.Sound.weather('fire', this.dying ? 0 : U.smooth(0, 1.5, ga));
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade * U.smooth(0, 1.6, ga), sc = this.sc, x0 = this.x, z = this.z;
      const base = 0.3;
      emitIslet(W, this.isl, x0, z, 0.55 * fa, 0.8, 0.6, 0.42);
      for (let i = 0; i < this.n; i++) {
        const p = this.p[i];
        const k = p.life / p.max;
        let r, g, b;
        if (k < 0.25) { const u = k / 0.25; r = 1; g = U.lerp(0.97, 0.78, u); b = U.lerp(0.74, 0.3, u); }
        else if (k < 0.6) { const u = (k - 0.25) / 0.35; r = 1; g = U.lerp(0.78, 0.42, u); b = U.lerp(0.3, 0.12, u); }
        else { const u = (k - 0.6) / 0.4; r = U.lerp(1, 0.55, u); g = U.lerp(0.42, 0.12, u); b = U.lerp(0.12, 0.08, u); }
        const em = U.lerp(1.5, 0.45, k) * sc * (p.high ? 0.6 : 1);
        const al = Math.min(1, k * 9) * Math.pow(1 - k, 0.8) * 0.66 * fa;
        W.bb(x0 + p.x * sc, base + p.y * sc, z, em, Math.sin(p.ph + p.life * 3) * 0.4, r, g, b, al, p.c, p.s, 0.2, 0);
      }
      const fl = D.reduced ? 1 : 1 + 0.08 * Math.sin(Wd.t * 11);
      W.spr(x0, base + 2.2 * sc, z, 10 * sc * fl, 0, 1, 1, 1.0, 0.5, 0.18, 0.13 * fa, FX.glow, 0);
      W.spr(x0, base + 1.2 * sc, z, 3.6 * sc * fl, 0, 1, 1, 1.0, 0.8, 0.45, 0.2 * fa, FX.glow, 0);
    }
    onDead() { if (D.Sound) D.Sound.weather('fire', 0); }
  }

  /* --------------------------------------------------------------- aurora */
  class Aurora extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('aurora', this.word);
      const curtains = D.lowPower ? 2 : 3;
      const cols = (this.cols = D.lowPower ? 36 : 72);
      const rows = (this.rows = D.lowPower ? 6 : 7);
      this.c = [];
      const span = Math.min(1.3, Math.atan(cam.tanX) * 1.75);
      for (let j = 0; j < curtains; j++) {
        // each band of the curtain is a line of names, read along the ribbon
        const lines = [];
        for (let r = 0; r < rows; r++) {
          const next = T.stream(this.pool);
          const row = [];
          for (let i = 0; i < cols; i++) { const q = next(); row.push(q.sp ? -1 : q.c); }
          lines.push(row);
        }
        this.c.push({
          az0: -span / 2 + U.rr(-0.08, 0.08) + j * 0.05, span: span * U.rr(0.82, 1),
          el: (0.2 + j * 0.075) * (Wd.portrait ? 1.7 : 1), ph: Math.random() * TAU, lines,
        });
      }
      this.I = new Float32Array(cols); this.az = new Float32Array(cols); this.elv = new Float32Array(cols);
      this.rot = new Float32Array(cols); this.rev = new Float32Array(cols);
      this.glow = 0;
    }
    extend() { this.dying = false; this.fade = 1; }
    update() { this.glow = U.smooth(0, 4, this.age) * this.fade; }
    emit(W) {
      const e = cam.eye, t = Wd.t * D.motion, pxu = Wd.pxAt(SKY_R);
      const emPx = Wd.small ? 11 : 13.5;
      const em = pxu * emPx;
      const rowGap = (emPx * 1.32) / cam.focal;
      const k0 = U.smooth(0, 5, this.age) * this.fade;
      const rows = this.rows, cols = this.cols;
      const I = this.I, AZ = this.az, EL = this.elv, ROT = this.rot, REV = this.rev;
      for (const c of this.c) {
        for (let i = 0; i < cols; i++) {
          const u = i / (cols - 1);
          REV[i] = U.smooth(u * 0.7, u * 0.7 + 0.3, this.age / 4);
          let v = 0.5 + 0.5 * Math.sin(u * 13 + t * 0.55 + c.ph) * Math.sin(u * 4.1 - t * 0.23 + c.ph * 2);
          I[i] = v * v * (0.35 + 0.65 * Math.sin(Math.PI * u));
          const wv = u * 4.4 + c.ph + t * 0.07, w2 = u * 11 + t * 0.13;
          AZ[i] = c.az0 + u * c.span + Math.sin(t * 0.21 + u * 5 + c.ph) * 0.03;
          EL[i] = c.el + 0.07 * Math.sin(wv) + 0.03 * Math.sin(w2);
          ROT[i] = Math.atan((0.07 * 4.4 * Math.cos(wv) + 0.03 * 11 * Math.cos(w2)) / c.span);
        }
        for (let r = 0; r < rows; r++) {
          const v = r / (rows - 1);
          let cr, cg, cb;                      // green at the foot, then teal, then violet
          if (v < 0.5) { const w = v / 0.5; cr = U.lerp(0.42, 0.3, w); cg = U.lerp(1.0, 0.92, w); cb = U.lerp(0.58, 0.86, w); }
          else { const w = (v - 0.5) / 0.5; cr = U.lerp(0.3, 0.72, w); cg = U.lerp(0.92, 0.44, w); cb = U.lerp(0.86, 1.0, w); }
          const fadeV = Math.pow(1 - v * 0.85, 1.1);
          const row = c.lines[r];
          for (let i = 0; i < cols; i++) {
            const ch = row[i];
            if (ch < 0 || REV[i] <= 0) continue;
            if (v > 0.3 + 0.9 * I[i]) continue;                // the curtain stands taller where it is brighter
            const al = Math.min(1, k0 * (0.26 + 1.15 * I[i]) * REV[i] * fadeV);
            if (al < 0.012) continue;
            const d = U.dirAzEl(AZ[i] + v * 0.016 * Math.sin(t * 0.3 + i * 0.4), EL[i] + r * rowGap * (1 + 0.25 * I[i]));
            W.bb(e[0] + d[0] * SKY_R, e[1] + d[1] * SKY_R, e[2] + d[2] * SKY_R, em, ROT[i], cr, cg, cb, al, ch, (i * 7 + r) * 0.013, 0.45, 0.15);
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------- butterflies */
  class Butterflies extends Thing {
    constructor(hit) {
      super(hit);
      const pool = T.namePool('butterfly', this.word);
      const n = D.lowPower ? 5 : 8;
      const cols = [[1.0, 0.84, 0.5], [1.0, 0.68, 0.74], [0.84, 0.76, 1.0], [0.7, 0.9, 1.0], [1.0, 0.95, 0.85]];
      const hand = T.handPoint();
      this.b = [];
      for (let i = 0; i < n; i++) {
        const g = noSp(A.glyphs(i < 3 ? this.word : U.pick(pool)));
        const lw = g[0], rw = g.length > 1 ? g[g.length - 1] : g[0];
        this.b.push({
          p: [hand[0] + U.rr(-2, 2), hand[1] + U.rr(0, 1.5), hand[2] + U.rr(-2, 0)], v: [0, 0, 0],
          l: lw.c, r: rw.c, col: cols[i % cols.length], ph: Math.random() * TAU,
          off: [U.rr(-5.5, 5.5), U.rr(-2.5, 3.5), U.rr(-3, 3)], fl: U.rr(8, 11), s: Math.random(),
        });
      }
    }
    extend() { this.dying = false; this.fade = 1; }
    update(dt) {
      const q = dt * D.motion, t = Wd.t;
      const r = Wd.ray(Wd.ptr.x, Wd.ptr.y);
      const Dd = 27;
      const tx = cam.eye[0] + r[0] * Dd, ty = Math.max(1.6, cam.eye[1] + r[1] * Dd), tz = cam.eye[2] + r[2] * Dd;
      for (const b of this.b) {
        const p = b.p, v = b.v;
        const wx = Math.sin(t * 0.7 + b.ph) * 2.2, wy = Math.sin(t * 1.1 + b.ph * 1.7) * 1.4, wz = Math.cos(t * 0.5 + b.ph) * 1.6;
        const ax = (tx + b.off[0] + wx - p[0]) * 2.2 - v[0] * 1.9;
        const ay = (ty + b.off[1] + wy - p[1]) * 2.2 - v[1] * 1.9 + Math.sin(t * b.fl + b.ph) * 5;
        const az = (tz + b.off[2] + wz - p[2]) * 2.2 - v[2] * 1.9;
        v[0] += ax * q; v[1] += ay * q; v[2] += az * q;
        p[0] += v[0] * q; p[1] += v[1] * q; p[2] += v[2] * q;
      }
    }
    emit(W) {
      const fa = this.fade * Math.min(1, this.age * 1.5), t = Wd.t, e = cam.eye, Rv = cam.R, Uv = cam.Up;
      const lift = (1 - this.fade) * 5;
      for (const b of this.b) {
        const p = b.p;
        const dd = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
        const em = Wd.pxAt(dd) * (Wd.small ? 22 : 30);
        const open = 0.18 + 0.82 * (D.reduced ? 0.8 : Math.abs(Math.cos(t * b.fl * 0.5 + b.ph)));
        const tilt = U.clamp(b.v[0] * 0.05, -0.5, 0.5);
        const hw = em * 0.36 * open;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const ox = (Rv[0] * ct + Uv[0] * st) * hw, oy = (Rv[1] * ct + Uv[1] * st) * hw, oz = (Rv[2] * ct + Uv[2] * st) * hw;
        const c = b.col;
        // two wings: the first syllable and the last, hinged where they meet
        W.bb(p[0] - ox, p[1] - oy + lift, p[2] - oz, em, tilt, c[0], c[1], c[2], 0.95 * fa, b.l, b.s, 0.3, 0, open, 1);
        W.bb(p[0] + ox, p[1] + oy + lift, p[2] + oz, em, tilt, c[0], c[1], c[2], 0.95 * fa, b.r, b.s, 0.3, 0, open, 1);
      }
    }
  }

  /* ----------------------------------------------------------------- fish */
  class Fish extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('fish', this.word);
      this.j = [];
      this.clock = 0.7;
      this.first = true;
    }
    extend() { this.dying = false; this.fade = 1; }
    update(dt) {
      const q = dt * D.motion;
      this.clock -= dt;
      if (this.clock <= 0 && !this.dying) {
        this.clock = U.rr(0.5, 1.4) * (D.lowPower ? 1.4 : 1) * (D.reduced ? 2 : 1);
        const d = U.rr(18, 95);
        const half = d * cam.tanX * 0.85;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const sc = d / 40;
        const g = noSp(A.glyphs(this.first ? this.word : U.pick(this.pool)));
        this.first = false;
        const x = cam.eye[0] + U.rr(-half, half);
        this.j.push({ x, z: -d, dir, sc, g, t: 0, dur: U.rr(1.0, 1.4), len: U.rr(7, 11) * sc, h: U.rr(2.6, 4.6) * sc, s: Math.random(), back: false });
        T.ring(x, -d, 1.8 * sc, 0.8, 0.5);
      }
      for (let i = this.j.length - 1; i >= 0; i--) {
        const f = this.j[i];
        f.t += q;
        if (!f.back && f.t > f.dur) { f.back = true; T.ring(f.x + f.dir * f.len, f.z, 2.2 * f.sc, 0.9, 0.55); }
        if (f.t > f.dur + f.g.length * 0.05 + 0.3) this.j.splice(i, 1);
      }
    }
    emit(W) {
      const fa = this.fade;
      for (const f of this.j) {
        const m = f.g.length, em = 0.95 * f.sc;
        for (let j = 0; j < m; j++) {
          // the leader is the last letter when it leaps to the right, so the word still reads in the air
          const idx = f.dir > 0 ? m - 1 - j : j;
          const k = (f.t - j * 0.045) / f.dur;
          if (k <= 0 || k >= 1) continue;
          const x = f.x + f.dir * f.len * k;
          const y = f.h * 4 * k * (1 - k);
          const rot = Math.atan((f.h * 4 * (1 - 2 * k)) / f.len) * f.dir;
          W.bb(x, y + 0.1, f.z, em, rot, 0.82, 0.93, 1.0, 0.95 * fa * Math.min(1, Math.sin(Math.PI * k) * 3), f.g[idx].c, f.s, 0.45, 0.2);
        }
      }
    }
  }

  /* --------------------------------------------------------------- clouds */
  class Clouds extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('cloud', this.word);
      const n = D.lowPower ? 2 : 3;
      const emRad = (Wd.small ? 10 : 12.5) / cam.focal;
      const halfAz = Math.atan(cam.tanX);
      this.halfAz = halfAz;
      this.c = [];
      for (let i = 0; i < n; i++) {
        const w = U.rr(0.2, 0.3) * (Wd.portrait ? 0.72 : 1), h = w * U.rr(0.3, 0.38);
        const blobs = [];
        const nb = 5 + ((Math.random() * 3) | 0);
        for (let b = 0; b < nb; b++) {
          const u = b / (nb - 1);
          blobs.push([(u - 0.5) * w * 0.85, (Math.random() - 0.35) * h * 0.5 * Math.sin(Math.PI * (0.15 + 0.7 * u)),
            w * U.rr(0.16, 0.26), h * U.rr(0.5, 0.8) * (0.55 + 0.6 * Math.sin(Math.PI * u))]);
        }
        const inside = (x, y) => {
          let d = 0;
          for (const bl of blobs) {
            const ux = (x - bl[0]) / bl[2], uy = (y - bl[1]) / bl[3];
            const v = 1 - ux * ux - uy * uy;
            if (v > d) d = v;
          }
          if (y < -h * 0.32) d *= Math.max(0, 1 + (y + h * 0.32) / (h * 0.12));    // a flat underside
          return d;
        };
        const g = T.fillShape(inside, -w * 0.62, w * 0.62, -h * 0.7, h * 0.9, emRad, emRad * 1.3, T.stream(this.pool), []);
        this.c.push({
          az: -halfAz * 0.9 + (i + 0.5) * ((halfAz * 1.8) / n) + U.rr(-0.08, 0.08),
          el: (0.19 + i * 0.065 + U.rr(-0.015, 0.02)) * (Wd.portrait ? 1.6 : 1), g, w, h, v: U.rr(0.004, 0.009), em: emRad,
        });
      }
    }
    extend() { this.dying = false; this.fade = 1; }
    update(dt) {
      const q = dt * D.motion;
      for (const c of this.c) {
        c.az += c.v * (1 + Wd.wind * 5) * q;
        if (c.az > this.halfAz + c.w) c.az = -this.halfAz - c.w;
      }
    }
    emit(W) {
      const e = cam.eye, fa = this.fade * U.smooth(0, 3, this.age);
      const R2 = SKY_R * 0.96;
      for (const c of this.c) {
        const d0 = U.dirAzEl(c.az, c.el);
        const e1 = V.norm(V.cross(d0, [0, 1, 0])), e2 = V.cross(e1, d0);
        const moon = Math.pow(Math.max(0, V.dot(d0, Wd.moonDir)), 6);
        const em = c.em * R2;
        for (const g of c.g) {
          const dx = d0[0] + e1[0] * g.x + e2[0] * g.y, dy = d0[1] + e1[1] * g.x + e2[1] * g.y, dz = d0[2] + e1[2] * g.x + e2[2] * g.y;
          const il = 1 / Math.hypot(dx, dy, dz);
          const lit = 0.6 + 0.4 * U.clamp(g.y / (c.h * 0.6) * 0.5 + 0.5, 0, 1) + moon * 0.9;
          W.bb(e[0] + dx * il * R2, e[1] + dy * il * R2, e[2] + dz * il * R2, em, 0, 0.72 * lit, 0.8 * lit, 0.96 * lit,
            0.62 * Math.min(1, g.d * 2.4) * fa, g.c, g.s, 0.5, 0);
        }
      }
    }
  }

  /* ----------------------------------------------------------------- home */
  class Home extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('home', this.word);
      const sp = T.seaSpot(38, 62, 12);
      this.x = sp[0]; this.z = sp[1];
      this.sc = (sp[2] / 46) * (Wd.portrait ? 0.95 : 1);
      this.seaPos = [this.x, this.z];
      this.seaRad = 12;
      const inside = (x, y) => {
        if (y >= 0 && y < 5 && Math.abs(x) < 4) {
          if (Math.abs(x + 1.9) < 0.95 && y < 2.9) return 0;                 // the door stands open
          if (Math.abs(x - 1.8) < 0.95 && y > 1.9 && y < 3.7) return 0;      // the window is light, not letters
          return 1;
        }
        if (x > 2.1 && x < 3.3 && y >= 5 && y < 8.3) return 3;               // chimney
        if (y >= 5 && y < 8.7 && Math.abs(x) < 5.1 * (1 - (y - 5) / 3.9)) return 2;   // roof
        return 0;
      };
      this.g = T.fillShape(inside, -5.2, 5.2, 0, 8.8, 0.5, 0.68, T.stream(this.pool), []);
      this.isl = makeIslet(9 * this.sc, 5 * this.sc, 0.9 * this.sc, L.names.earth);
      this.smoke = [];
      this.smokeClock = 0;
      this.hold = T.fly(this.word, [this.x, 3, this.z], 16, 1.0, [1.0, 0.86, 0.68], 13);
    }
    update(dt) {
      const ga = this.age - this.hold;
      if (ga < 1) return;
      const q = dt * D.motion;
      this.smokeClock -= q;
      if (this.smokeClock <= 0 && !this.dying && this.smoke.length < 40) {
        this.smokeClock = 0.24;
        const g = noSp(A.glyphs(U.pick(L.names.smoke)));
        this.smoke.push({ x: 2.7 + U.rr(-0.3, 0.3), y: 8.4, vy: U.rr(1.3, 2.1), life: 0, max: U.rr(3.5, 5.2), c: g[(Math.random() * g.length) | 0].c, ph: Math.random() * TAU, s: Math.random() });
      }
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const p = this.smoke[i];
        p.life += q;
        if (p.life > p.max) { this.smoke.splice(i, 1); continue; }
        p.y += p.vy * q;
        p.x += (Math.sin(p.life * 1.3 + p.ph) * 0.5 + 0.35 + Wd.wind * 3) * q;
      }
      Wd.light(this.x + 1.8 * this.sc, this.z, 9 * this.sc, 0.5 * this.fade, 1.0, 0.78, 0.45);
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade * U.smooth(0, 1.6, ga), sc = this.sc, x0 = this.x, z = this.z;
      const lift = (1 - this.fade) * 6;
      emitIslet(W, this.isl, x0, z, 0.55 * fa, 0.78, 0.64, 0.46);
      for (const g of this.g) {
        let r = 0.96, gg = 0.87, b = 0.74;
        if (g.d === 2) { r = 1.0; gg = 0.58; b = 0.44; }
        else if (g.d === 3) { r = 0.9; gg = 0.62; b = 0.52; }
        W.bb(x0 + g.x * sc, 0.2 + g.y * sc + lift * g.s, z, 0.5 * sc, 0, r, gg, b, 0.92 * fa, g.c, g.s, 0.45, 0);
      }
      const warm = D.reduced ? 1 : 0.92 + 0.08 * Math.sin(Wd.t * 2.3);
      W.spr(x0 + 1.8 * sc, 0.2 + 2.8 * sc + lift, z, 1.5 * sc, 0, 1, 1, 1.0, 0.86, 0.56, 0.95 * fa * warm, FX.glow, 0);
      W.spr(x0 + 1.8 * sc, 0.2 + 2.8 * sc + lift, z, 5 * sc, 0, 1, 1, 1.0, 0.72, 0.4, 0.22 * fa * warm, FX.glow, 0);
      W.spr(x0 - 1.9 * sc, 0.2 + 1.35 * sc + lift, z, 2.2 * sc, 0, 0.62, 1.2, 1.0, 0.72, 0.42, 0.34 * fa * warm, FX.glow, 0);
      for (const p of this.smoke) {
        const k = p.life / p.max;
        W.bb(x0 + p.x * sc, 0.2 + p.y * sc + lift, z, U.lerp(0.5, 1.1, k) * sc, Math.sin(p.ph + p.life) * 0.5, 0.8, 0.84, 0.95, Math.min(1, k * 6) * (1 - k) * 0.6 * fa, p.c, p.s, 0.4, 0);
      }
    }
  }

  /* ----------------------------------------------------------- lighthouse */
  class Lighthouse extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('lighthouse', this.word);
      const sp = T.seaSpot(96, 135, 20);
      const half = sp[2] * cam.tanX;
      let x = sp[0];
      if (Math.abs(x - cam.eye[0]) < half * 0.36) x = cam.eye[0] + (Math.random() < 0.5 ? -1 : 1) * half * U.rr(0.45, 0.7);
      this.x = x; this.z = sp[1];
      const sc = (this.sc = sp[2] / 110);
      this.seaPos = [this.x, this.z];
      this.seaRad = 20;
      const inside = (px, y) => {
        const ax = Math.abs(px);
        if (y >= 0 && y < 26) return ax < 2.5 - 1.0 * (y / 26) ? 1 + (Math.floor(y / 5.2) % 2) : 0;
        if (y >= 26 && y < 27.2) return ax < 2.6 ? 3 : 0;
        if (y >= 27.2 && y < 30.2) return ax < 1.35 && !(ax < 0.8 && y > 27.8 && y < 29.6) ? 3 : 0;   // the lamp itself is light
        if (y >= 30.2 && y < 32.4) return ax < 1.7 * (1 - (y - 30.2) / 2.2) ? 3 : 0;
        return 0;
      };
      this.g = T.fillShape(inside, -2.8, 2.8, 0, 32.5, 0.92, 1.2, T.stream(this.pool), []);
      this.isl = makeIslet(13 * sc, 6 * sc, 1.3 * sc, L.names.earth);
      this.th = Math.random() * TAU;
      this.hold = T.fly(this.word, [this.x, 10, this.z], 16, 1.2, [1.0, 0.95, 0.85], 12);
    }
    update(dt) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      this.th += dt * D.motion * 0.75;
      const reach = 44 * this.sc;
      Wd.light(this.x + Math.cos(this.th) * reach, this.z + Math.sin(this.th) * reach, 17 * this.sc, 0.75 * this.fade * U.smooth(1, 3, ga), 1.0, 0.94, 0.78);
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const fa = this.fade * U.smooth(0, 1.8, ga), sc = this.sc, x0 = this.x, z = this.z;
      const lift = (1 - this.fade) * 8;
      emitIslet(W, this.isl, x0, z, 0.5 * fa, 0.62, 0.62, 0.66);
      for (const g of this.g) {
        let r = 0.96, gg = 0.95, b = 0.92;
        if (g.d === 2) { r = 1.0; gg = 0.5; b = 0.46; }
        else if (g.d === 3) { r = 0.82; gg = 0.87; b = 0.96; }
        W.bb(x0 + g.x * sc, 0.2 + g.y * sc + lift * g.s, z, 0.92 * sc, 0, r, gg, b, 0.92 * fa, g.c, g.s, 0.5, 0);
      }
      const lamp = U.smooth(1, 3, ga) * fa;
      if (lamp <= 0.004) return;
      const ly = 0.2 + 28.7 * sc + lift;
      const len = 150 * sc;
      for (let k = 0; k < 2; k++) {
        const th = this.th + k * Math.PI;
        const dx = Math.cos(th), dz = Math.sin(th);
        const toCam = V.norm([cam.eye[0] - x0, cam.eye[1] - ly, cam.eye[2] - z]);
        const f = dx * toCam[0] + dz * toCam[2];
        const side = 1 - Math.abs(f);
        W.quad(x0 + dx * len * 0.5, ly, z + dz * len * 0.5, dx * len * 0.5, 0, dz * len * 0.5, 0, len * 0.1, 0,
          1.0, 0.95, 0.8, (0.1 + 0.3 * side) * lamp, FX.beam, 0, 0, 0);
        if (f > 0) {
          const flash = Math.pow(f, 12);
          W.spr(x0, ly, z, (3 + 36 * flash) * sc, 0, 1, 1, 1.0, 0.96, 0.84, (0.5 + 0.5 * flash) * lamp, FX.glow, 0);
        }
      }
      W.spr(x0, ly, z, 1.4 * sc, 0, 1, 1, 1.0, 0.98, 0.9, lamp, FX.glow, 0);
    }
  }

  /* ----------------------------------------------------------------- road */
  class Road extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('road', this.word);
      const az = Math.atan2(Wd.moonDir[0], -Wd.moonDir[2]);
      this.sn = Math.sin(az); this.cs = Math.cos(az);
      const k = (Wd.small ? 15 : 22) / cam.focal;        // a little larger than the sea's own letters
      const st = (this.st = Wd.seaStretch || 1.6);
      this.w = [];
      let d = 13, i = 0;
      while (d < 430 && i < 90) {
        this.w.push({ d, em: k * d, g: A.glyphs(i % 2 === 0 ? this.word : U.pick(this.pool)), t0: i * 0.085 });
        d *= 1 + st * k * 1.5;
        i++;
      }
    }
    extend() { this.dying = false; this.fade = 1; }
    emit(W) {
      const fa = this.fade, sn = this.sn, cs = this.cs, st = this.st;
      // first the way itself: the sea's own letters are hushed under it
      for (const w of this.w) {
        const k = U.smooth(w.t0, w.t0 + 0.8, this.age);
        if (k <= 0) continue;
        const cx = sn * w.d, cz = -cs * w.d;
        const hw = w.em * 3.4, hd = w.em * st * 1.25;
        const far = 1 - U.smooth(110, 300, w.d);
        W.quad(cx, Wd.seaH(cx, cz) + 0.06, cz, cs * hw, 0, sn * hw, sn * hd, 0, -cs * hd, 0.012, 0.02, 0.05, 0.8 * k * fa * far, FX.solid, 0, 0, 1);
      }
      for (const w of this.w) {
        const k = U.smooth(w.t0, w.t0 + 0.8, this.age);
        if (k <= 0) continue;
        const cx = sn * w.d, cz = -cs * w.d;
        const far = 1 - U.smooth(110, 300, w.d);
        if (far <= 0.01) continue;
        const h = w.em * A.HALF;
        let xo = -w.g.w * 0.5;
        for (const q of w.g) {
          if (!q.sp) {
            const off = (xo + q.a * 0.5) * w.em;
            const x = cx + cs * off, z = cz + sn * off;
            // each word lies across the way, its head toward the moon
            W.quad(x, Wd.seaH(x, z) + 0.12, z, cs * h, 0, sn * h, sn * h * st, 0, -cs * h * st,
              1.0, 0.84, 0.54, 0.96 * k * fa * far, q.c, 0.5, 0.5, 0);
          }
          xo += q.a;
        }
      }
    }
  }

  /* --------------------------------------------------------------- island */
  class Island extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('island', this.word);
      const sp = T.seaSpot(110, 170, 30);
      this.x = sp[0]; this.z = sp[1];
      this.sc = (sp[2] / 100) * (Wd.portrait ? 0.72 : 1);
      this.seaPos = [this.x, this.z];
      this.seaRad = 34;
      const sd = Math.random() * 100;
      const inside = (x, y) => {
        const u = x / 30;
        if (Math.abs(u) >= 1) return 0;
        const h = 11 * Math.pow(1 - u * u, 0.8) * (0.55 + 0.45 * U.fbm1(x * 0.11 + sd));
        return y < h ? 1 + y / h : 0;
      };
      this.g = T.fillShape(inside, -30, 30, 0, 11.5, 1.5, 1.95, T.stream(this.pool), []);
      this.isl = makeIslet(34 * this.sc, 6.5 * this.sc, 1.7 * this.sc, L.names.earth);
      this.hold = T.fly(this.word, [this.x, 2, this.z], 18, 1.3, [0.8, 0.95, 0.8], 12);
    }
    emit(W) {
      const ga = this.age - this.hold;
      if (ga < 0) return;
      const rise = U.easeOut(Math.min(1, ga / 4.5));
      const fa = this.fade, sc = this.sc;
      const lift = (1 - fa) * 8;
      emitIslet(W, this.isl, this.x, this.z, 0.5 * fa * rise, 0.7, 0.72, 0.6);
      for (const g of this.g) {
        const top = g.d > 1.78;
        const l = top ? 1.25 : 0.75 + 0.3 * (g.d - 1);
        W.bb(this.x + g.x * sc, 0.2 + g.y * sc * rise + lift * g.s, this.z, 1.5 * sc, 0, 0.66 * l, 0.92 * l, 0.74 * l, 0.95 * fa * rise, g.c, g.s, 0.5, 0);
      }
    }
  }

  /* -------------------------------------------------------- the moon's halo */
  class MoonHalo extends Thing {
    constructor(hit) {
      super(hit);
      T.targets.moonBoost = 1.55;
      T.targets.moonSize = 1.1;
      const pool = T.namePool('moon', this.word);
      const emF = (this.emF = 0.2);
      const RF = (this.RF = 1.78);
      const circ = TAU * RF;
      this.items = [];
      let acc = 0;
      for (let guard = 0; guard < 120; guard++) {
        const g = A.glyphs(U.pick(pool));
        const ww = g.w * emF + emF * 0.8;
        if (acc + ww > circ) break;
        let x = acc;
        for (const q of g) {
          if (!q.sp) this.items.push({ pos: x + q.a * emF * 0.5, c: q.c, s: Math.random() });
          x += q.a * emF;
        }
        acc += ww;
      }
      const sc = acc > 0 ? circ / acc : 1;
      this.items.forEach((it) => { it.ang = -(it.pos * sc) / RF; });
    }
    extend() { this.dying = false; this.fade = 1; T.targets.moonBoost = 1.55; T.targets.moonSize = 1.1; }
    emit(W) {
      const md = Wd.moonDir, e = cam.eye, Rv = cam.R, Uv = cam.Up;
      const cx = e[0] + md[0] * SKY_R, cy = e[1] + md[1] * SKY_R, cz = e[2] + md[2] * SKY_R;
      const Rm = SKY_R * Math.tan(Wd.moonAng) * Wd.moonSize;
      const rr = Rm * this.RF, em = this.emF * Rm;
      const k = U.smooth(0, 3, this.age) * this.fade;
      const base = Wd.t * D.motion * 0.02;
      for (const it of this.items) {
        const a = it.ang + base;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        W.bb(cx + Rv[0] * x + Uv[0] * y, cy + Rv[1] * x + Uv[1] * y, cz + Rv[2] * x + Uv[2] * y, em, a - Math.PI / 2, 0.86, 0.9, 1.0, 0.72 * k, it.c, it.s, 0.9, 0.2);
      }
      W.spr(cx, cy, cz, rr * 1.4, 0, 1, 1, 0.6, 0.7, 1.0, 0.09 * k, FX.glow, 0);
    }
    onDead() { T.targets.moonBoost = 1; T.targets.moonSize = 1; }
  }

  /* ------------------------------------- a name that keeps the light company */
  class NameRing extends Thing {
    constructor(hit) {
      super(hit);
      const g = noSp(A.glyphs(this.word));
      const reps = Math.max(2, Math.min(6, Math.round(16 / (g.length + 1))));
      const dot = A.cell('·');
      this.items = [];
      for (let r = 0; r < reps; r++) {
        g.forEach((q) => this.items.push(q.c));
        this.items.push(dot);
      }
      Wd.firePulse(Wd.ptr.x, Wd.ptr.y, 0.7);
    }
    emit(W) {
      const p = Wd.ptr, Dd = 22, pxu = Wd.pxAt(Dd);
      const P = Wd.unproject(p.x, p.y, Dd);
      const Rv = cam.R, Uv = cam.Up;
      let order = 0;
      for (const o of T.list) { if (o === this) break; if (o instanceof NameRing && !o.dying) order++; }
      const n = this.items.length;
      const rad = ((Wd.small ? 56 : 72) + order * 24) * pxu * (0.9 + 0.1 * Wd.lightSize);
      const em = (Wd.small ? 13 : 15.5) * pxu;
      const k = U.smooth(0, 2, this.age) * this.fade * Wd.lightOn;
      const base = -Wd.t * D.motion * 0.22 * (order % 2 ? -0.8 : 1);
      for (let i = 0; i < n; i++) {
        const a = base - (i / n) * TAU + Math.PI / 2;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        W.bb(P[0] + Rv[0] * x + Uv[0] * y, P[1] + Rv[1] * x + Uv[1] * y, P[2] + Rv[2] * x + Uv[2] * y, em, a - Math.PI / 2, 1.0, 0.9, 0.72, 0.9 * k, this.items[i], i * 0.07, 0, 0.15);
      }
    }
  }

  /* ----------------------------------------------------------------- song */
  class Song extends Thing {
    constructor(hit) {
      super(hit);
      this.pool = T.namePool('song', this.word);
      const emPx = (this.emPx = Wd.small ? 10 : 12.5);
      const halfAz = (this.halfAz = Math.atan(cam.tanX) * 1.1);
      const step = (this.step = (emPx * 1.05) / cam.focal);
      this.lines = [];
      for (let l = 0; l < 5; l++) {
        const items = [];
        const next = T.stream(this.pool);
        for (let a = -halfAz; a < halfAz; a += step) {
          const q = next();
          items.push(q.sp ? -1 : q.c);
        }
        this.lines.push(items);
      }
      this.el = Wd.portrait ? 0.52 : 0.41;
      if (D.Sound) D.Sound.melody();
    }
    extend() { this.dying = false; this.fade = 1; if (D.Sound) D.Sound.melody(); }
    emit(W) {
      const e = cam.eye, t = Wd.t * D.motion, pxu = Wd.pxAt(SKY_R), em = pxu * this.emPx;
      const k = U.smooth(0, 3, this.age) * this.fade;
      const gap = (this.emPx * 1.9) / cam.focal;
      for (let l = 0; l < this.lines.length; l++) {
        const items = this.lines[l], n = items.length;
        const shift = (t * 0.012 * (l % 2 ? 1 : 0.8)) / this.step;
        const si = Math.floor(shift), sf = shift - si;
        for (let i = 0; i < n; i++) {
          const c = items[(i + si) % n];
          if (c < 0) continue;
          const az = -this.halfAz + (i - sf) * this.step;
          const u = U.clamp((az + this.halfAz) / (2 * this.halfAz), 0, 1);
          const wv = az * 3.2 + t * 0.3;
          const el = this.el + (l - 2) * gap + 0.05 * Math.sin(wv) + 0.018 * Math.sin(az * 9 - t * 0.5);
          const d = U.dirAzEl(az, el);
          const note = (i + si) % 7 === l ? 1 : 0;
          const pulse = note ? 0.6 + 0.9 * Math.exp(-(((t * 1.6 + (i + si) * 0.37) % 1 + 1) % 1) * 4) : 0;
          W.bb(e[0] + d[0] * SKY_R, e[1] + d[1] * SKY_R, e[2] + d[2] * SKY_R, em * (1 + pulse * 0.35), Math.atan(0.16 * Math.cos(wv)),
            1.0, 0.9 - note * 0.1, 0.8 - note * 0.25, (0.42 + pulse * 0.5) * k * Math.sin(Math.PI * u), c, i * 0.01 + l, 0.5, 0);
        }
      }
    }
  }

  /* ------------------------------------------------------------ the roster */
  M.whale = (hit) => new Whale(hit);
  M.tree = (hit) => new Tree(hit);
  M.flower = (hit) => new Flowers(hit);
  M.boat = (hit) => new Boat(hit);
  M.fire = (hit) => new Fire(hit);
  M.aurora = (hit) => new Aurora(hit);
  M.butterfly = (hit) => new Butterflies(hit);
  M.fish = (hit) => new Fish(hit);
  M.cloud = (hit) => new Clouds(hit);
  M.home = (hit) => new Home(hit);
  M.lighthouse = (hit) => new Lighthouse(hit);
  M.road = (hit) => new Road(hit);
  M.island = (hit) => new Island(hit);
  M.moon = (hit) => new MoonHalo(hit);
  M.me = (hit) => new NameRing(hit);
  M.claude = (hit) => new NameRing(hit);
  M.song = (hit) => new Song(hit);
})();
