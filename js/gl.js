/* 글의 바다 — a sea of words
   gl.js : the renderer. One fullscreen pass paints the sky and the dark water;
   one instanced pass draws every glyph. Nothing else is ever drawn. */
(function () {
  'use strict';
  const D = window.Dream;
  const A = D.Atlas;

  const STRIDE = 20; // floats per glyph instance
  const COLS = A.COLS, HALF = A.HALF;

  /* The swell of the sea: [dirX, dirZ, k, omega, amplitude, phase].
     The same numbers drive the shader and the CPU copy in world.js. */
  const WAVES = [
    [0.2425, 0.9701, 0.1366, 0.55, 0.62, 0.0],
    [-0.6, 0.8, 0.2992, 0.85, 0.3, 1.7],
    [0.8944, 0.4472, 0.6614, 1.3, 0.13, 4.1],
    [-0.1961, 0.9806, 1.4612, 2.1, 0.05, 2.6],
  ];
  const RIP = { speed: 13.0, w: 0.055, k: 1.25, decay: 0.5 };
  // the Milky Way: a great circle through two points of the visible sky (azimuth, elevation)
  const BAND_A = D.U.dirAzEl(-40 * D.U.DEG, 6 * D.U.DEG);
  const BANDN = D.U.v.norm(D.U.v.cross(BAND_A, D.U.dirAzEl(-5 * D.U.DEG, 29 * D.U.DEG)));
  const SUN = [-0.1394, -0.05, -0.989];       // where morning will come from

  const R = (D.R = {
    STRIDE, WAVES, RIP, BANDN, BAND_A, SUN,
    gl: null, canvas: null, ok: false, lost: false, nStatic: 0, W: null, info: '',
  });

  const f = (x) => {
    const s = Number(x).toFixed(5);
    return s.indexOf('.') < 0 ? s + '.0' : s;
  };
  const v3 = (a) => 'vec3(' + f(a[0]) + ',' + f(a[1]) + ',' + f(a[2]) + ')';

  function waveGLSL() {
    let s = '';
    WAVES.forEach((w) => {
      const dx = f(w[0]), dz = f(w[1]), k = f(w[2]), om = f(w[3]), a = f(w[4]), ph = f(w[5]);
      s += '  ph = dot(p, vec2(' + dx + ',' + dz + ')) * ' + k + ' - t * ' + om + ' + ' + ph + ';\n';
      s += '  h += ' + a + ' * sin(ph); g += vec2(' + dx + ',' + dz + ') * (' + a + ' * ' + k + ' * cos(ph));\n';
    });
    return s;
  }

  /* ------------------------------------------------------------------ glyphs */
  const GLYPH_VS = `
precision highp float;
attribute vec2 aCorner;
attribute vec3 aPos;
attribute vec3 aU;
attribute vec3 aV;
attribute vec4 aColor;
attribute vec4 aGlyph;
attribute vec3 aFx;

uniform mat4 uVP;
uniform mat3 uSkyRot;
uniform vec3 uCamPos;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform float uTime;
uniform float uSeaTime;
uniform float uAspect;
uniform vec3 uPointer;
uniform float uLensR;
uniform float uSwell;
uniform vec4 uRip[8];
uniform vec3 uMoonDir;
uniform vec2 uMoonCos;
uniform float uMoonGlit;
uniform vec4 uPL[3];
uniform vec3 uPLc[3];
uniform float uCellUV;
uniform vec4 uReveal;
uniform vec4 uPulse;
uniform mediump float uInk;
uniform float uFade;
uniform float uStarBoost;
uniform float uStretch;
uniform float uSolid;

varying vec2 vUV;
varying vec4 vColor;
varying float vOpaque;

float waveH(vec2 p, float t, float amp, out vec2 g) {
  float h = 0.0;
  float ph;
  g = vec2(0.0);
${waveGLSL()}
  h *= amp; g *= amp;
  for (int i = 0; i < 8; i++) {
    vec4 r = uRip[i];
    if (r.w > 0.001) {
      vec2 dv = p - r.xy;
      float d = length(dv) + 0.001;
      float x = d - r.z * ${f(RIP.speed)};
      float env = exp(-x * x * ${f(RIP.w)}) * exp(-r.z * ${f(RIP.decay)}) * r.w * smoothstep(0.0, 0.3, r.z);
      float s = sin(x * ${f(RIP.k)});
      float c = cos(x * ${f(RIP.k)});
      h += env * s;
      g += (dv / d) * (env * (c * ${f(RIP.k)} - s * 2.0 * x * ${f(RIP.w)}));
    }
  }
  return h;
}

void main() {
  float mode = aGlyph.z;
  float seed = aGlyph.w;
  vec2 c = aCorner;
  vec3 center = aPos;
  vec3 axU;
  vec3 axV;
  vec3 flatV = vec3(0.0);
  vec3 col = aColor.rgb;
  float a = aColor.a;
  float lum = 1.0;
  float standing = 0.0;
  float seaDist = 0.0;
  float canStand = 0.0;
  float hs = aU.x;

  if (mode > 1.5 && mode < 2.5) {
    // the sea: a letter lying on the water
    float halfW = aU.y;
    float x = aPos.x + aU.z * uSeaTime;
    x = mod(x + halfW, 2.0 * halfW) - halfW;
    vec2 p = vec2(x, aPos.z);
    float dist0 = length(vec3(x, 0.0, aPos.z) - uCamPos);
    seaDist = dist0;
    canStand = aV.y;
    float amp = uSwell * (1.0 + dist0 * 0.005);
    vec2 g;
    float h = waveH(p, uSeaTime, amp, g);
    center = vec3(x, h, aPos.z);
    axU = vec3(1.0, g.x * 0.6, 0.0) * hs;
    flatV = normalize(vec3(0.0, -g.y, -1.0)) * (hs * mix(aV.x, 1.15, uStretch));
    axV = flatV;
    standing = 1.0;

    float facing = clamp(0.62 - g.y * 1.5 / (0.5 + 0.5 * uSwell), 0.15, 1.6);
    lum *= facing;

    vec2 toP = normalize(center.xz - uCamPos.xz);
    vec2 toM = normalize(uMoonDir.xz + vec2(0.0, -0.00001));
    float diff = acos(clamp(dot(toP, toM), -1.0, 1.0));
    float w = 0.05 + 0.035 * uSwell + 3.0 / (dist0 + 16.0);
    float glit = exp(-diff * diff / (w * w));
    float sp = pow(0.5 + 0.5 * sin(uTime * (1.6 + fract(seed * 5.3) * 3.4) + seed * 97.0), 5.0);
    lum += glit * (0.55 + 3.0 * sp) * uMoonGlit / (0.55 + 0.45 * uSwell) * mix(1.0, 0.4, smoothstep(50.0, 380.0, dist0));
    col = mix(col, vec3(1.0, 0.95, 0.82), clamp(glit * 0.75 * uMoonGlit, 0.0, 1.0));

    for (int i = 0; i < 3; i++) {
      vec4 L = uPL[i];
      if (L.w > 0.001) {
        vec2 v = center.xz - L.xy;
        vec2 cd = normalize(uCamPos.xz - L.xy);
        float al = dot(v, cd);
        vec2 pv = v - cd * al;
        if (al > 0.0) al /= 3.4;
        float I = L.w * exp(-(al * al + dot(pv, pv)) / (L.z * L.z));
        lum += I * 0.85;
        col = mix(col, uPLc[i], clamp(I, 0.0, 1.0));
      }
    }
    a *= smoothstep(4.0, 12.0, dist0) * mix(1.0, 0.34, smoothstep(50.0, 600.0, dist0));
    a *= 1.0 - smoothstep(halfW * 0.9, halfW, abs(x));
  } else if (mode > 0.5 && mode < 1.5) {
    // a quad with its own place in the world
    axU = aU;
    axV = aV;
  } else {
    // a billboard, on the turning sky (4) or free in the world (0)
    float rot = aU.y;
    float sy = aV.x;
    if (mode > 3.5) {
      vec3 dir = uSkyRot * aPos;
      center = uCamPos + dir;
      vec3 nd = normalize(dir);
      a *= smoothstep(0.012, 0.085, nd.y);
      a *= 1.0 - smoothstep(uMoonCos.x, uMoonCos.y, dot(nd, uMoonDir));
      lum *= uStarBoost;
      sy = 1.0;
      if (dot(aV, aV) > 0.0001) {
        vec3 tg = uSkyRot * aV;
        rot = atan(dot(tg, uCamU), dot(tg, uCamR));
      }
    }
    float cr = cos(rot);
    float sr = sin(rot);
    axU = (uCamR * cr + uCamU * sr) * (hs * aU.z);
    axV = (uCamU * cr - uCamR * sr) * (hs * sy);
  }

  vec4 clip = uVP * vec4(center, 1.0);
  vec2 ndc = clip.xy / max(clip.w, 0.0001);
  float front = step(0.0, clip.w);
  vec2 asp = vec2(uAspect, 1.0);

  // the visitor's light: a lens that wakes the words it falls on.
  // It enlarges them, and (lens > 0) also spreads them apart the way real glass does, so that
  // close-set lines of very small type open up and can be read. lens < 0 enlarges without moving.
  vec2 dv = (ndc - uPointer.xy) * asp;
  float lens = abs(aFx.x);
  float hasLens = step(0.001, lens);
  float r2 = dot(dv, dv) / (uLensR * uLensR);
  float wake = exp(-r2) * uPointer.z * front * hasLens;
  // large shapes (a moon, a whale) are only touched where the glass actually lies on them;
  // very small type (the Milky Way, the stars) opens up gradually, so its lines never fold over
  float mag = ((lens > 1.2) ? 1.0 / ((1.0 + 0.5 * r2) * (1.0 + 0.5 * r2)) : exp(-r2 / 1.3)) * uPointer.z * front;
  float scale = 1.0 + lens * mag;
  float spread = (mode > 3.5) ? min(lens, 2.3) : lens;
  vec2 push = (aFx.x > 0.0) ? dv * (spread * mag) / asp : vec2(0.0);
  if (standing > 0.5) {
    float up = wake * (1.0 - smoothstep(140.0, 340.0, seaDist));
    float st = up * canStand;
    axV = mix(flatV, uCamU * (hs * 1.12), st * 0.94);
    center.y += st * hs * 0.8;
    lum *= 1.0 + 0.55 * wake * canStand;
    a *= mix(1.0 - 0.85 * up, 1.0, canStand);
  } else {
    lum *= 1.0 + 0.75 * wake;
    a = min(1.0, a * (1.0 + 0.9 * wake));
  }
  col = mix(col, vec3(1.0, 0.92, 0.76), 0.3 * wake);

  // twinkle
  float tw = aFx.z;
  if (tw > 0.0) {
    lum *= max(0.08, 1.0 + tw * (sin(uTime * (0.7 + fract(seed * 7.31) * 2.3) + seed * 61.0) * 0.6
                               + sin(uTime * (2.9 + fract(seed * 3.17) * 3.1) + seed * 17.0) * 0.4));
  }

  // the dream opening outward from the light
  float rd = length((ndc - uReveal.xy) * asp);
  float rev = 1.0 - smoothstep(uReveal.z - uReveal.w, uReveal.z, rd);
  a *= rev;
  float edge = (rd - uReveal.z + uReveal.w * 0.5) / 0.1;
  lum += exp(-edge * edge) * 1.1 * (1.0 - step(4.0, uReveal.z));

  // a pulse travelling through every word
  float pd = length((ndc - uPulse.xy) * asp);
  float pe = (pd - uPulse.z) / 0.14;
  float pu = exp(-pe * pe) * uPulse.w;
  lum += pu * 1.8;
  scale += pu * 0.22;

  vec3 P = center + (axU * c.x + axV * c.y) * scale;

  // light without letters cannot become ink
  float fxk = aGlyph.x;
  float isGlow = (aGlyph.y < 0.5 && (fxk < 0.5 || fxk > 2.5)) ? 1.0 : 0.0;
  a *= 1.0 - uInk * isGlow;
  a *= 1.0 - (1.0 - uSolid) * ((aGlyph.y < 0.5 && fxk > 4.5) ? 1.0 : 0.0);

  vColor = vec4(col * max(lum, 0.0), a * uFade);
  vOpaque = aFx.y;
  vUV = (aGlyph.xy + vec2(c.x * 0.5 + 0.5, 0.5 - c.y * 0.5)) * uCellUV;
  gl_Position = uVP * vec4(P, 1.0);
  gl_Position.xy += push * gl_Position.w;
}`;

  const GLYPH_FS = `
precision mediump float;
uniform sampler2D uAtlas;
uniform float uInk;
uniform vec3 uInkCol;
varying vec2 vUV;
varying vec4 vColor;
varying float vOpaque;
void main() {
  float m = texture2D(uAtlas, vUV).a;
  float a = vColor.a * m;
  vec3 rgb = vColor.rgb;
  float bright = max(rgb.r, max(rgb.g, rgb.b));
  float ai = a * clamp(0.3 + 0.8 * bright, 0.0, 1.0);
  vec3 c = mix(rgb, uInkCol, uInk);
  float aa = mix(a, ai, uInk);
  float op = mix(vOpaque, 1.0, uInk);
  gl_FragColor = vec4(c * aa, aa * op);
}`;

  /* ------------------------------------------------------------- background */
  const BG_VS = `
attribute vec2 aP;
varying vec2 vNdc;
void main() { vNdc = aP; gl_Position = vec4(aP, 0.0, 1.0); }`;

  const BG_FS = `
precision highp float;
varying vec2 vNdc;
uniform vec3 uF;
uniform vec3 uR;
uniform vec3 uU;
uniform mat3 uSkyInv;
uniform vec3 uMoonDir;
uniform float uDawn;
uniform float uPaper;
uniform float uBright;
uniform float uMoonGlow;
uniform float uPre;
uniform vec4 uReveal;
uniform float uAspect;
uniform vec4 uAur;

float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 fr = fract(x);
  fr = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(mix(h3(i), h3(i + vec3(1.0, 0.0, 0.0)), fr.x),
                 mix(h3(i + vec3(0.0, 1.0, 0.0)), h3(i + vec3(1.0, 1.0, 0.0)), fr.x), fr.y),
             mix(mix(h3(i + vec3(0.0, 0.0, 1.0)), h3(i + vec3(1.0, 0.0, 1.0)), fr.x),
                 mix(h3(i + vec3(0.0, 1.0, 1.0)), h3(i + vec3(1.0, 1.0, 1.0)), fr.x), fr.y), fr.z);
}
float fbm(vec3 p) { return vnoise(p) * 0.55 + vnoise(p * 2.07 + 3.1) * 0.3 + vnoise(p * 4.3 + 7.7) * 0.15; }
float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

void main() {
  vec3 d = normalize(uF + uR * vNdc.x + uU * vNdc.y);
  float e = d.y;
  float mu = max(dot(d, uMoonDir), 0.0);
  vec3 night;
  vec3 dawn;
  if (e > 0.0) {
    vec3 zen = vec3(0.010, 0.014, 0.045);
    vec3 mid = vec3(0.026, 0.044, 0.122);
    vec3 hor = vec3(0.070, 0.128, 0.235);
    night = mix(hor, mid, smoothstep(0.0, 0.30, e));
    night = mix(night, zen, smoothstep(0.22, 0.95, e));
    night += vec3(0.015, 0.060, 0.070) * exp(-e * 9.0);
    night += vec3(0.50, 0.58, 0.82) * (pow(mu, 70.0) * 0.20 + pow(mu, 9.0) * 0.075) * uMoonGlow;
    vec3 sd = uSkyInv * d;
    float bd = dot(sd, ${v3(BANDN)}) * 3.4;
    float band = exp(-bd * bd);
    float n1 = fbm(sd * 4.2 + 2.0);
    float n2 = fbm(sd * 9.5 + 11.0);
    night += band * (vec3(0.040, 0.050, 0.110) * n1 + vec3(0.060, 0.035, 0.085) * n1 * n2) * smoothstep(0.0, 0.25, e) * 1.25;
    float ae = (e - 0.42) * 3.2;
    night += vec3(0.10, 0.34, 0.24) * uAur.x * exp(-ae * ae) * (0.5 + 0.5 * fbm(d * 3.0 + uAur.y));
    night += vec3(0.30, 0.16, 0.20) * exp(-e * 6.0) * uPre;

    vec3 dzen = vec3(0.26, 0.36, 0.66);
    vec3 dmid = vec3(0.66, 0.60, 0.76);
    vec3 dhor = vec3(1.00, 0.74, 0.56);
    dawn = mix(dhor, dmid, smoothstep(0.0, 0.26, e));
    dawn = mix(dawn, dzen, smoothstep(0.18, 0.9, e));
    float su = max(dot(d, ${v3(SUN)}), 0.0);
    dawn += vec3(1.0, 0.72, 0.42) * pow(su, 5.0) * 0.45;
  } else {
    float s = -e;
    vec3 seaFar = vec3(0.058, 0.110, 0.200);
    vec3 seaNear = vec3(0.006, 0.012, 0.034);
    night = mix(seaFar, seaNear, pow(s, 0.42));
    vec2 az = normalize(d.xz + vec2(0.0, -0.00001));
    vec2 mz = normalize(uMoonDir.xz);
    float colw = pow(max(dot(az, mz), 0.0), 140.0);
    night += vec3(0.30, 0.38, 0.56) * colw * pow(1.0 - s, 3.0) * 0.5 * uMoonGlow;
    night += vec3(0.20, 0.10, 0.12) * exp(-s * 7.0) * uPre;
    dawn = mix(vec3(0.93, 0.70, 0.62), vec3(0.30, 0.40, 0.62), pow(s, 0.5));
    float sv = pow(max(dot(az, normalize(${v3(SUN)}.xz)), 0.0), 40.0);
    dawn += vec3(1.0, 0.75, 0.5) * sv * pow(1.0 - s, 2.0) * 0.4;
  }
  float haze = exp(-abs(e) * 55.0);
  night += vec3(0.09, 0.16, 0.27) * haze * 0.55;
  dawn += vec3(1.0, 0.85, 0.7) * haze * 0.25;

  float vg = 1.0 - 0.28 * pow(length(vNdc * vec2(0.85, 1.0)), 2.4);
  float rd = length((vNdc - uReveal.xy) * vec2(uAspect, 1.0));
  float rev = 1.0 - smoothstep(uReveal.z - uReveal.w, uReveal.z, rd);
  night *= vg * mix(uBright, 1.0, rev);
  vec3 col = mix(night, dawn, uDawn);

  vec2 fc = gl_FragCoord.xy;
  float grain = h2(fc) - 0.5;
  float fiber = vnoise(vec3(fc * 0.011, 1.7)) - 0.5;
  vec3 paper = vec3(0.957, 0.928, 0.868) + vec3(0.012, 0.004, -0.012) * vNdc.y + grain * 0.016 + fiber * 0.022;
  paper *= 1.0 - 0.07 * pow(length(vNdc * vec2(0.8, 1.0)), 3.0);
  col = mix(col, paper, uPaper);
  col += grain * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

  /* ---------------------------------------------------------------- writer */
  class Writer {
    constructor(max) {
      this.max = max;
      this.d = new Float32Array(max * STRIDE);
      this.n = 0;
    }
    reset() { this.n = 0; }

    /* a letter facing the viewer; em = type size in world units */
    bb(x, y, z, em, rot, r, g, b, a, cell, seed, lens, tw, sx, sy) {
      if (this.n >= this.max || a <= 0.003) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = em * HALF; d[o + 4] = rot; d[o + 5] = sx === undefined ? 1 : sx;
      d[o + 6] = sy === undefined ? 1 : sy; d[o + 7] = 0; d[o + 8] = 0;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = cell % COLS; d[o + 14] = (cell / COLS) | 0; d[o + 15] = 0; d[o + 16] = seed;
      d[o + 17] = lens; d[o + 18] = 0; d[o + 19] = tw;
    }
    /* light, line or ring facing the viewer; half = half-extent in world units */
    spr(x, y, z, half, rot, sx, sy, r, g, b, a, cell, opaque) {
      if (this.n >= this.max || a <= 0.003) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = half; d[o + 4] = rot; d[o + 5] = sx;
      d[o + 6] = sy; d[o + 7] = 0; d[o + 8] = 0;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = cell % COLS; d[o + 14] = (cell / COLS) | 0; d[o + 15] = 0; d[o + 16] = 0;
      d[o + 17] = 0; d[o + 18] = opaque || 0; d[o + 19] = 0;
    }
    /* a quad with its own orientation; U and V are half-extent vectors */
    quad(x, y, z, ux, uy, uz, vx, vy, vz, r, g, b, a, cell, seed, lens, opaque) {
      if (this.n >= this.max || a <= 0.003) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = ux; d[o + 4] = uy; d[o + 5] = uz;
      d[o + 6] = vx; d[o + 7] = vy; d[o + 8] = vz;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = cell % COLS; d[o + 14] = (cell / COLS) | 0; d[o + 15] = 1; d[o + 16] = seed || 0;
      d[o + 17] = lens || 0; d[o + 18] = opaque || 0; d[o + 19] = 0;
    }
    /* a letter lying flat on still water, readable from the shore */
    flat(x, y, z, em, stretch, r, g, b, a, cell, seed, lens) {
      const h = em * HALF;
      this.quad(x, y, z, h, 0, 0, 0, 0, -h * stretch, r, g, b, a, cell, seed, lens, 0);
    }
    /* a letter of the sea itself; the shader makes it roll */
    sea(x, z, em, halfW, drift, stretch, r, g, b, a, cell, seed, lens, stand) {
      if (this.n >= this.max) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = x; d[o + 1] = 0; d[o + 2] = z;
      d[o + 3] = em * HALF; d[o + 4] = halfW; d[o + 5] = drift;
      d[o + 6] = stretch; d[o + 7] = stand ? 1 : 0; d[o + 8] = 0;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = cell % COLS; d[o + 14] = (cell / COLS) | 0; d[o + 15] = 2; d[o + 16] = seed;
      d[o + 17] = lens; d[o + 18] = 0; d[o + 19] = 0;
    }
    /* a letter fixed to the turning sky; p = direction × radius */
    sky(px, py, pz, em, rot, r, g, b, a, cell, seed, lens, tw, tx, ty, tz) {
      if (this.n >= this.max) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = px; d[o + 1] = py; d[o + 2] = pz;
      d[o + 3] = em * HALF; d[o + 4] = rot; d[o + 5] = 1;
      d[o + 6] = tx || 0; d[o + 7] = ty || 0; d[o + 8] = tz || 0;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = cell % COLS; d[o + 14] = (cell / COLS) | 0; d[o + 15] = 4; d[o + 16] = seed;
      d[o + 17] = lens; d[o + 18] = 0; d[o + 19] = tw;
    }
    /* a point of light fixed to the turning sky */
    skyGlow(px, py, pz, half, r, g, b, a, seed, tw, lens) {
      if (this.n >= this.max) return;
      const o = this.n++ * STRIDE, d = this.d;
      d[o] = px; d[o + 1] = py; d[o + 2] = pz;
      d[o + 3] = half; d[o + 4] = 0; d[o + 5] = 1;
      d[o + 6] = 0; d[o + 7] = 0; d[o + 8] = 0;
      d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
      d[o + 13] = 0; d[o + 14] = 0; d[o + 15] = 4; d[o + 16] = seed;
      d[o + 17] = lens || 0; d[o + 18] = 0; d[o + 19] = tw;
    }
  }
  R.Writer = Writer;

  /* ----------------------------------------------------------------- setup */
  let gl = null, inst = null;
  let gp = null, bg = null;
  let quadBuf = null, triBuf = null, staticBuf = null, dynBuf = null, tex = null;
  let staticData = null;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('shader compile: ' + log);
    }
    return s;
  }
  function program(vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('program link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  function setup() {
    gp = program(GLYPH_VS, GLYPH_FS, ['aCorner', 'aPos', 'aU', 'aV', 'aColor', 'aGlyph', 'aFx']);
    bg = program(BG_VS, BG_FS, ['aP']);

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    triBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    staticBuf = gl.createBuffer();
    dynBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, R.W.max * STRIDE * 4, gl.DYNAMIC_DRAW);

    tex = gl.createTexture();
    A.dirty = true;

    inst.div(0, 0);
    for (let i = 1; i <= 6; i++) inst.div(i, 1);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    if (staticData) R.setStatic(staticData);
  }

  function uploadAtlas() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (aniso) {
      const mx = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, mx));
    }
    A.dirty = false;
  }

  R.init = function (canvas, maxDyn) {
    const opts = {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
    };
    gl = null;
    try { gl = canvas.getContext('webgl2', opts); } catch (e) { gl = null; }
    if (gl) {
      inst = {
        div: (l, d) => gl.vertexAttribDivisor(l, d),
        draw: (n) => gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n),
      };
      R.info = 'webgl2';
    } else {
      try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
      if (!gl) return false;
      const ext = gl.getExtension('ANGLE_instanced_arrays');
      if (!ext) return false;
      inst = {
        div: (l, d) => ext.vertexAttribDivisorANGLE(l, d),
        draw: (n) => ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n),
      };
      R.info = 'webgl1';
    }
    R.gl = gl; R.canvas = canvas;
    R.W = new Writer(maxDyn);
    try {
      setup();
    } catch (err) {
      console.error(err);
      return false;
    }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      try { setup(); R.lost = false; } catch (err) { console.error(err); }
    });
    R.ok = true;
    return true;
  };

  R.setStatic = function (writer) {
    staticData = writer;
    if (!gl) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, staticBuf);
    gl.bufferData(gl.ARRAY_BUFFER, writer.d.subarray(0, writer.n * STRIDE), gl.STATIC_DRAW);
    R.nStatic = writer.n;
  };

  function bindInstances(buf) {
    const B = STRIDE * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B, 0);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, B, 12);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, B, 24);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, B, 36);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, B, 52);
    gl.vertexAttribPointer(6, 3, gl.FLOAT, false, B, 68);
  }

  /* u: every uniform for this frame (see world.js → uniforms()) */
  R.draw = function (u) {
    if (!gl || R.lost) return;
    if (A.dirty) uploadAtlas();
    const W = R.W;
    gl.viewport(0, 0, R.canvas.width, R.canvas.height);

    // the sky and the dark water
    gl.disable(gl.BLEND);
    gl.useProgram(bg.p);
    for (let i = 1; i <= 6; i++) gl.disableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    let b = bg.u;
    gl.uniform3fv(b.uF, u.camF);
    gl.uniform3f(b.uR, u.camR[0] * u.tanX, u.camR[1] * u.tanX, u.camR[2] * u.tanX);
    gl.uniform3f(b.uU, u.camU[0] * u.tanY, u.camU[1] * u.tanY, u.camU[2] * u.tanY);
    gl.uniformMatrix3fv(b.uSkyInv, false, u.skyInv);
    gl.uniform3fv(b.uMoonDir, u.moonDir);
    gl.uniform1f(b.uDawn, u.dawn);
    gl.uniform1f(b.uPaper, u.paper);
    gl.uniform1f(b.uBright, u.bright);
    gl.uniform1f(b.uMoonGlow, u.moonGlow);
    gl.uniform1f(b.uPre, u.pre);
    gl.uniform4fv(b.uReveal, u.reveal);
    gl.uniform1f(b.uAspect, u.aspect);
    gl.uniform4fv(b.uAur, u.aur);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // every letter
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gp.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 1; i <= 6; i++) gl.enableVertexAttribArray(i);
    b = gp.u;
    gl.uniformMatrix4fv(b.uVP, false, u.VP);
    gl.uniformMatrix3fv(b.uSkyRot, false, u.skyRot);
    gl.uniform3fv(b.uCamPos, u.camPos);
    gl.uniform3fv(b.uCamR, u.camR);
    gl.uniform3fv(b.uCamU, u.camU);
    gl.uniform1f(b.uTime, u.time);
    gl.uniform1f(b.uSeaTime, u.seaTime);
    gl.uniform1f(b.uAspect, u.aspect);
    gl.uniform3fv(b.uPointer, u.pointer);
    gl.uniform1f(b.uLensR, u.lensR);
    gl.uniform1f(b.uSwell, u.swell);
    gl.uniform4fv(b.uRip, u.rip);
    gl.uniform3fv(b.uMoonDir, u.moonDir);
    gl.uniform2fv(b.uMoonCos, u.moonCos);
    gl.uniform1f(b.uMoonGlit, u.moonGlit);
    gl.uniform4fv(b.uPL, u.PL);
    gl.uniform3fv(b.uPLc, u.PLc);
    gl.uniform1f(b.uCellUV, A.CELL_UV);
    gl.uniform4fv(b.uReveal, u.reveal);
    gl.uniform4fv(b.uPulse, u.pulse);
    gl.uniform1f(b.uInk, u.ink);
    gl.uniform3fv(b.uInkCol, u.inkCol);
    gl.uniform1f(b.uFade, u.fade);
    gl.uniform1f(b.uStarBoost, u.starBoost);
    gl.uniform1f(b.uStretch, u.stretch);
    gl.uniform1f(b.uSolid, u.solid);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(b.uAtlas, 0);

    if (R.nStatic) { bindInstances(staticBuf); inst.draw(R.nStatic); }
    if (W.n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, W.d.subarray(0, W.n * STRIDE));
      bindInstances(dynBuf);
      inst.draw(W.n);
    }
  };
})();
