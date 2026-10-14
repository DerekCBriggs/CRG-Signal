/* Charts: a shared scale frame with LP bands and ladder, plus the class,
   student, flow, and item-evidence charts. Plain SVG, no dependencies. */
(function () {
  'use strict';
  const C = window.CRG;
  const { D, h, s, linear, ticks, clamp, tween, thresholds, levelOf, levelName, levelSpan, occasions } = C;

  // One y-domain for class and student charts so switching views never rescales.
  const allScores = C.students.flatMap(st => st.scores);
  const Y_DOMAIN = [
    Math.min(D.scale.min, Math.floor((Math.min(...allScores) - 8) / D.scale.tick) * D.scale.tick),
    Math.max(D.scale.max, Math.ceil((Math.max(...allScores) + 8) / D.scale.tick) * D.scale.tick)
  ];
  C.Y_DOMAIN = Y_DOMAIN;

  const SHORT = {};
  C.levels.forEach(L => { SHORT[L.id] = L.short; });

  // ---- shared frame ----------------------------------------------------------
  /**
   * Draws gridlines, y ticks, LP bands, threshold lines and the level ladder.
   * Returns the y scale, plot bounds, and layer groups for the caller's marks.
   */
  function frame(svg, o) {
    const { W, H, m } = o;
    const x0 = m.l, x1 = W - m.r, y0 = m.t, y1 = H - m.b;
    const y = linear(o.yMin, o.yMax, y1, y0);
    const g = {
      grid: s('g', { class: 'axis' }), bands: s('g'), zones: s('g'), under: s('g'), thr: s('g'),
      data: s('g'), ladder: s('g', { class: 'ladder' }), over: s('g')
    };
    for (const t of ticks(o.yMin, o.yMax, o.tick || D.scale.tick)) {
      g.grid.appendChild(s('line', { class: 'gridline', x1: x0, x2: x1, y1: y(t), y2: y(t) }));
      g.grid.appendChild(s('text', { x: x0 - 8, y: y(t), dy: '0.32em', 'text-anchor': 'end', text: t }));
    }
    g.grid.appendChild(s('text', { class: 'axis-title', x: 0, y: y0 - 14, text: o.yTitle || D.scale.title }));

    const bandEls = {};
    for (let k = 1; k <= C.levels.length; k++) {
      const [lo, hi] = levelSpan(k, o.yMin, o.yMax);
      if (hi <= lo) continue;
      bandEls[k] = s('rect', { class: `band lv${k}`, x: x0, width: x1 - x0, y: y(hi), height: y(lo) - y(hi) });
      g.bands.appendChild(bandEls[k]);
      const t = thresholds[k - 1];
      if (t > o.yMin && t < o.yMax) {
        g.thr.appendChild(s('line', { class: `threshold stroke-lv${k}`, x1: x0, x2: x1, y1: y(t), y2: y(t) }));
        // Scores inside this band are within one standard error of the threshold.
        const e = D.scale.sem;
        g.zones.appendChild(s('rect', { class: 'sem-zone', x: x0, width: x1 - x0, y: y(t + e), height: y(t - e) - y(t + e) }));
      }
    }
    const setHot = k => { for (const key in bandEls) bandEls[key].classList.toggle('hot', +key === k); };
    // Quiet mode: level regions stay unshaded until a level is hovered or selected.
    if (o.quietBands) svg.classList.add('bands-quiet');
    const setSel = k => { for (const key in bandEls) bandEls[key].classList.toggle('sel', +key === k); };

    if (o.ladder !== false) drawLadder(g.ladder, y, x1 + 14, o, setHot);
    Object.values(g).forEach(el => svg.appendChild(el));
    return { y, x0, x1, y0, y1, g, setHot, setSel };
  }

  function drawLadder(g, y, lx, o, setHot) {
    const narrow = o.narrow;
    for (let k = 0; k <= C.levels.length; k++) {
      const [lo, hi] = levelSpan(k, o.yMin, o.yMax);
      if (hi <= lo) continue;
      const top = y(hi), bot = y(lo), mid = (top + bot) / 2, ht = bot - top;
      const rung = s('g', { class: k === 0 ? 'rung-0 muted' : 'rung' });
      rung.appendChild(s('rect', { class: 'rung-bg', x: lx - 4, y: top, width: o.ladderW, height: ht, rx: 3 }));
      rung.appendChild(s('rect', { class: `fill-lv${k}`, x: lx, y: top + 1, width: 6, height: Math.max(0, ht - 2), rx: 1 }));
      const tx = lx + 14;
      if (k === 0) {
        const cy = clamp(mid, top + 12, bot - 12);
        rung.appendChild(s('text', { x: tx, y: cy + 4, text: D.below.label }));
      } else {
        const info = C.levelInfo(k);
        const name = SHORT[k];
        const numText = narrow ? `L${k} · ${info.threshold}+` : `LEVEL ${k} · ${info.threshold}+`;
        if (ht >= 30) {
          rung.appendChild(s('text', { class: 'lvnum', x: tx, y: mid - 5, text: numText }));
          rung.appendChild(s('text', { class: 'lvname', x: tx, y: mid + 11, text: name, style: narrow ? { fontSize: '12px' } : null }));
          if (!narrow && ht >= 58) rung.appendChild(s('text', { class: 'lvhint', x: tx, y: mid + 27, text: 'Open level →' }));
        } else {
          rung.appendChild(s('text', { class: 'lvname', x: tx, y: mid + 4, text: `${k} · ${name}`, style: { fontSize: narrow ? '11.5px' : '13px' } }));
        }
        rung.setAttribute('tabindex', '0');
        rung.setAttribute('role', 'button');
        rung.setAttribute('aria-label', `Open level ${k}, ${info.label}, scale scores ${info.threshold} and above`);
        rung.addEventListener('pointerenter', () => setHot(k));
        rung.addEventListener('pointerleave', () => setHot(null));
        rung.addEventListener('focus', () => setHot(k));
        rung.addEventListener('blur', () => setHot(null));
        rung.addEventListener('click', () => o.onLevel && o.onLevel(k));
        rung.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onLevel && o.onLevel(k); } });
      }
      g.appendChild(rung);
    }
  }

  function onLevelBand(parent, y, xa, xb, range, label) {
    const g = s('g', { class: 'onlevel' });
    g.appendChild(s('rect', { class: 'onlevel-fill', x: xa, width: xb - xa, y: y(range.hi), height: y(range.lo) - y(range.hi) }));
    g.appendChild(s('line', { class: 'onlevel-line', x1: xa, x2: xb, y1: y(range.hi), y2: y(range.hi) }));
    g.appendChild(s('line', { class: 'onlevel-line', x1: xa, x2: xb, y1: y(range.lo), y2: y(range.lo) }));
    if (label) g.appendChild(s('text', { class: 'onlevel-label', x: xa + 6, y: y(range.hi) - 5, text: label }));
    parent.appendChild(g);
    return g;
  }

  function svgRoot(W, H, label) {
    return s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'group', 'aria-label': label });
  }
  function sizeFor(container) {
    const W = Math.max(300, Math.round(container.clientWidth || 800));
    const narrow = W < 640;
    return { W, narrow, ladderW: narrow ? 92 : 150 };
  }

  // ---- class chart -----------------------------------------------------------
  function ClassChart(container, opts) {
    const cls = opts.cls;
    const studs = cls.students;
    const { W, narrow, ladderW } = sizeFor(container);
    const H = narrow ? 400 : 480;
    const m = { t: 34, r: ladderW + 18, b: 42, l: 44 };
    const svg = svgRoot(W, H, `${cls.name}: scale scores for ${studs.length} students against the fractions learning progression levels.`);
    const F = frame(svg, { W, H, m, yMin: Y_DOMAIN[0], yMax: Y_DOMAIN[1], ladderW, narrow, onLevel: opts.onLevel, quietBands: true });
    const { y, x0, x1, y0, y1 } = F;
    const colW = (x1 - x0) / studs.length;
    const cur = C.CUR;

    const cut = D.sbac.cuts.find(r => r.grade === occasions[cur].grade);
    const ol = onLevelBand(F.g.under, y, x0, x1, { lo: cut.l3, hi: cut.l4 },
      `Smarter Balanced Level 3 (Standard Met), Grade ${cut.grade}: ${cut.l3}–${cut.l4 - 1}`);
    ol.style.transition = 'opacity .3s';

    const nodes = studs.map((st, i) => {
      const g = s('g', { class: 'stu', tabindex: 0, role: 'button' });
      const hit = s('rect', { class: 'hit', x: -colW / 2 + 1, width: colW - 2, y: y0 - 6, height: (y1 - y0) + m.b, rx: 3 });
      const stem = s('line', { class: 'stem', x1: 0, x2: 0 });
      const dCmp = s('circle', { class: 'dot-open', r: narrow ? 3.2 : 4.5, cx: 0 });
      const dCur = s('circle', { class: 'dot', r: narrow ? 4 : 5.5, cx: 0 });
      const lab = narrow
        ? s('text', { class: 'xlab', x: 0, y: y1 + 8, dy: '0.32em', transform: `rotate(-90 0 ${y1 + 8})`, style: { fontSize: '9.5px', textAnchor: 'end' } })
        : s('text', { class: 'xlab', x: 0, y: y1 + 18 });
      [hit, stem, dCmp, dCur, lab].forEach(el => g.appendChild(el));
      F.g.data.appendChild(g);
      const node = { st, i, g, stem, dCmp, dCur, lab };
      g.addEventListener('pointerenter', e => { F.setHot(null); opts.onHover && opts.onHover(node, e); });
      g.addEventListener('pointermove', e => opts.onHover && opts.onHover(node, e));
      g.addEventListener('pointerleave', () => C.hideTip());
      g.addEventListener('focus', () => opts.onHover && opts.onHover(node, null));
      g.addEventListener('blur', () => C.hideTip());
      g.addEventListener('click', () => opts.onOpen(st.id));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onOpen(st.id); } });
      return node;
    });

    let first = true;
    function update(st8) {
      const dur = first ? 0 : 520;
      first = false;
      svg.classList.toggle('bands-off', !!st8.bandsOff);
      ol.style.opacity = st8.showOnLevel ? 1 : 0;
      svg.classList.toggle('sem-on', !!st8.showSEM);
      const hk = st8.highlight && /^now:(\d)$/.exec(st8.highlight.key);
      F.setSel(st8.level || (hk ? +hk[1] : null));
      const cmp = st8.compare === 'none' ? null : C.occIndex[st8.compare];
      const growthRef = cmp == null ? C.occIndex[D.compare_default] : cmp;
      const order = studs.map((st, i) => i);
      const key = i => {
        const sc = studs[i].scores;
        if (st8.sort === 'growth') return sc[cur] - sc[growthRef];
        if (st8.sort === 'name') return st8.anon ? i : studs[i].name;
        return sc[cur];
      };
      order.sort((a, b) => {
        const ka = key(a), kb = key(b);
        if (ka < kb) return -1; if (ka > kb) return 1;
        return studs[a].scores[cur] - studs[b].scores[cur] || a - b;
      });
      const hl = st8.highlight ? new Set(st8.highlight.ids) : null;
      order.forEach((idx, pos) => {
        const n = nodes[idx];
        const sc = n.st.scores;
        const yc = y(sc[cur]);
        const yp = cmp == null ? yc : y(sc[cmp]);
        tween(n.g, { tx: x0 + (pos + .5) * colW, ty: 0 }, dur);
        tween(n.dCur, { cy: yc }, dur);
        tween(n.dCmp, { cy: yp }, dur);
        tween(n.stem, { y1: yp, y2: yc }, dur);
        n.dCmp.style.opacity = cmp == null ? 0 : 1;
        n.stem.style.opacity = cmp == null ? 0 : 1;
        // With uncertainty on, a change within measurement error gets a dashed stem.
        n.stem.classList.toggle('within', !!st8.showSEM && cmp != null && Math.abs(sc[cur] - sc[cmp]) <= C.DIFF_MOE);
        n.lab.textContent = st8.anon ? String(idx + 1) : n.st.initials;
        n.g.setAttribute('aria-label', `${st8.anon ? 'Student ' + (idx + 1) : n.st.name}: ${sc[cur]} in ${occasions[cur].label}, ${C.levelInfo(levelOf(sc[cur])).label}. Press Enter for the full trajectory.`);
        n.g.classList.toggle('faded', !!hl && !hl.has(n.st.id));
        n.g.classList.toggle('hl', !!hl && hl.has(n.st.id));
      });
    }

    C.clear(container).appendChild(svg);
    return { update, svg, key: `${cls.id}:${W}` };
  }

  // ---- student chart ---------------------------------------------------------
  function StudentChart(container, opts) {
    const { W, narrow, ladderW } = sizeFor(container);
    const H = narrow ? 380 : 440;
    const m = { t: 34, r: ladderW + 18, b: 56, l: 44 };
    const svg = svgRoot(W, H, 'Scale scores across three spring test occasions, against the Claim B learning progression levels.');
    const F = frame(svg, { W, H, m, yMin: Y_DOMAIN[0], yMax: Y_DOMAIN[1], ladderW, narrow, onLevel: opts.onLevel, quietBands: true });
    const { y, x0, x1, y0, y1 } = F;
    const n = occasions.length;
    const step = (x1 - x0) / n;
    const xs = i => x0 + (i + .5) * step;
    const sem = D.scale.sem;

    // x axis: grade and test for each occasion, and a divider where the test changes
    const ax = s('g', { class: 'axis' });
    occasions.forEach((o, i) => {
      ax.appendChild(s('text', { class: 'grade-label', x: xs(i), y: y1 + 20, 'text-anchor': 'middle', text: o.label }));
      ax.appendChild(s('text', { class: 'occ-test', x: xs(i), y: y1 + 37, 'text-anchor': 'middle', text: narrow ? o.test.replace('Smarter Balanced', 'SBAC').replace('Project ', '') : o.test }));
    });
    F.g.grid.appendChild(ax);
    const change = occasions.findIndex((o, i) => i > 0 && o.test !== occasions[i - 1].test);
    if (change > 0) {
      const xl = x0 + change * step;
      F.g.over.appendChild(s('line', { class: 'link-divider', x1: xl, x2: xl, y1: y0, y2: y1 }));
      F.g.over.appendChild(s('text', { class: 'link-label', x: xl + 6, y: y0 + 14, text: narrow ? 'Assumed link' : 'Assumed link to the Smarter Balanced scale' }));
    }

    const olG = s('g');
    olG.style.transition = 'opacity .3s';
    occasions.forEach((o, i) => {
      const cut = D.sbac.cuts.find(r => r.grade === o.grade);
      if (cut) onLevelBand(olG, y, xs(i) - step / 2 + 4, xs(i) + step / 2 - 4, { lo: cut.l3, hi: cut.l4 },
        narrow ? `Level 3` : `Grade ${o.grade} Standard Met (${cut.l3}+)`);
    });
    F.g.under.appendChild(olG);

    const cross = s('line', { class: 'crosshair', y1: y0, y2: y1, style: { opacity: 0 } });
    F.g.under.appendChild(cross);
    const segs = occasions.slice(1).map((o, i) => s('line', { class: 'traj', x1: xs(i), x2: xs(i + 1) }));
    const rings = [0, 1].map(() => s('circle', { class: 'focus-ring', r: 9 }));
    const dots = occasions.map((o, i) => s('circle', { class: 'dot', r: 5, cx: xs(i) }));
    const labels = [0, 1].map(() => s('text', { class: 'value-label', 'text-anchor': 'middle' }));
    [...segs, ...rings, ...dots, ...labels].forEach(el => F.g.data.appendChild(el));

    let current = null;
    const hits = occasions.map((o, i) => {
      const r = s('rect', { x: xs(i) - step / 2, width: step, y: y0, height: y1 - y0, style: { fill: 'transparent', cursor: 'crosshair' } });
      r.addEventListener('pointerenter', e => hover(i, e));
      r.addEventListener('pointermove', e => hover(i, e));
      r.addEventListener('pointerleave', () => { cross.style.opacity = 0; C.hideTip(); });
      F.g.over.appendChild(r);
      return r;
    });
    function hover(i, e) {
      if (!current) return;
      const st = current.student, sc = st.scores[i], k = levelOf(sc);
      cross.setAttribute('x1', xs(i)); cross.setAttribute('x2', xs(i)); cross.style.opacity = 1;
      const rows = [
        h('div', { class: 'tt-title' }, `${occasions[i].season}, Grade ${occasions[i].grade}`),
        C.ttRow('Score', String(sc)),
        C.ttRow('Test', `${occasions[i].test}, ${occasions[i].measure.toLowerCase()}`),
        C.ttRow('Level', k === 0 ? D.below.label : `${k} · ${levelName(k)}`, C.levelColor(k)),
        C.ttRow('±1 SEM', `${Math.round(sc - sem)}–${Math.round(sc + sem)}`)
      ];
      if (i > 0) rows.push(C.ttRow('Since previous', C.signed(sc - st.scores[i - 1])));
      C.showTip(rows, e.clientX, e.clientY);
    }

    let first = true;
    function update(st8) {
      const dur = first ? 0 : 520;
      first = false;
      current = st8;
      svg.classList.toggle('bands-off', !!st8.bandsOff);
      olG.style.opacity = st8.showOnLevel ? 1 : 0;
      const sc = st8.student.scores;
      const ys = sc.map(y);
      dots.forEach((d, i) => tween(d, { cy: ys[i] }, dur));
      segs.forEach((l, i) => tween(l, { y1: ys[i], y2: ys[i + 1] }, dur));
      svg.classList.toggle('sem-on', !!st8.showSEM);
      F.setSel(st8.level || null);
      [st8.from, st8.to].forEach((oi, j) => {
        tween(rings[j], { cx: xs(oi), cy: ys[oi] }, dur);
        const nb = [ys[oi - 1], ys[oi + 1]].filter(v => v != null);
        const avg = nb.reduce((a, b) => a + b, 0) / (nb.length || 1);
        const above = !nb.length || avg >= ys[oi];
        labels[j].textContent = sc[oi];
        tween(labels[j], { x: xs(oi), y: above ? ys[oi] - 15 : ys[oi] + 24 }, dur);
      });
      rings[1].style.opacity = st8.from === st8.to ? 0 : 1;
      labels[1].style.opacity = st8.from === st8.to ? 0 : 1;
    }

    C.clear(container).appendChild(svg);
    return { update, svg, key: `stu:${W}` };
  }

  // ---- probability row (exemplar items) -------------------------------------
  /** A 0-100% track with the 'from' chance as an open dot and the 'to' chance filled. */
  function probTrack(p0, p1, showFrom) {
    const W = 320, H = 26, pad = 16;
    const x = linear(0, 1, pad, W - pad);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    svg.appendChild(s('line', { class: 'gridline', x1: x(0), x2: x(1), y1: 13, y2: 13 }));
    svg.appendChild(s('line', { class: 'baseline', x1: x(.5), x2: x(.5), y1: 5, y2: 21 }));
    if (showFrom) {
      svg.appendChild(s('line', { class: 'stem', x1: x(p0), x2: x(p1), y1: 13, y2: 13 }));
      svg.appendChild(s('circle', { class: 'dot-open', cx: x(p0), cy: 13, r: 4.5 }));
    }
    svg.appendChild(s('circle', { class: 'dot', cx: x(p1), cy: 13, r: 5.5 }));
    return svg;
  }
  function probAxis() {
    const W = 320, H = 22, pad = 16;
    const x = linear(0, 1, pad, W - pad);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    [0, .5, 1].forEach(v => svg.appendChild(s('text', {
      x: x(v), y: 14, 'text-anchor': v === 0 ? 'start' : v === 1 ? 'end' : 'middle',
      style: { fontSize: '11.5px', fill: 'var(--ink-3)', fontWeight: 600 }, text: `${v * 100}%`
    })));
    return svg;
  }

  // ---- flow (alluvial) chart ------------------------------------------------
  function FlowChart(container, o) {
    const W = Math.max(300, Math.round(container.clientWidth || 560));
    const narrow = W < 520;
    const H = 300;
    const labelW = narrow ? 84 : 128, nodeW = 12, gap = 7;
    const m = { t: 26, b: 6 };
    const xl = labelW, xr = W - labelW - nodeW;
    const svg = svgRoot(W, H, `Movement between learning progression levels from ${o.fromLabel} to ${o.toLabel}.`);
    const studs = o.students;
    const lv = (st, idx) => levelOf(st.scores[idx]);
    const ks = Array.from({ length: C.levels.length + 1 }, (_, i) => C.levels.length - i);
    const cnt = (idx, k) => studs.filter(st => lv(st, idx) === k).length;
    const sides = [o.fromIdx, o.toIdx].map(idx => ks.filter(k => cnt(idx, k) > 0).map(k => ({ k, n: cnt(idx, k) })));
    const maxNodes = Math.max(sides[0].length, sides[1].length);
    const unit = (H - m.t - m.b - gap * (maxNodes - 1)) / studs.length;
    sides.forEach(side => {
      const used = side.reduce((a, d) => a + d.n * unit, 0) + gap * (side.length - 1);
      let yy = m.t + (H - m.t - m.b - used) / 2;
      side.forEach(d => { d.y = yy; d.h = d.n * unit; d.off = 0; yy += d.h + gap; });
    });
    const nodeAt = (side, k) => sides[side].find(d => d.k === k);

    const flows = [];
    ks.forEach(a => ks.forEach(b => {
      const ids = studs.filter(st => lv(st, o.fromIdx) === a && lv(st, o.toIdx) === b).map(st => st.id);
      if (ids.length) flows.push({ a, b, ids, key: `${a}>${b}` });
    }));
    // Stack outgoing flows by target (high first) and incoming by source (high first) so ribbons cross as little as possible.
    flows.slice().sort((p, q) => q.a - p.a || q.b - p.b).forEach(f => {
      const nd = nodeAt(0, f.a); f.y0 = nd.y + nd.off; nd.off += f.ids.length * unit;
    });
    flows.slice().sort((p, q) => q.b - p.b || q.a - p.a).forEach(f => {
      const nd = nodeAt(1, f.b); f.y1 = nd.y + nd.off; nd.off += f.ids.length * unit;
    });

    svg.appendChild(s('text', { class: 'col-title', x: xl + nodeW, y: 14, 'text-anchor': 'end', text: o.fromLabel }));
    svg.appendChild(s('text', { class: 'col-title', x: xr, y: 14, text: o.toLabel }));

    const gFlows = s('g', { class: 'flows' + (o.selectedKey ? ' dim' : '') });
    const xa = xl + nodeW, xb = xr, xm = (xa + xb) / 2;
    flows.forEach(f => {
      const hh = f.ids.length * unit;
      const d = `M${xa},${f.y0} C${xm},${f.y0} ${xm},${f.y1} ${xb},${f.y1} L${xb},${f.y1 + hh} C${xm},${f.y1 + hh} ${xm},${f.y0 + hh} ${xa},${f.y0 + hh} Z`;
      const label = f.a === f.b
        ? `${f.ids.length} stayed at ${f.a === 0 ? D.below.label : levelName(f.a)}`
        : `${f.ids.length} moved ${f.b > f.a ? 'up' : 'down'}: ${f.a === 0 ? D.below.label : levelName(f.a)} → ${f.b === 0 ? D.below.label : levelName(f.b)}`;
      const p = s('path', { class: `flow fill-lv${f.b}` + (o.selectedKey === f.key ? ' on' : ''), d, tabindex: 0, role: 'button', 'aria-label': label });
      const names = f.ids.map(id => (o.anon ? `Student ${C.studentById[id].num}` : C.studentById[id].name));
      const tipContent = () => [h('div', { class: 'tt-title' }, label), h('div', null, names.join(', ')), h('div', { class: 'tt-foot' }, 'Click to highlight these students')];
      p.addEventListener('pointermove', e => C.showTip(tipContent(), e.clientX, e.clientY));
      p.addEventListener('pointerleave', () => C.hideTip());
      p.addEventListener('focus', () => C.showTipAt(tipContent(), p));
      p.addEventListener('blur', () => C.hideTip());
      const pick = () => o.onSelect(o.selectedKey === f.key ? null : { key: f.key, ids: f.ids, label });
      p.addEventListener('click', pick);
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      gFlows.appendChild(p);
    });
    svg.appendChild(gFlows);

    sides.forEach((side, si) => side.forEach(d => {
      const x = si === 0 ? xl : xr;
      svg.appendChild(s('rect', { class: `fill-lv${d.k}`, x, y: d.y, width: nodeW, height: Math.max(1, d.h), rx: 1 }));
      const name = d.k === 0 ? D.below.short : SHORT[d.k];
      const tx = si === 0 ? x - 8 : x + nodeW + 8;
      const anchor = si === 0 ? 'end' : 'start';
      const t = s('text', { class: 'node-label', x: tx, y: d.y + d.h / 2, dy: '0.32em', 'text-anchor': anchor, style: narrow ? { fontSize: '11.5px' } : null });
      t.appendChild(s('tspan', { text: name }));
      t.appendChild(s('tspan', { class: 'node-count', dx: 5, text: d.n }));
      svg.appendChild(t);
    }));

    C.clear(container).appendChild(svg);
  }

  // ---- item evidence (beeswarm) ---------------------------------------------
  function Beeswarm(container, o) {
    const { W, narrow, ladderW } = sizeFor(container);
    const H = narrow ? 500 : 560;
    const m = { t: 84, r: ladderW + 18, b: 50, l: 44 };
    const itemLocs = D.items.map(it => it[1]);
    const yMin = Math.min(C.Y_DOMAIN[0], Math.floor((Math.min(...itemLocs) - 10) / 50) * 50);
    const yMax = Math.max(C.Y_DOMAIN[1], Math.ceil((Math.max(...itemLocs) + 10) / 50) * 50);
    const svg = svgRoot(W, H, `Difficulty of ${D.items.length} fractions items by learning progression level.`);
    const F = frame(svg, { W, H, m, yMin, yMax, ladderW, narrow, onLevel: o.onLevel, yTitle: 'Item location (scale score)' });
    const { y, x0, x1, y0, y1 } = F;
    const nL = C.levels.length;
    const colW = (x1 - x0) / nL;
    const r = narrow ? 2.3 : 3.1;
    const cx = k => x0 + (k - .5) * colW;

    const ax = s('g', { class: 'axis' });
    C.levels.forEach(L => {
      ax.appendChild(s('text', { x: cx(L.id), y: y1 + 18, 'text-anchor': 'middle', style: { fill: 'var(--ink)', fontWeight: 600, fontSize: narrow ? '11px' : '13px' }, text: narrow ? SHORT[L.id] : `${L.id} · ${SHORT[L.id]}` }));
      ax.appendChild(s('text', { x: cx(L.id), y: y1 + 34, 'text-anchor': 'middle', text: `${L.n_items} items` }));
    });
    F.g.grid.appendChild(ax);

    // Dodge: place each dot at the smallest horizontal offset that avoids overlap.
    const dots = [];
    C.levels.forEach(L => {
      const pts = D.items.filter(it => it[0] === L.id).map(it => ({ k: L.id, v: it[1], y: y(it[1]) })).sort((a, b) => a.y - b.y);
      const placed = [];
      const dmin = 2 * r + .7;
      const maxOff = colW * .44;
      pts.forEach(p => {
        const near = placed.filter(q => Math.abs(q.y - p.y) < dmin);
        let best = 0;
        for (let i = 0; i < 400; i++) {
          const off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (r * .5);
          if (Math.abs(off) > maxOff) break;
          if (near.every(q => Math.hypot(q.dx - off, q.y - p.y) >= dmin)) { best = off; break; }
        }
        p.dx = best; placed.push(p); dots.push(p);
      });
      const bw = Math.min(colW * .8, 120);
      F.g.under.appendChild(s('rect', { class: 'iqr', x: cx(L.id) - bw / 2, width: bw, y: y(L.q75), height: y(L.q25) - y(L.q75), rx: 3 }));
    });
    const gDots = s('g');
    dots.forEach(p => {
      p.el = s('circle', { class: `item-dot fill-lv${p.k} stroke-lv${p.k}`, cx: cx(p.k) + p.dx, cy: p.y, r });
      gDots.appendChild(p.el);
    });
    F.g.data.appendChild(gDots);
    C.levels.forEach(L => {
      const bw = Math.min(colW * .8, 120);
      F.g.data.appendChild(s('line', { class: 'median-tick', x1: cx(L.id) - bw / 2, x2: cx(L.id) + bw / 2, y1: y(L.threshold), y2: y(L.threshold) }));
    });

    // Per-level expected percent correct at the slider score.
    const pctEls = C.levels.map(L => {
      const t1 = s('text', { class: 'pct-label', x: cx(L.id), y: y0 - 46 });
      const t2 = s('text', { class: 'pct-sub', x: cx(L.id), y: y0 - 31, text: narrow ? 'exp. correct' : 'expected correct' });
      F.g.over.appendChild(t1); F.g.over.appendChild(t2);
      return t1;
    });

    // Slider: a draggable horizontal line for a hypothetical student's score.
    const sl = s('g');
    const line = s('line', { class: 'slider-line', x1: x0, x2: x1 });
    const handle = s('circle', { class: 'slider-handle', cx: x0, r: 7 });
    const lab = s('text', { class: 'slider-label', x: x0 + 12 });
    sl.appendChild(line); sl.appendChild(handle); sl.appendChild(lab);
    const hit = s('rect', { class: 'slider-hit', x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
    F.g.over.appendChild(hit);
    F.g.over.appendChild(sl);

    const toScore = e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return Math.round(clamp(y.invert(p.y), yMin + 10, yMax - 10));
    };
    let dragging = false;
    hit.addEventListener('pointerdown', e => { dragging = true; hit.setPointerCapture(e.pointerId); o.onScore(toScore(e)); });
    hit.addEventListener('pointermove', e => {
      if (dragging) { o.onScore(toScore(e)); return; }
      // nearest item for the tooltip
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = null, bd = 12;
      for (const d of dots) { const dd = Math.hypot(cx(d.k) + d.dx - p.x, d.y - p.y); if (dd < bd) { bd = dd; best = d; } }
      if (best) {
        C.showTip([
          h('div', { class: 'tt-title' }, `An item at ${best.v}`),
          C.ttRow('Level', `${best.k} · ${levelName(best.k)}`, C.levelColor(best.k)),
          C.ttRow(`Chance at ${current}`, C.pct(C.prob(current, best.v)))
        ], e.clientX, e.clientY);
      } else C.hideTip();
    });
    hit.addEventListener('pointerup', () => { dragging = false; });
    hit.addEventListener('pointerleave', () => C.hideTip());

    let current = o.score;
    function update(score) {
      current = score;
      const yy = y(score);
      line.setAttribute('y1', yy); line.setAttribute('y2', yy);
      handle.setAttribute('cy', yy);
      lab.setAttribute('y', yy - 8);
      lab.textContent = `A student scoring ${score}`;
      dots.forEach(d => d.el.classList.toggle('hollow', d.v > score));
      C.levels.forEach((L, i) => {
        const its = D.items.filter(it => it[0] === L.id);
        const e = its.reduce((a, it) => a + C.prob(score, it[1]), 0) / its.length;
        pctEls[i].textContent = C.pct(e);
      });
    }
    C.clear(container).appendChild(svg);
    update(o.score);
    return { update, svg };
  }

  Object.assign(C, { frame, ClassChart, StudentChart, FlowChart, Beeswarm, probTrack, probAxis, SHORT });
})();
