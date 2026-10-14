/* Level drawer (the zoomed-in view of one Claim B level), the image lightbox,
   and a text card for illustrative items that have no image. */
(function () {
  'use strict';
  const C = window.CRG;
  const { D, h, s, levels, levelInfo, levelOf, prob, pct, linear } = C;

  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  let renderedKey = null;
  let lastFocus = null;

  scrim.addEventListener('click', () => C.set({ level: null }));

  // ---- horizontal scale strip -------------------------------------------------
  function strip(k, marker) {
    const W = 560, H = 78, pad = 14;
    const [lo, hi] = C.Y_DOMAIN;
    const x = linear(lo, hi, pad, W - pad);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block', overflow: 'visible' }, role: 'img',
      'aria-label': `Level ${k} spans scale scores ${levelInfo(k).threshold} to ${k < levels.length ? levels[k].threshold - 1 : 'the top of the scale'}.` });
    const by = 30, bh = 16;
    for (let j = 1; j <= levels.length; j++) {
      const [a, b] = C.levelSpan(j, lo, hi);
      svg.appendChild(s('rect', { class: `fill-lv${j}`, x: x(a) + 1, y: by, width: Math.max(0, x(b) - x(a) - 2), height: bh, rx: 2, style: { opacity: j === k ? 1 : .22 } }));
      svg.appendChild(s('text', { x: x(a), y: by + bh + 15, 'text-anchor': 'middle', style: { fontSize: '11px', fill: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }, text: levelInfo(j).threshold }));
    }
    levelInfo(k).exemplars.forEach(ex => {
      const xx = x(C.clamp(ex.location, lo, hi));
      svg.appendChild(s('line', { x1: xx, x2: xx, y1: by - 4, y2: by + bh + 2, style: { stroke: 'var(--ink)', strokeWidth: 1.5 } }));
      svg.appendChild(s('text', { x: xx, y: by - 8, 'text-anchor': 'middle', style: { fontSize: '11px', fontWeight: 700, fill: 'var(--ink)' }, text: ex.tier[0] }));
    });
    if (marker) {
      const xx = x(C.clamp(marker.score, lo, hi));
      svg.appendChild(s('path', { d: `M${xx},${by + bh + 20} l6,9 h-12 z`, style: { fill: 'var(--gold)', stroke: 'var(--gold-dark)', strokeWidth: 1 } }));
      svg.appendChild(s('text', { x: xx, y: H + 8, 'text-anchor': xx > W - 90 ? 'end' : xx < 90 ? 'start' : 'middle', style: { fontSize: '12px', fontWeight: 700, fill: 'var(--gold-ink)' }, text: `${marker.label} ${marker.score}` }));
    }
    return svg;
  }

  function list(title, arr) {
    if (!arr || !arr.length) return null;
    return [h('h3', null, title), h('ul', null, arr.map(t => h('li', null, t)))];
  }

  function context(k) {
    const st8 = C.state;
    const L = levelInfo(k);
    const cur = C.occasions[C.CUR];
    if (st8.view === 'student' || st8.view === 'task') {
      const x = C.studentById[st8.studentId];
      const ti = st8.view === 'task' ? C.CUR : Math.max(st8.from, st8.to);
      const sc = x.scores[ti], kk = levelOf(sc);
      const nm = st8.anon ? `Student ${x.num}` : x.first;
      const where = kk === k ? 'is in this level’s range' : kk > k ? 'is above this level’s range' : 'is below this level’s range';
      return {
        marker: { score: sc, label: nm },
        box: h('div', { class: 'context-box' },
          `${nm}’s ${C.occasions[ti].label} score (${sc}) ${where}. Chance of answering a typical Level ${k} item correctly: `,
          h('b', null, pct(prob(sc, L.threshold))), '.'),
        student: { sc, nm }
      };
    }
    if (st8.view === 'class') {
      const cls = C.classById[st8.classId];
      const members = cls.students.filter(v => levelOf(v.scores[C.CUR]) === k);
      return {
        box: h('div', { class: 'context-box' },
          members.length
            ? [`In ${cls.name}, ${members.length} student${members.length > 1 ? 's are' : ' is'} at this level in ${cur.label}: `, members.map(C.dname).join(', '), '.']
            : `No students in ${cls.name} are at this level in ${cur.label}.`)
      };
    }
    return {};
  }

  function exCard(ex, L, ctx) {
    const visual = ex.img
      ? h('button', { class: 'thumb', type: 'button', 'aria-label': `Enlarge: ${ex.title}`, onclick: () => C.openExemplar(ex, L) },
          h('img', { src: `assets/img/${ex.img}`, alt: `${ex.title}, page from ${ex.source}`, loading: 'lazy', decoding: 'async' }))
      : h('div', { class: 'text-card' }, h('span', { class: 'src' }, 'Illustrative item'), ex.text);
    return h('div', { class: 'ex-card' },
      visual,
      h('div', { class: 'tier' }, ex.tier),
      h('div', { class: 'loc' }, `${ex.source} · ${ex.targets} · location ≈ ${Math.round(ex.location)}`),
      h('div', { class: 'claim' }, h('b', null, ex.title), ex.img ? `. ${ex.text}` : null),
      ctx.student ? h('div', { class: 'pr' }, `${ctx.student.nm}: ${pct(prob(ctx.student.sc, ex.location))} chance`) : null);
  }

  function render(k) {
    const L = levelInfo(k);
    const ctx = context(k);
    const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': 'Close level', onclick: () => C.set({ level: null }) }, '✕');
    const head = h('div', { class: 'drawer-head' },
      h('div', null,
        h('div', { class: 'kicker' }, `Claim B · Level ${k} of ${levels.length}`),
        h('h2', { id: 'drawer-title' }, L.label),
        h('div', { class: 'formal' }, `Scale scores ${L.threshold}${k < levels.length ? `–${levels[k].threshold - 1}` : ' and above'} (assumed link to the Smarter Balanced scale)`)),
      closeBtn);

    const tkeys = ['B1', 'B2', 'B3', 'B4'];
    const body = h('div', { class: 'drawer-body' },
      h('p', { class: 'summary' }, L.summary),
      h('div', { style: { margin: '1rem 0 .4rem' } }, strip(k, ctx.marker)),
      h('p', { class: 'note', style: { margin: 0 } }, 'E, A and C mark the easy, average and challenge exemplars below.'),
      ctx.box || null,
      list('Students at this level can', L.understands),
      list('They may not yet', L.not_yet),
      list('Preconceptions to listen for', L.errors),
      h('h3', null, 'Within each Claim B target'),
      h('div', { class: 'tbl-wrap', style: { marginTop: 0 } }, h('table', { class: 'data indicator-table', style: { minWidth: 0 } },
        h('tbody', null, tkeys.map(t => h('tr', null,
          h('td', { style: { minWidth: '7rem', whiteSpace: 'normal' } }, h('b', null, t), h('div', { class: 'note' }, D.targets[t])),
          h('td', null, L.indicators[t])))))),
      h('h3', null, 'Exemplars'),
      h('div', { class: 'ex-grid' }, L.exemplars.map(ex => exCard(ex, L, ctx))),
      h('p', { class: 'note' }, 'Exemplar locations are the 25th, 50th and 75th percentiles of the hypothetical item locations for this level. Pages come from the Project Signal worked example (Appendix B).'),
      h('h3', null, 'Instructional next step'),
      h('div', { class: 'example' }, L.next_step));

    const foot = h('div', { class: 'drawer-foot' },
      h('button', { class: 'btn btn-sm btn-quiet', type: 'button', disabled: k <= 1, onclick: () => C.set({ level: k - 1 }) }, k > 1 ? `← ${levelInfo(k - 1).short}` : '←'),
      h('button', { class: 'btn btn-sm btn-quiet', type: 'button', disabled: k >= levels.length, onclick: () => C.set({ level: k + 1 }) }, k < levels.length ? `${levelInfo(k + 1).short} →` : '→'));

    C.clear(drawer);
    drawer.appendChild(head);
    drawer.appendChild(body);
    drawer.appendChild(foot);
    return closeBtn;
  }

  function sync() {
    const st8 = C.state;
    const k = st8.level;
    if (!k) {
      if (drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        scrim.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.inert = true;
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      }
      renderedKey = null;
      return;
    }
    const key = [k, st8.view, st8.studentId, st8.classId, st8.from, st8.to, st8.anon].join('|');
    const wasOpen = drawer.classList.contains('open');
    if (key !== renderedKey) {
      const scroll = drawer.querySelector('.drawer-body');
      const keepScroll = scroll && renderedKey && renderedKey.split('|')[0] === String(k) ? scroll.scrollTop : 0;
      const closeBtn = render(k);
      renderedKey = key;
      const nb = drawer.querySelector('.drawer-body');
      if (nb) nb.scrollTop = keepScroll;
      if (!wasOpen) {
        lastFocus = document.activeElement;
        requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
      }
    }
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('open');
    scrim.classList.add('open');
  }

  // ---- lightbox (images) and text box (illustrative items) ---------------------
  const lb = document.getElementById('lightbox');
  let lbFocus = null;
  function openBox(content) {
    lbFocus = document.activeElement;
    C.clear(lb);
    const close = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': 'Close', onclick: closeLightbox }, '✕');
    lb.appendChild(close);
    lb.appendChild(content);
    lb.classList.add('open');
    close.focus();
  }
  function lightbox(src, caption) {
    openBox(h('figure', null, h('img', { src, alt: caption }), h('figcaption', null, caption)));
  }
  function textbox(title, text, meta) {
    openBox(h('figure', { style: { background: 'var(--bg)', borderRadius: '4px', padding: '1.2rem 1.4rem', maxWidth: '560px' } },
      h('div', { class: 'kicker' }, meta),
      h('h3', { style: { fontFamily: 'var(--serif)', margin: '.3rem 0 .5rem' } }, title),
      h('p', { style: { margin: 0, fontSize: '17px' } }, text)));
  }
  function closeLightbox() {
    lb.classList.remove('open');
    C.clear(lb);
    if (lbFocus && document.contains(lbFocus)) lbFocus.focus({ preventScroll: true });
  }
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  C.drawer = { sync, isOpen: () => drawer.classList.contains('open') };
  C.lightbox = lightbox;
  C.textbox = textbox;
  C.closeLightbox = closeLightbox;
  C.lightboxOpen = () => lb.classList.contains('open');
})();
