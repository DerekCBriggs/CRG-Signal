/* Core helpers and derived data. Everything hangs off window.CRG. */
(function () {
  'use strict';

  const D = window.CRG_DATA;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---- levels ---------------------------------------------------------------
  const levels = D.levels;                         // level ids 1..4
  // R may serialize a one-item list as a bare string; normalize to arrays.
  levels.forEach(L => ['understands', 'able_to', 'not_yet', 'errors'].forEach(f => {
    if (!Array.isArray(L[f])) L[f] = L[f] ? [L[f]] : [];
  }));
  const thresholds = levels.map(l => l.threshold); // entry thresholds (median item difficulty)

  /** Level of a score: the highest level whose threshold the score meets (0 = below Level 1). */
  function levelOf(score) {
    let k = 0;
    for (const t of thresholds) if (score >= t) k++;
    return k;
  }
  function levelInfo(k) { return k === 0 ? D.below : levels[k - 1]; }
  function levelName(k) { return levelInfo(k).label; }
  /** Scale-score span [lo, hi) of level k, clipped to [min, max]. */
  function levelSpan(k, min, max) {
    const lo = k === 0 ? min : thresholds[k - 1];
    const hi = k < levels.length ? thresholds[k] : max;
    return [Math.max(lo, min), Math.min(hi, max)];
  }
  /** Rasch probability of a correct response, both locations on the scale-score metric. */
  function prob(score, location) {
    return 1 / (1 + Math.exp(-(score - location) / D.scale.slope));
  }
  /** One standard error of the difference between two scores, √2 × SEM, matching the ±1 SEM threshold bands. */
  const DIFF_MOE = Math.round(Math.SQRT2 * D.scale.sem);

  // ---- occasions, classes, students -----------------------------------------
  const occasions = D.occasions;
  const CUR = D.current;               // index of the current occasion (Grade 5, Project Signal)
  const occIndex = {};
  occasions.forEach((o, i) => { occIndex[o.id] = i; });
  function occPhrase(i) {
    const o = occasions[i];
    return `${o.season.toLowerCase()} of Grade ${o.grade}`;
  }

  /** "fall and spring of Grade 4" or "fall of Grade 3 and spring of Grade 4". */
  function spanPhrase(i, j) {
    const a = occasions[i], b = occasions[j];
    return a.grade === b.grade
      ? `${a.season.toLowerCase()} and ${b.season.toLowerCase()} of Grade ${a.grade}`
      : `${occPhrase(i)} and ${occPhrase(j)}`;
  }

  const classes = D.classes;
  const classById = {};
  const students = [];
  const studentById = {};
  classes.forEach(c => {
    classById[c.id] = c;
    c.students.forEach((s, i) => {
      s.num = i + 1;
      s.classId = c.id;
      s.className = c.name;
      s.first = s.name.split(' ')[0];
      // Levels are recomputed from thresholds so a threshold edit propagates.
      s.lv = s.scores.map(levelOf);
      students.push(s);
      studentById[s.id] = s;
    });
  });

  // ---- DOM builders -----------------------------------------------------------
  function setAttrs(el, attrs, isSvg) {
    if (!attrs) return;
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'selected')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  /** HTML element. Text children are inserted as text nodes, never parsed as HTML. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    setAttrs(el, attrs, false);
    return add(el, kids);
  }
  /** SVG element. */
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    setAttrs(el, attrs, true);
    return add(el, kids);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ---- scales -----------------------------------------------------------------
  function linear(d0, d1, r0, r1) {
    const k = (r1 - r0) / (d1 - d0);
    const f = v => r0 + (v - d0) * k;
    f.invert = p => d0 + (p - r0) / k;
    f.domain = [d0, d1];
    return f;
  }
  function ticks(lo, hi, step) {
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
    return out;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- animation --------------------------------------------------------------
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /**
   * Tween numeric SVG attributes. Keys 'tx'/'ty' drive a translate() transform.
   * Works on any attribute in any browser (CSS transitions on SVG geometry do not).
   */
  function tween(el, attrs, dur) {
    dur = dur == null ? 480 : dur;
    if (el._raf) cancelAnimationFrame(el._raf);
    const from = {};
    for (const k in attrs) {
      from[k] = k === 'tx' ? (el._tx || 0) : k === 'ty' ? (el._ty || 0) : parseFloat(el.getAttribute(k));
    }
    const apply = e => {
      let moved = false;
      for (const k in attrs) {
        const a = isNaN(from[k]) ? attrs[k] : from[k];
        const v = a + (attrs[k] - a) * e;
        if (k === 'tx') { el._tx = v; moved = true; }
        else if (k === 'ty') { el._ty = v; moved = true; }
        else el.setAttribute(k, v);
      }
      if (moved) el.setAttribute('transform', `translate(${el._tx || 0},${el._ty || 0})`);
    };
    if (reduceMotion || dur === 0) { apply(1); return; }
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      apply(ease(t));
      el._raf = t < 1 ? requestAnimationFrame(step) : null;
    };
    el._raf = requestAnimationFrame(step);
  }

  // ---- tooltip ----------------------------------------------------------------
  let tipEl = null;
  function tip() { return tipEl || (tipEl = document.getElementById('tooltip')); }
  function showTip(content, x, y) {
    const t = tip();
    clear(t);
    add(t, [content]);
    t.classList.add('show');
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    t.style.left = Math.max(8, left) + 'px';
    t.style.top = Math.max(8, top) + 'px';
  }
  function showTipAt(content, el) {
    const r = el.getBoundingClientRect();
    showTip(content, r.left + r.width / 2, r.top + r.height / 2);
  }
  function hideTip() { const t = tip(); if (t) t.classList.remove('show'); }
  function ttRow(k, v, color) {
    return h('div', { class: 'tt-row' },
      h('span', { class: 'k' }, color ? h('i', { style: { background: color } }) : null, k),
      h('span', { class: 'v' }, v));
  }

  // ---- formatting -------------------------------------------------------------
  const MINUS = '−';
  function signed(d) { return d > 0 ? `+${d}` : d < 0 ? `${MINUS}${Math.abs(d)}` : '0'; }
  function pct(p) { return `${Math.round(p * 100)}%`; }
  function levelColor(k) { return `var(--lv${k})`; }
  function swatch(k) { return h('span', { class: 'swatch', style: { background: levelColor(k) } }); }
  function levelTag(k) {
    return h('span', { class: 'lvtag' }, swatch(k), k === 0 ? D.below.label : `${k} · ${levelName(k)}`);
  }

  window.CRG = {
    D, levels, thresholds, levelOf, levelInfo, levelName, levelSpan, prob, DIFF_MOE,
    occasions, occIndex, occPhrase, spanPhrase, CUR,
    classes, classById, students, studentById,
    h, s, add, clear, linear, ticks, clamp, tween, reduceMotion,
    showTip, showTipAt, hideTip, ttRow,
    signed, pct, levelColor, swatch, levelTag, MINUS,
    // The artifact preview frame blocks window.print(), so print controls are hidden there.
    canPrint: window.CRG_ENV !== 'artifact'
  };
})();
