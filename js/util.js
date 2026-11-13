/* 말로 지은 밤 — a night made of words
   util.js : small math helpers. No dependencies. */
(function () {
  'use strict';
  const D = (window.Dream = window.Dream || {});
  const U = (D.U = {});

  U.TAU = Math.PI * 2;
  U.DEG = Math.PI / 180;

  U.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.easeOut = (t) => 1 - Math.pow(1 - U.clamp(t, 0, 1), 3);
  U.easeIn = (t) => { t = U.clamp(t, 0, 1); return t * t * t; };
  U.easeInOut = (t) => {
    t = U.clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  U.backOut = (t) => {
    t = U.clamp(t, 0, 1);
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  /* seeded random (mulberry32) for anything that must be rebuilt identically */
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.rr = (a, b) => a + Math.random() * (b - a);
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  U.hash1 = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  U.noise1 = (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return U.lerp(U.hash1(i), U.hash1(i + 1), u);
  };
  U.fbm1 = (x) =>
    U.noise1(x) * 0.55 + U.noise1(x * 2.13 + 7.1) * 0.3 + U.noise1(x * 4.7 + 3.3) * 0.15;
  U.hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  U.noise2 = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = U.hash2(ix, iy), b = U.hash2(ix + 1, iy);
    const c = U.hash2(ix, iy + 1), d = U.hash2(ix + 1, iy + 1);
    return U.lerp(U.lerp(a, b, ux), U.lerp(c, d, ux), uy);
  };

  /* vec3 on plain arrays */
  const V = (U.v = {});
  V.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  V.sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  V.scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  V.dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  V.cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  V.len = (a) => Math.hypot(a[0], a[1], a[2]);
  V.norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  V.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* direction from azimuth (0 = straight ahead, −z) and elevation, radians */
  U.dirAzEl = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];

  /* mat4, column-major Float32Array(16) */
  U.perspective = (o, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  };
  /* view matrix from an orthonormal camera basis */
  U.viewFromBasis = (o, e, R, Up, F) => {
    o[0] = R[0]; o[4] = R[1]; o[8] = R[2]; o[12] = -V.dot(R, e);
    o[1] = Up[0]; o[5] = Up[1]; o[9] = Up[2]; o[13] = -V.dot(Up, e);
    o[2] = -F[0]; o[6] = -F[1]; o[10] = -F[2]; o[14] = V.dot(F, e);
    o[3] = 0; o[7] = 0; o[11] = 0; o[15] = 1;
    return o;
  };
  U.mul4 = (o, a, b) => {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  };

  /* mat3 (column-major, 9 floats): rotation about a unit axis */
  U.rotAxis = (o, ax, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const x = ax[0], y = ax[1], z = ax[2];
    o[0] = t * x * x + c; o[1] = t * x * y + s * z; o[2] = t * x * z - s * y;
    o[3] = t * x * y - s * z; o[4] = t * y * y + c; o[5] = t * y * z + s * x;
    o[6] = t * x * z + s * y; o[7] = t * y * z - s * x; o[8] = t * z * z + c;
    return o;
  };
  U.m3apply = (m, v) => [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
  U.m3transpose = (o, m) => {
    o[0] = m[0]; o[1] = m[3]; o[2] = m[6];
    o[3] = m[1]; o[4] = m[4]; o[5] = m[7];
    o[6] = m[2]; o[7] = m[5]; o[8] = m[8];
    return o;
  };
})();
