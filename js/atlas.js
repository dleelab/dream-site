/* 글의 바다 — a sea of words
   atlas.js : every letter the dream uses is drawn once onto one sheet,
   and new letters are added the moment a visitor types them. */
(function () {
  'use strict';
  const D = window.Dream;

  const CELL = 72;          // px per cell
  const SIZE = 2048;        // sheet edge
  const COLS = Math.floor(SIZE / CELL);
  const FONT_PX = 50;

  const A = (D.Atlas = {
    CELL, SIZE, COLS, FONT_PX,
    HALF: CELL / FONT_PX / 2,      // quad half-extent, per em of type
    CELL_UV: CELL / SIZE,
    FX: { glow: 0, bar: 1, ring: 2, disc: 3, beam: 4, solid: 6 },
    map: new Map(),
    advs: new Map(),
    words: new Map(),
    next: COLS,                    // row 0 is kept for light, lines and rings
    dirty: true,
    canvas: null,
    ctx: null,
    dot: 0,
    family:
      '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ' +
      '"AppleMyungjo", "Nanum Myeongjo", "Noto Serif KR", "Noto Serif CJK KR", "Songti SC", Batang, serif',
  });

  function drawFX(ctx) {
    const c = CELL / 2;
    let g, ox;

    // 0 — glow: a soft point of light
    g = ctx.createRadialGradient(c, c, 0, c, c, c - 1);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.82)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.035)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CELL, CELL);

    // 1 — bar: a thin line (constellation threads)
    ox = CELL;
    g = ctx.createLinearGradient(0, c - 5, 0, c + 5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox + 3, c - 5, CELL - 6, 10);

    // 2 — ring: where something touched the water
    ox = CELL * 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(ox + c, c, 27, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ox + c, c, 27, 0, Math.PI * 2); ctx.stroke();

    // 3 — disc: a soft-edged body of light
    ox = CELL * 3;
    g = ctx.createRadialGradient(ox + c, c, 0, ox + c, c, c - 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.78, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox, 0, CELL, CELL);

    // 4 — beam: light leaving a lamp, left to right
    ox = CELL * 4;
    for (let i = 0; i < 5; i++) {
      const spread = 20 - i * 4;
      g = ctx.createLinearGradient(ox + 2, 0, ox + CELL - 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.32)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox + 2, c - 1.5);
      ctx.lineTo(ox + CELL - 2, c - spread);
      ctx.lineTo(ox + CELL - 2, c + spread);
      ctx.lineTo(ox + 2, c + 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // 5–7 — solid (6 is used; 5 and 7 guard its edges): to stand between the stars and a mountain
    ox = CELL * 5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox, 0, CELL * 3, CELL);
  }

  A.init = function (family) {
    if (family) A.family = family;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    const ctx = cv.getContext('2d');
    A.canvas = cv; A.ctx = ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawFX(ctx);
    ctx.font = FONT_PX + 'px ' + A.family;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    A.map.clear(); A.advs.clear(); A.words.clear();
    A.next = COLS;
    A.dirty = true;
    A.dot = A.add('·');
  };

  /* draw one grapheme into the next free cell; returns its cell index */
  A.add = function (ch) {
    const had = A.map.get(ch);
    if (had !== undefined) return had;
    if (A.next >= COLS * COLS) return A.dot;       // the sheet is full: fall back to a dot
    const i = A.next++;
    const x0 = (i % COLS) * CELL, y0 = Math.floor(i / COLS) * CELL;
    const ctx = A.ctx;
    const w = ctx.measureText(ch).width;
    const maxW = CELL - 10;
    const base = y0 + CELL * 0.5 + FONT_PX * 0.345;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 1, y0 + 1, CELL - 2, CELL - 2);
    ctx.clip();
    ctx.fillStyle = '#fff';
    if (w > maxW) {
      ctx.translate(x0 + CELL / 2, 0);
      ctx.scale(maxW / w, 1);
      ctx.fillText(ch, 0, base);
    } else {
      ctx.fillText(ch, x0 + CELL / 2, base);
    }
    ctx.restore();
    A.map.set(ch, i);
    A.advs.set(ch, Math.max(0.22, Math.min(w, maxW) / FONT_PX));
    A.dirty = true;
    return i;
  };

  A.cell = (ch) => {
    const i = A.map.get(ch);
    return i === undefined ? A.add(ch) : i;
  };
  A.adv = (ch) => {
    if (!A.advs.has(ch)) A.add(ch);
    return A.advs.get(ch) || 0.6;
  };

  /* a word as glyphs: [{c: cell, a: advance in em, sp: is a space}] plus .w, its width in em */
  A.glyphs = function (word) {
    let g = A.words.get(word);
    if (g) return g;
    g = [];
    let w = 0;
    const parts = D.Lex.graphemes(String(word).normalize('NFC'));
    for (const ch of parts) {
      if (/^\s+$/.test(ch)) { g.push({ c: -1, a: 0.32, sp: true }); w += 0.32; continue; }
      const c = A.cell(ch), a = A.adv(ch);
      g.push({ c, a, sp: false });
      w += a;
    }
    g.w = w;
    A.words.set(word, g);
    return g;
  };

  /* make sure a run of text is on the sheet */
  A.ensure = function (text) {
    const parts = D.Lex.graphemes(String(text).normalize('NFC'));
    for (const ch of parts) if (!/^\s+$/.test(ch)) A.cell(ch);
  };
})();
