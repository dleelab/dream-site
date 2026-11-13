/* 글의 바다 — a sea of words
   ui.js : the part of the page that is not the dream — the threshold, the place
   where a word is typed, the captions, and the letter left in the morning. */
(function () {
  'use strict';
  const D = window.Dream, U = D.U, L = D.Lex, Wd = D.World;
  const $ = (id) => document.getElementById(id);
  const UI = (D.UI = {});
  const els = {};
  const cap = { queue: [], cur: null, t: 0, gap: 0 };
  let seedNext = 0;
  let idle = 0, hintIdx = 0, saidSea = false, saidSky = false, saidSound = false;
  let down = null, wakeArm = 0, lastChar = '', cardURL = '', cardBlob = null, letterWords = [];
  // Inside a claude.ai artifact the page is framed: it may not start a download itself (the platform offers
  // one on request), and its address cannot carry a kept night. Everywhere else it behaves as a plain page.
  const inArtifact = !!(window.claude && typeof window.claude.use === 'function');
  let saver = null, saverAsked = !inArtifact;
  const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "AppleMyungjo", "Nanum Myeongjo", "Noto Serif KR", "Songti SC", Batang, serif';

  const later = (fn, ms) => setTimeout(fn, D.reduced ? Math.min(ms, 80) : ms);
  function show(el) {
    if (!el) return;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('on');
  }
  function hide(el, ms) {
    if (!el) return;
    el.classList.remove('on');
    setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, D.reduced ? 0 : ms || 900);
  }
  function setState(name) {
    const b = document.body;
    b.classList.remove('is-threshold', 'is-night', 'is-waking', 'is-letter');
    b.classList.add('is-' + name);
  }
  function dock(on) {
    [els.say, els.seeds].forEach((el) => {
      el.classList.toggle('on', on);
      if (on) el.removeAttribute('inert'); else el.setAttribute('inert', '');
    });
    els.word.disabled = !on;
  }

  /* ------------------------------------------------------------- captions */
  function line(el, head, body) {
    el.textContent = '';
    if (head) {
      const s = document.createElement('span');
      s.className = 'hw';
      s.textContent = head;
      el.appendChild(s);
      el.appendChild(document.createTextNode(' — ' + body));
    } else {
      el.textContent = body;
    }
  }
  function setCaption(item) {
    line(els.capKo, item.hwKo, item.ko);
    line(els.capEn, item.hwEn, item.en);
    els.caption.classList.add('on');
  }
  /* item: { ko, en, hold, hwKo?, hwEn? } ; now = interrupt whatever is being said */
  UI.say = function (item, now) {
    if (now) {
      cap.queue.length = 0;
      if (cap.cur) {
        els.caption.classList.remove('on');
        cap.cur = null;
        cap.gap = D.reduced ? 0 : 0.35;
      }
    }
    cap.queue.push(item);
  };
  function capTick(dt) {
    if (cap.cur) {
      cap.t += dt;
      if (cap.t >= cap.cur.hold) {
        els.caption.classList.remove('on');
        cap.cur = null;
        cap.gap = D.reduced ? 0.1 : 0.9;
      }
    } else if (cap.gap > 0) {
      cap.gap -= dt;
    } else if (cap.queue.length) {
      cap.cur = cap.queue.shift();
      cap.t = 0;
      setCaption(cap.cur);
    }
  }

  /* ---------------------------------------------------------------- seeds */
  function shownSeeds() {
    return Array.prototype.map.call(els.seeds.querySelectorAll('.seed'), (b) => b.dataset.word);
  }
  function nextSeed() {
    const have = shownSeeds();
    for (let i = 0; i < L.seeds.length; i++) {
      const s = L.seeds[seedNext++ % L.seeds.length];
      if (have.indexOf(s.ko) < 0) return s;
    }
    return L.seeds[seedNext++ % L.seeds.length];
  }
  function seedButton(s) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seed';
    b.dataset.word = s.ko;
    b.dataset.en = s.en;
    const k = document.createElement('span');
    k.lang = 'ko'; k.textContent = s.ko;
    const g = document.createElement('span');
    g.className = 'g'; g.lang = 'en'; g.textContent = s.en;
    b.appendChild(k); b.appendChild(g);
    b.addEventListener('click', () => { if (give(s.ko)) replaceSeed(b); });
    return b;
  }
  function replaceSeed(btn) {
    if (btn.classList.contains('gone')) return;
    btn.classList.add('gone');
    later(() => { if (btn.parentNode) btn.parentNode.replaceChild(seedButton(nextSeed()), btn); }, 450);
  }
  function buildSeeds() {
    els.seeds.textContent = '';
    seedNext = 0;
    const n = Wd.small ? 9 : Wd.w < 900 ? 5 : 7;
    for (let i = 0; i < n; i++) els.seeds.appendChild(seedButton(L.seeds[seedNext++]));
  }

  /* --------------------------------------------------------------- giving */
  function give(text) {
    const ok = D.Flow.give(text);
    if (ok) {
      idle = 0;
      if (!saidSound && D.Sound && !D.Sound.on && D.night.words.length === 2) {
        saidSound = true;
        UI.say({ ko: L.copy.soundOff.ko, en: L.copy.soundOff.en, hold: 5.5 });
      }
    }
    return ok;
  }
  function submit() {
    const v = els.word.value;
    if (!L.clean(v)) { els.word.value = ''; return; }
    if (give(v)) {
      const key = L.clean(v).toLowerCase();
      Array.prototype.forEach.call(els.seeds.querySelectorAll('.seed'), (b) => {
        if (b.dataset.word === key || b.dataset.en === key) replaceSeed(b);
      });
      els.word.value = '';
      lastChar = '';
    }
  }

  /* -------------------------------------------------------------- touching */
  function touchAt(nx, ny) {
    if (D.state !== 'night' || !D.Things) return;
    const sp = Wd.seaTouch(nx, ny, 300);
    if (sp) {
      D.Things.touchSea(sp[0], sp[1], sp[2]);
      if (D.Sound) D.Sound.drop();
      if (!saidSea) { saidSea = true; if (!cap.cur && !cap.queue.length) UI.say({ ko: L.copy.seaTouch.ko, en: L.copy.seaTouch.en, hold: 4 }); }
    } else {
      const d = Wd.ray(nx, ny);
      if (d[1] > 0.03) {
        D.Things.touchSky(d);
        if (D.Sound) D.Sound.star();
        if (!saidSky) { saidSky = true; if (!cap.cur && !cap.queue.length) UI.say({ ko: L.copy.skyTouch.ko, en: L.copy.skyTouch.en, hold: 4 }); }
      }
    }
    idle = 0;
  }

  /* ----------------------------------------------------------------- help */
  function behindHelp(off) {
    [document.getElementById('top'), els.bottom].forEach((el) => {
      if (off) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }
  function openHelp() {
    show(els.help);
    behindHelp(true);
    els.btnHelp.setAttribute('aria-expanded', 'true');
    els.helpClose.focus();
  }
  function closeHelp() {
    hide(els.help, 420);
    behindHelp(false);
    els.btnHelp.setAttribute('aria-expanded', 'false');
    if (D.state === 'night') els.btnHelp.focus();
  }

  /* --------------------------------------------------------------- letter */
  function par(cls, ko, en) {
    const d = document.createElement('div');
    d.className = 'par' + (cls ? ' ' + cls : '');
    const a = document.createElement('p');
    a.className = 'ko'; a.lang = 'ko'; a.textContent = ko;
    const b = document.createElement('p');
    b.className = 'en'; b.lang = 'en'; b.textContent = en;
    d.appendChild(a); d.appendChild(b);
    return d;
  }
  function uniqueWords() {
    const seen = new Set(), out = [];
    D.night.words.forEach((w) => {
      const k = w.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(w); }
    });
    return out;
  }
  function wrapText(x, text, left, y, maxW, lh, maxLines) {
    const toks = text.split(' ');
    let lineText = '', n = 0;
    for (let i = 0; i < toks.length; i++) {
      const test = lineText ? lineText + ' ' + toks[i] : toks[i];
      if (x.measureText(test).width > maxW && lineText) {
        n++;
        if (n >= maxLines) { x.fillText(lineText.replace(/[\s·]+$/, '') + ' …', left, y); return; }
        x.fillText(lineText, left, y);
        y += lh;
        lineText = toks[i];
      } else lineText = test;
    }
    if (lineText) x.fillText(lineText, left, y);
  }
  /* a postcard: the last frame of the night, and the words that made it */
  function makeCard(snap, words) {
    const land = snap.width >= snap.height;
    const W = land ? 1600 : 1080, H = land ? 1130 : 1560;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f7f0e3';
    x.fillRect(0, 0, W, H);
    const m = Math.round(W * 0.045);
    const textH = Math.round(H * (land ? 0.2 : 0.17));
    const iw = W - m * 2, ih = H - m * 2 - textH;
    const s = Math.max(iw / snap.width, ih / snap.height);
    const sw = iw / s, sh = ih / s;
    x.drawImage(snap, (snap.width - sw) / 2, (snap.height - sh) * 0.45, sw, sh, m, m, iw, ih);
    const f = (px, it) => (it ? 'italic ' : '') + Math.round(px) + 'px ' + SERIF;
    let y = m + ih + Math.round(textH * 0.4);
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#1d1b2c';
    x.textAlign = 'left';
    const big = land ? 1 : 1.5;
    x.font = f(W * 0.027 * big);
    x.fillText('글의 바다', m, y);
    const tw = x.measureText('글의 바다').width;
    x.fillStyle = 'rgba(29,27,44,0.66)';
    x.font = f(W * 0.0145 * big, true);
    if (land) x.fillText('a sea of words', m + tw + W * 0.018, y);
    x.textAlign = 'right';
    x.font = f(W * 0.0145 * big);
    let date = '';
    try { date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { date = ''; }
    x.fillText(date, W - m, y);
    x.textAlign = 'left';
    x.fillStyle = '#1d1b2c';
    x.font = f(W * 0.019 * big);
    y += Math.round(textH * 0.3);
    const text = words.length ? words.join(' · ') : '말없이 머문 밤 · a night kept in silence';
    wrapText(x, text, m, y, iw, Math.round(W * 0.029 * big), 2);
    return c;
  }
  function status(ko, en) {
    els.ltStatus.textContent = ko + ' · ' + en;
  }
  function canSave() {
    if (!cardURL) return false;
    if (!inArtifact) return true;
    if (saver) return !!cardBlob;
    return saverAsked && window.self === window.top;      // the artifact opened as a page of its own
  }
  function refreshSave() {
    if (els.ltSave) els.ltSave.hidden = !(D.state === 'letter' && canSave());
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------- hooks for flow */
  UI.onEnter = function (kept) {
    setState('night');
    els.threshold.classList.add('leaving');
    later(() => { els.threshold.hidden = true; }, 1500);
    show(els.controls);
    show(els.bottom);
    later(() => {
      if (D.state !== 'night') return;
      dock(true);
      if (!D.coarse) { try { els.word.focus({ preventScroll: true }); } catch (e) { els.word.focus(); } }
    }, kept ? 1200 : 2600);
    if (kept) UI.say({ ko: L.copy.kept.ko, en: L.copy.kept.en, hold: 5.5 });
    else L.copy.intro.forEach((c) => UI.say({ ko: c.ko, en: c.en, hold: c.hold }));
    idle = -30;
  };

  UI.define = function (hit) {
    const hold = U.clamp(3.4 + (hit.def.ko.length + hit.def.en.length) * 0.034, 4.6, 9);
    UI.say({ hwKo: hit.ko, ko: hit.def.ko, hwEn: hit.en, en: hit.def.en, hold }, true);
  };
  UI.predawn = function () {
    UI.say({ ko: L.copy.predawn.ko, en: L.copy.predawn.en, hold: 6 });
    els.wake.classList.add('ready');
  };
  UI.readyWake = function () { els.wake.classList.add('ready'); };
  UI.forgetting = function () { UI.say({ ko: L.copy.forget.ko, en: L.copy.forget.en, hold: 5 }); };
  UI.soundState = function (on) { els.btnSound.setAttribute('aria-pressed', on ? 'true' : 'false'); };

  UI.onWake = function () {
    setState('waking');
    dock(false);
    try { els.word.blur(); } catch (e) { /* nothing to blur */ }
    els.wake.classList.remove('ready', 'sure');
    if (!els.help.hidden) { hide(els.help, 300); behindHelp(false); }
    cap.queue.length = 0;
    cap.cur = null;
    els.caption.classList.remove('on');
    cap.gap = 0.6;
    L.copy.waking.forEach((c) => UI.say({ ko: c.ko, en: c.en, hold: c.hold }));
    later(() => { if (D.state !== 'night') els.caption.classList.add('inked'); }, 5200);
  };

  UI.showLetter = function () {
    setState('letter');
    hide(els.bottom, 1400);
    const C = L.copy.letter;
    const words = (letterWords = uniqueWords());
    const body = els.ltBody;
    body.textContent = '';
    body.appendChild(par('', C.p1.ko, C.p1.en));
    if (words.length) {
      const shown = words.length > 30 ? words.slice(-30) : words;
      const list = shown.join(', ') + (words.length > 30 ? ' …' : '');
      const w = par('words', C.words.ko + ' ' + list + '.', C.words.en + ' ' + list + '.');
      body.appendChild(w);
    } else {
      body.appendChild(par('', C.nowords.ko, C.nowords.en));
    }
    body.appendChild(par('', C.p3.ko, C.p3.en));
    body.appendChild(par('', C.p4.ko, C.p4.en));
    body.appendChild(par('dream', C.p5.ko, C.p5.en));
    const sign = document.createElement('p');
    sign.className = 'par sign';
    sign.textContent = C.sign;
    body.appendChild(sign);

    els.ltCard.hidden = true;
    els.ltCard.classList.remove('on');
    els.ltSave.hidden = true;
    els.ltLink.hidden = !words.length || inArtifact;
    els.ltStatus.textContent = '';
    els.letter.scrollTop = 0;
    show(els.letter);
    const pars = body.querySelectorAll('.par');
    Array.prototype.forEach.call(pars, (p, i) => later(() => p.classList.add('on'), 700 + i * 1250));
    later(() => {
      if (!D.snapshot) return;
      try {
        const card = makeCard(D.snapshot, words);
        cardURL = card.toDataURL('image/jpeg', 0.9);
        cardBlob = null;
        if (card.toBlob) card.toBlob((b) => { cardBlob = b; refreshSave(); }, 'image/jpeg', 0.9);
        els.ltImg.src = cardURL;
        els.ltCard.hidden = false;
        void els.ltCard.offsetWidth;
        els.ltCard.classList.add('on');
        refreshSave();
      } catch (e) { cardURL = ''; cardBlob = null; }
    }, 700 + 3 * 1250);
    later(() => { try { els.letter.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } }, 900);
  };

  UI.onAgain = function () {
    setState('night');
    hide(els.letter, 1300);
    els.caption.classList.remove('inked');
    show(els.controls);
    show(els.bottom);
    buildSeeds();
    dock(true);
    hintIdx = 0; idle = -10; saidSea = false; saidSky = false;
    cap.queue.length = 0; cap.cur = null; cap.gap = 0.5;
    els.caption.classList.remove('on');
    UI.say({ ko: L.copy.again.ko, en: L.copy.again.en, hold: 5 });
    if (!D.coarse) later(() => { try { els.word.focus({ preventScroll: true }); } catch (e) { els.word.focus(); } }, 900);
  };

  UI.update = function (dt) {
    capTick(dt);
    if (D.state === 'night') {
      idle += dt;
      if (idle > 24 && !cap.cur && !cap.queue.length && hintIdx < L.copy.hints.length) {
        const h = L.copy.hints[hintIdx++];
        UI.say({ ko: h.ko, en: h.en, hold: 6.5 });
        idle = 0;
      }
    }
  };

  /* ----------------------------------------------------------------- init */
  UI.init = function () {
    els.sky = $('sky');
    els.threshold = $('threshold');
    els.controls = $('controls');
    els.btnSound = $('btn-sound');
    els.btnHelp = $('btn-help');
    els.wake = $('btn-wake');
    els.bottom = $('bottom');
    els.caption = $('caption');
    els.capKo = els.caption.querySelector('.ko');
    els.capEn = els.caption.querySelector('.en');
    els.seeds = $('seeds');
    els.say = $('say');
    els.word = $('word');
    els.help = $('help');
    els.helpClose = $('help-close');
    els.calm = $('calm');
    els.letter = $('letter');
    els.ltBody = $('lt-body');
    els.ltCard = $('lt-card');
    els.ltImg = $('lt-img');
    els.ltSave = $('lt-save');
    els.ltLink = $('lt-link');
    els.ltAgain = $('lt-again');
    els.ltStatus = $('lt-status');

    els.calm.checked = !!D.reduced;
    buildSeeds();
    dock(false);

    $('enter-sound').addEventListener('click', () => D.Flow.enter(true));
    $('enter-quiet').addEventListener('click', () => D.Flow.enter(false));

    // the light follows the hand
    window.addEventListener('pointermove', (e) => { Wd.setPointer(e.clientX, e.clientY); }, { passive: true });
    els.sky.addEventListener('pointerdown', (e) => {
      Wd.setPointer(e.clientX, e.clientY);
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    els.sky.addEventListener('pointerup', (e) => {
      if (!down) return;
      const far = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const slow = performance.now() - down.t;
      down = null;
      if (far < 12 && slow < 500) touchAt((e.clientX / Wd.w) * 2 - 1, 1 - (e.clientY / Wd.h) * 2);
    });
    els.sky.addEventListener('pointercancel', () => { down = null; });

    // a word is typed
    els.say.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    els.word.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (e.isComposing || e.keyCode === 229) return;      // the IME is still putting a syllable together
        e.preventDefault();
        submit();
      }
    });
    els.word.addEventListener('input', () => {
      const g = L.graphemes(els.word.value);
      const last = g.length ? g[g.length - 1] : '';
      if (last && last !== lastChar && !/^\s+$/.test(last) && D.Sound) D.Sound.note(last);
      lastChar = last;
      idle = 0;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!els.help.hidden) closeHelp();
        else if (document.activeElement === els.word) els.word.blur();
        return;
      }
      if (D.state !== 'night' || !els.help.hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target;
      const inField = tgt === els.word;
      const onControl = !!tgt && tgt !== els.word && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(tgt.tagName || '');
      const empty = !els.word.value;
      if (e.key && e.key.indexOf('Arrow') === 0 && (!inField || empty)) {
        const stp = e.shiftKey ? 0.16 : 0.07;
        if (e.key === 'ArrowLeft') Wd.nudgePointer(-stp / Wd.cam.aspect * 1.4, 0);
        else if (e.key === 'ArrowRight') Wd.nudgePointer(stp / Wd.cam.aspect * 1.4, 0);
        else if (e.key === 'ArrowUp') Wd.nudgePointer(0, stp);
        else if (e.key === 'ArrowDown') Wd.nudgePointer(0, -stp);
        e.preventDefault();
        return;
      }
      if ((e.key === ' ' || e.code === 'Space') && ((inField && empty) || (!inField && !onControl))) {
        touchAt(Wd.ptr.tx, Wd.ptr.ty);
        e.preventDefault();
        return;
      }
      if (!inField && !onControl && !els.word.disabled && ((e.key && e.key.length === 1) || e.key === 'Process' || e.keyCode === 229)) {
        els.word.focus();
      }
    });

    els.btnSound.addEventListener('click', () => { if (D.Sound) D.Sound.toggle(); });
    els.btnHelp.addEventListener('click', () => { if (els.help.hidden) openHelp(); else closeHelp(); });
    els.helpClose.addEventListener('click', closeHelp);
    els.help.addEventListener('click', (e) => { if (e.target === els.help) closeHelp(); });
    els.calm.addEventListener('change', () => D.setReduced(els.calm.checked, true));

    els.wake.addEventListener('click', () => {
      if (D.state !== 'night') return;
      if (els.wake.classList.contains('sure')) {
        clearTimeout(wakeArm);
        els.wake.classList.remove('sure');
        D.Flow.wake();
      } else {
        els.wake.classList.add('sure');
        clearTimeout(wakeArm);
        wakeArm = setTimeout(() => els.wake.classList.remove('sure'), 4500);
      }
    });

    if (inArtifact) {
      window.claude.use('downloads').then((ns) => { saver = ns || null; saverAsked = true; refreshSave(); },
        () => { saverAsked = true; refreshSave(); });
    }
    els.ltSave.addEventListener('click', () => {
      if (!cardURL) return;
      if (saver && cardBlob) {
        // the viewer is shown a confirmation by the platform and may say no
        els.ltSave.disabled = true;
        saver.save({ filename: 'a-sea-of-words.jpg', data: cardBlob }).then(() => {
          status('그림을 저장했어요', 'the picture was saved');
        }, (err) => {
          const code = err && err.code;
          if (code === 'declined') status('저장하지 않았어요', 'not saved');
          else if (code === 'rate_limited') status('잠시 뒤에 다시 눌러 주세요', 'please try again in a moment');
          else { saver = null; refreshSave(); status('여기서는 그림을 저장할 수 없어요', 'saving is not available here'); }
        }).then(() => { els.ltSave.disabled = false; });
        return;
      }
      const a = document.createElement('a');
      a.href = cardURL;
      a.download = 'a-sea-of-words.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      status('그림 저장을 시작했어요', 'the picture is being saved');
    });
    els.ltLink.addEventListener('click', () => {
      const hash = D.hashFor(letterWords);
      try { history.replaceState(null, '', hash); } catch (e) { D.ownHash = true; location.hash = hash; }
      copyText(location.href).then((ok) => {
        if (ok) status('주소를 복사했어요. 이 주소로 열면 이 밤의 말들이 다시 떠올라요', 'link copied — opening it calls this night’s words back');
        else status('주소창의 주소를 복사해 두세요', 'copy the address from the address bar');
      });
    });
    els.ltAgain.addEventListener('click', () => {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* file pages may refuse; harmless */ }
      D.kept = [];
      D.Flow.again();
    });

    // keep the word field above an on-screen keyboard
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const fix = () => {
        const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        els.bottom.style.transform = off > 1 ? 'translateY(' + -off + 'px)' : '';
      };
      vv.addEventListener('resize', fix);
      vv.addEventListener('scroll', fix);
    }
  };
})();
