/* Views: class, student, task, learning progression, evidence. Each view builds
   its DOM once in mount() and refreshes from CRG.state in update(). */
(function () {
  'use strict';
  const C = window.CRG;
  const { D, h, s, levels, levelOf, levelName, levelInfo, occasions, prob, pct, signed } = C;

  const dname = st => (C.state.anon ? `Student ${st.num}` : st.name);
  const dfirst = st => (C.state.anon ? `Student ${st.num}` : st.first);
  C.dname = dname;
  const lvl = k => (k === 0 ? 'below Level 1' : `Level ${k} (${levelName(k)})`);
  const lvlTag = k => (k === 0 ? D.below.label : `${k} · ${levelName(k)}`);
  const occShort = o => `${o.label} (${o.test === 'Project Signal' ? 'Signal' : 'SBAC'})`;
  const DIFF_MOE = C.DIFF_MOE;
  const CUR = C.CUR;

  // ---- small controls ---------------------------------------------------------
  function selectCtl(label, onChange) {
    const sel = h('select', { 'aria-label': label, onchange: e => onChange(e.target.value) });
    return { el: h('label', { class: 'control' }, h('span', { class: 'lbl' }, label), sel), sel };
  }
  function fillSelect(sel, opts, value) {
    C.clear(sel);
    const groups = {};
    opts.forEach(o => {
      const opt = h('option', { value: o.value }, o.label);
      if (o.group) {
        if (!groups[o.group]) { groups[o.group] = h('optgroup', { label: o.group }); sel.appendChild(groups[o.group]); }
        groups[o.group].appendChild(opt);
      } else sel.appendChild(opt);
    });
    sel.value = value;
  }
  function segCtl(label, opts, onChange) {
    const btns = opts.map(o => h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => onChange(o.value) }, o.label));
    btns.forEach((b, i) => { b.dataset.value = opts[i].value; });
    const el = h('div', { class: 'control' }, h('span', { class: 'lbl' }, label), h('div', { class: 'seg', role: 'group', 'aria-label': label }, btns));
    return { el, set: v => btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === v))) };
  }
  function toggleCtl(label, onChange, tour) {
    const inp = h('input', { type: 'checkbox', role: 'switch', onchange: e => onChange(e.target.checked) });
    return { el: h('label', { class: 'toggle', 'data-tour': tour || null }, inp, label), inp };
  }
  function legendKey(kind, label) {
    const svg = s('svg', { viewBox: '0 0 22 14', 'aria-hidden': 'true' });
    if (kind === 'dot') svg.appendChild(s('circle', { class: 'dot', cx: 11, cy: 7, r: 5 }));
    if (kind === 'open') svg.appendChild(s('circle', { class: 'dot-open', cx: 11, cy: 7, r: 4.3 }));
    if (kind === 'ring') svg.appendChild(s('circle', { class: 'focus-ring', cx: 11, cy: 7, r: 5.5 }));
    if (kind === 'zone') { svg.appendChild(s('rect', { class: 'sem-zone key', x: 0, y: 2, width: 22, height: 10 })); svg.appendChild(s('line', { class: 'threshold stroke-lv3', x1: 0, x2: 22, y1: 7, y2: 7 })); }
    if (kind === 'stem' || kind === 'stem-dash') {
      svg.setAttribute('viewBox', '0 0 32 14');
      svg.style.width = '32px';
      svg.appendChild(s('line', { class: kind === 'stem' ? 'stem' : 'stem within', x1: 8, x2: 24, y1: 7, y2: 7 }));
      svg.appendChild(s('circle', { class: 'dot-open', cx: 4.5, cy: 7, r: 3.5 }));
      svg.appendChild(s('circle', { class: 'dot', cx: 27.5, cy: 7, r: 4 }));
    }
    if (kind === 'onlevel') { svg.appendChild(s('rect', { class: 'onlevel-fill', x: 0, y: 2, width: 22, height: 10 })); svg.appendChild(s('line', { class: 'onlevel-line', x1: 0, x2: 22, y1: 2, y2: 2 })); svg.appendChild(s('line', { class: 'onlevel-line', x1: 0, x2: 22, y1: 12, y2: 12 })); }
    if (kind === 'line') svg.appendChild(s('line', { class: 'traj', x1: 1, x2: 21, y1: 7, y2: 7 }));
    if (kind === 'link') svg.appendChild(s('line', { class: 'link-divider', x1: 11, x2: 11, y1: 0, y2: 14 }));
    return h('span', { class: 'key' }, svg, label);
  }
  const chartWidth = box => Math.max(300, Math.round(box.clientWidth || 800));

  // Exemplar viewer: the task page image when there is one, else the item text.
  function openExemplar(ex, L) {
    const caption = `Level ${L.id} (${L.label}), ${ex.tier.toLowerCase()} exemplar · ${ex.source} · targets ${ex.targets}. ${ex.title}: ${ex.text}`;
    if (ex.img) C.lightbox(`assets/img/${ex.img}`, caption);
    else C.textbox(ex.title, ex.text, `${ex.source} item · Level ${L.id} · targets ${ex.targets}`);
  }
  C.openExemplar = openExemplar;

  // ---- narrative (student) ----------------------------------------------------
  /** Plain-language, content-referenced description of growth between two occasions. */
  function narrative(st, fi, ti, bandsOff) {
    const s0 = st.scores[fi], s1 = st.scores[ti], L0 = levelOf(s0), L1 = levelOf(s1), d = s1 - s0;
    const nm = dfirst(st);
    if (bandsOff) {
      return {
        head: d >= 0 ? `${nm}'s mathematics score rose ${d} points.` : `${nm}'s mathematics score fell ${-d} points.`,
        support: `From ${s0} in ${C.occPhrase(fi)} to ${s1} in ${C.occPhrase(ti)}.`,
        cautions: []
      };
    }
    let head;
    if (fi === ti) head = L1 === 0 ? `${nm} is working toward Level 1 (${levels[0].label}).` : `${nm} is at ${lvl(L1)}.`;
    else if (L1 > L0) head = `${nm} moved from ${lvl(L0)} to ${lvl(L1)}.`;
    else if (L1 === L0) head = L1 === 0 ? `${nm} is still working toward Level 1 (${levels[0].label}).` : `${nm} is still at ${lvl(L1)}.`;
    else head = `${nm}'s score is now in the ${lvl(L1)} range, down from ${lvl(L0)}.`;

    const parts = [];
    if (fi !== ti) parts.push(`Between ${C.spanPhrase(fi, ti)}, ${nm}'s score went from ${s0} to ${s1} (${signed(d)} points).`);
    const cur = L1 > 0 ? levelInfo(L1) : null;
    const nxt = L1 < levels.length ? levels[L1] : null;
    if (cur && nxt) parts.push(`At ${s1}, ${nm} has about a ${pct(prob(s1, cur.threshold))} chance of answering a typical Level ${L1} item correctly and a ${pct(prob(s1, nxt.threshold))} chance on a typical Level ${L1 + 1} item.`);
    else if (cur) parts.push(`At ${s1}, ${nm} has about a ${pct(prob(s1, cur.threshold))} chance of answering a typical Level ${L1} item correctly, the top level of this progression.`);
    else parts.push(`At ${s1}, ${nm} has about a ${pct(prob(s1, nxt.threshold))} chance of answering a typical Level 1 item correctly.`);

    const cautions = [];
    if (fi !== ti && occasions[fi].test !== occasions[ti].test) {
      cautions.push(`This comparison spans two tests: ${occasions[fi].test} ${occasions[fi].measure.toLowerCase()} in ${occasions[fi].label} and ${occasions[ti].test} ${occasions[ti].measure} in ${occasions[ti].label}, joined by an assumed link that is subject to change.`);
    }
    if (fi !== ti && Math.abs(d) <= DIFF_MOE) {
      cautions.push(`A change of ${Math.abs(d)} points is within one standard error of the difference between two scores (about ±${DIFF_MOE} points), so it may reflect measurement error alone.`);
    }
    let nearT = null;
    C.thresholds.forEach((t, i) => { if (Math.abs(s1 - t) < D.scale.sem && (!nearT || Math.abs(s1 - t) < Math.abs(s1 - nearT.t))) nearT = { t, k: i + 1 }; });
    if (nearT) cautions.push(`${nm}'s score of ${s1} is within one standard error of the Level ${nearT.k} threshold (${nearT.t}), so ${nm} could plausibly be at either adjacent level.`);
    return { head, support: parts.join(' '), cautions };
  }
  C.narrative = narrative;

  function cautionEl(text) {
    const icon = s('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
      s('circle', { cx: 8, cy: 8, r: 7, style: { fill: 'none', stroke: 'var(--gold-dark)', strokeWidth: 1.5 } }),
      s('rect', { x: 7.2, y: 3.8, width: 1.6, height: 5.2, rx: .8, style: { fill: 'var(--gold-dark)' } }),
      s('circle', { cx: 8, cy: 11.6, r: 1, style: { fill: 'var(--gold-dark)' } }));
    return h('p', { class: 'caution' }, icon, h('span', null, text));
  }

  // ============================================================================
  // Class view
  // ============================================================================
  const ClassView = {
    mount(root) {
      this.chart = null;
      const set = C.set;
      this.cClass = selectCtl('Class', v => set({ classId: v, highlight: null }));
      fillSelect(this.cClass.sel, C.classes.map(c => ({ value: c.id, label: `${c.name} · Grade ${c.grade}` })), C.state.classId);
      this.cCmp = selectCtl('Compare with', v => set({ compare: v, highlight: null }));
      fillSelect(this.cCmp.sel, [{ value: 'none', label: `Nothing (${occasions[CUR].label} only)` }]
        .concat(occasions.filter((o, i) => i !== CUR).reverse().map(o => ({ value: o.id, label: occShort(o) }))), C.state.compare);
      this.cSort = segCtl('Order', [{ value: 'score', label: 'Score' }, { value: 'growth', label: 'Growth' }, { value: 'name', label: 'Name' }], v => set({ sort: v }));
      this.cSEM = toggleCtl('Uncertainty', v => set({ showSEM: v }), 'sem-toggle');
      this.cOL = toggleCtl('Standard Met range', v => set({ showOnLevel: v }));
      this.cAnon = toggleCtl('Hide names', v => set({ anon: v }));

      this.lede = h('div', { class: 'lede' });
      this.hlBar = h('div', { class: 'no-print' });
      this.legend = h('div', { class: 'legend', style: { marginTop: '.9rem' } });
      this.chartBox = h('div', { class: 'chart', 'data-tour': 'class-chart' });
      this.flowBox = h('div', { class: 'chart', 'data-tour': 'flow' });
      this.flowSub = h('p', { class: 'section-sub' });
      this.groupsBox = h('div', { class: 'groups' });
      this.tableBox = h('div', { class: 'tbl-wrap' });

      root.appendChild(h('div', { class: 'controls' }, this.cClass.el, this.cCmp.el, this.cSort.el, this.cSEM.el, this.cOL.el, this.cAnon.el));
      root.appendChild(this.lede);
      root.appendChild(this.legend);
      root.appendChild(this.hlBar);
      root.appendChild(this.chartBox);
      root.appendChild(h('p', { class: 'note' }, 'Select a student to see their growth over time. Hover over a level on the right to shade its range, or select it to see what students at that level can do.'));
      root.appendChild(h('div', { class: 'grid-2 block' },
        h('section', null, h('h2', { class: 'section-title' }, 'How the class moved'), this.flowSub, this.flowBox),
        h('section', { 'data-tour': 'groups' }, h('h2', { class: 'section-title' }, 'Where students are now'),
          h('p', { class: 'section-sub' }, `Grouped by Claim B level in ${occasions[CUR].label}, with an instructional next step for each group.`), this.groupsBox)));
      root.appendChild(h('details', { class: 'table-twin' }, h('summary', null, 'Show scores as a table'), this.tableBox));
    },

    update() {
      const st8 = C.state;
      const cls = C.classById[st8.classId];
      const studs = cls.students;
      const cmp = st8.compare === 'none' ? null : C.occIndex[st8.compare];
      const flowFrom = cmp == null ? C.occIndex[D.compare_default] : cmp;

      this.cClass.sel.value = st8.classId;
      this.cCmp.sel.value = st8.compare;
      this.cSort.set(st8.sort);
      this.cSEM.inp.checked = st8.showSEM;
      this.cOL.inp.checked = st8.showOnLevel;
      this.cAnon.inp.checked = st8.anon;

      const N = studs.length;
      const lvNow = studs.map(x => levelOf(x.scores[CUR]));
      const lvThen = studs.map(x => levelOf(x.scores[flowFrom]));
      const up = lvNow.filter((k, i) => k > lvThen[i]).length;
      const down = lvNow.filter((k, i) => k < lvThen[i]).length;
      const same = N - up - down;
      const atL3 = lvNow.filter(k => k >= 3).length;
      C.clear(this.lede);
      this.lede.appendChild(h('p', null, cmp == null
        ? `In ${occasions[CUR].label}, ${atL3} of ${N} students in ${cls.name} are at Level 3 (${levelName(3)}) or above on Claim B. Each dot is one student’s ${occasions[CUR].test} Claim B score, placed against the five levels of the Claim B learning progression.`
        : `${up} of ${N} students in ${cls.name} moved up at least one level between ${C.spanPhrase(cmp, CUR)}. ${same} stayed at the same level${down ? ` and ${down} moved down` : ''}. ${atL3} of ${N} are now at Level 3 (${levelName(3)}) or above.`));
      if (cmp != null && occasions[cmp].test !== occasions[CUR].test) {
        this.lede.appendChild(h('p', { class: 'note', style: { marginTop: '.4rem' } }, `The comparison runs from a ${occasions[cmp].test} ${occasions[cmp].measure.toLowerCase()} score to a ${occasions[CUR].test} ${occasions[CUR].measure} score, so it relies on the assumed link between the two scales.`));
      }

      C.clear(this.legend);
      this.legend.appendChild(legendKey('dot', `${occasions[CUR].label} score (${occasions[CUR].test})`));
      if (cmp != null) this.legend.appendChild(legendKey('open', `${occasions[cmp].label} score (${occasions[cmp].test})`));
      if (st8.showSEM) {
        this.legend.appendChild(legendKey('zone', `Within one standard error (±${Math.round(D.scale.sem)}) of a threshold`));
        if (cmp != null) {
          this.legend.appendChild(legendKey('stem', 'Change larger than measurement error'));
          this.legend.appendChild(legendKey('stem-dash', `Change within measurement error (±${DIFF_MOE})`));
        }
      }
      if (st8.showOnLevel) this.legend.appendChild(legendKey('onlevel', `Smarter Balanced Level 3 (Standard Met), Grade ${occasions[CUR].grade}`));

      C.clear(this.hlBar);
      if (st8.highlight) {
        this.hlBar.appendChild(h('div', { class: 'legend', style: { marginTop: '.5rem' } },
          h('span', null, 'Highlighting: ', h('b', null, st8.highlight.label)),
          h('button', { class: 'btn btn-sm btn-quiet', type: 'button', onclick: () => C.set({ highlight: null }) }, 'Clear')));
      }

      const W = chartWidth(this.chartBox);
      if (!this.chart || this.chart.key !== `${cls.id}:${W}`) {
        this.chart = C.ClassChart(this.chartBox, {
          cls,
          onOpen: id => C.set({ view: 'student', studentId: id, classId: C.studentById[id].classId, highlight: null }),
          onLevel: k => C.set({ level: k }),
          onHover: (node, e) => this.tip(node, e)
        });
      }
      this.chart.update(st8);

      this.flowSub.textContent = `From ${C.occPhrase(flowFrom)} to ${C.occPhrase(CUR)}. Select a flow to highlight those students.`;
      C.FlowChart(this.flowBox, {
        students: studs, fromIdx: flowFrom, toIdx: CUR,
        fromLabel: occasions[flowFrom].label, toLabel: occasions[CUR].label,
        anon: st8.anon, selectedKey: st8.highlight && st8.highlight.key,
        onSelect: sel => C.set({ highlight: sel })
      });
      this.renderGroups(studs);
      this.renderTable(studs, flowFrom);
    },

    tip(node, e) {
      const st8 = C.state, x = node.st;
      const cmp = st8.compare === 'none' ? null : C.occIndex[st8.compare];
      const row = i => C.ttRow(occasions[i].label, `${x.scores[i]} · ${lvlTag(levelOf(x.scores[i]))}`, C.levelColor(levelOf(x.scores[i])));
      const rows = [h('div', { class: 'tt-title' }, dname(x)), row(CUR)];
      if (cmp != null) { rows.push(row(cmp)); rows.push(C.ttRow('Change', signed(x.scores[CUR] - x.scores[cmp]))); }
      if (st8.showSEM) {
        const near = C.thresholds.findIndex(t => Math.abs(x.scores[CUR] - t) < D.scale.sem);
        if (near >= 0) rows.push(h('div', { class: 'tt-foot' }, `Within one standard error of the Level ${near + 1} threshold (${C.thresholds[near]}).`));
        if (cmp != null && Math.abs(x.scores[CUR] - x.scores[cmp]) <= DIFF_MOE) rows.push(h('div', { class: 'tt-foot' }, `Change is within measurement error (±${DIFF_MOE}).`));
      }
      rows.push(h('div', { class: 'tt-foot' }, 'Select for the full trajectory'));
      if (e) C.showTip(rows, e.clientX, e.clientY); else C.showTipAt(rows, node.dCur);
    },

    renderGroups(studs) {
      C.clear(this.groupsBox);
      for (let k = levels.length; k >= 0; k--) {
        const members = studs.filter(x => levelOf(x.scores[CUR]) === k);
        if (!members.length) continue;
        const info = levelInfo(k);
        const key = `now:${k}`;
        const label = `${members.length} now at ${lvlTag(k)}`;
        const on = C.state.highlight && C.state.highlight.key === key;
        const next = k === 0
          ? [h('b', null, `Next: Level 1, ${levels[0].label}. `), levels[0].understands[0]]
          : [h('b', null, k < levels.length ? `Next: Level ${k + 1}, ${levels[k].label}. ` : 'Top level of this progression. '), `Instructional next step: ${info.next_step}`];
        this.groupsBox.appendChild(h('div', { class: 'group' },
          h('div', { class: 'group-head' }, C.swatch(k),
            h('span', { class: 'name' }, lvlTag(k)),
            h('span', { class: 'count' }, `${members.length} student${members.length > 1 ? 's' : ''}`),
            h('button', { class: 'btn btn-sm btn-quiet', type: 'button', 'aria-pressed': String(!!on),
              onclick: () => C.set({ highlight: on ? null : { key, ids: members.map(x => x.id), label } }) }, on ? 'Clear' : 'Highlight')),
          h('div', { class: 'chips' }, members.slice().sort((a, b) => b.scores[CUR] - a.scores[CUR]).map(x =>
            h('a', { class: 'chip', href: `#/student/${x.id}`, title: `${x.scores[CUR]}` }, dname(x)))),
          h('div', { class: 'next' }, next)));
      }
    },

    renderTable(studs, from) {
      const rows = studs.slice().sort((a, b) => b.scores[CUR] - a.scores[CUR]);
      const tbl = h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Student'), occasions.map(o => h('th', { class: 'num' }, occShort(o))),
          h('th', null, `Level, ${occasions[from].label}`), h('th', null, `Level, ${occasions[CUR].label}`), h('th', { class: 'num' }, 'Change'))),
        h('tbody', null, rows.map(x => h('tr', null,
          h('td', null, h('a', { href: `#/student/${x.id}` }, dname(x))),
          x.scores.map(v => h('td', { class: 'num' }, v)),
          h('td', null, C.levelTag(levelOf(x.scores[from]))),
          h('td', null, C.levelTag(levelOf(x.scores[CUR]))),
          h('td', { class: 'num' }, signed(x.scores[CUR] - x.scores[from]))))));
      C.clear(this.tableBox).appendChild(tbl);
    },

    resize() { this.chart = null; this.update(); }
  };

  // ============================================================================
  // Student view
  // ============================================================================
  const StudentView = {
    mount(root) {
      this.chart = null;
      const set = C.set;
      this.cStu = selectCtl('Student', v => set({ studentId: v, classId: C.studentById[v].classId }));
      this.prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous student', onclick: () => this.step(-1) }, '‹');
      this.next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next student', onclick: () => this.step(1) }, '›');
      this.cFrom = selectCtl('From', v => set({ from: +v }));
      this.cTo = selectCtl('To', v => set({ to: +v }));
      const occOpts = occasions.map((o, i) => ({ value: String(i), label: occShort(o) }));
      fillSelect(this.cFrom.sel, occOpts, String(C.state.from));
      fillSelect(this.cTo.sel, occOpts, String(C.state.to));
      this.cSEM = toggleCtl('Uncertainty', v => set({ showSEM: v }), 'sem-toggle-stu');
      this.cOL = toggleCtl('Standard Met range', v => set({ showOnLevel: v }));

      this.lede = h('div', { class: 'lede', 'data-tour': 'statement' });
      this.legend = h('div', { class: 'legend', style: { marginTop: '.9rem' } });
      this.chartBox = h('div', { class: 'chart', 'data-tour': 'stu-chart' });
      this.cautionBox = h('div', { class: 'cautions' });
      this.probTitle = h('h2', { class: 'section-title' });
      this.probSub = h('p', { class: 'section-sub' });
      this.probBox = h('div', { class: 'prob' });
      this.nowBox = h('div');
      this.tableBox = h('div', { class: 'tbl-wrap' });

      root.appendChild(h('div', { class: 'controls' },
        h('div', { class: 'control' }, this.cStu.el, this.prev, this.next),
        this.cFrom.el, this.cTo.el, this.cSEM.el, this.cOL.el, h('span', { class: 'spacer' }),
        C.canPrint ? h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => window.print() }, 'Print report') : null));
      root.appendChild(h('div', { class: 'print-only kicker', style: { marginTop: '.4rem' } }, `Student growth report · ${D.text.title}`));
      root.appendChild(this.lede);
      root.appendChild(this.legend);
      root.appendChild(this.chartBox);
      root.appendChild(this.cautionBox);
      root.appendChild(h('section', { class: 'block', 'data-tour': 'prob' }, this.probTitle, this.probSub, this.probBox));
      root.appendChild(this.nowBox);
      root.appendChild(h('details', { class: 'table-twin' }, h('summary', null, 'Show scores as a table'), this.tableBox));
    },

    step(dir) {
      const x = C.studentById[C.state.studentId];
      const list = C.classById[x.classId].students;
      const i = list.indexOf(x);
      C.set({ studentId: list[(i + dir + list.length) % list.length].id });
    },

    update() {
      const st8 = C.state;
      const x = C.studentById[st8.studentId];
      const fi = Math.min(st8.from, st8.to), ti = Math.max(st8.from, st8.to);

      fillSelect(this.cStu.sel, C.students.map(v => ({ value: v.id, label: dname(v), group: v.className })), x.id);
      this.cFrom.sel.value = String(st8.from);
      this.cTo.sel.value = String(st8.to);
      this.cSEM.inp.checked = st8.showSEM;
      this.cOL.inp.checked = st8.showOnLevel;

      const nar = narrative(x, fi, ti, st8.bandsOff);
      C.clear(this.lede);
      this.lede.appendChild(h('div', { class: 'meta' }, h('b', { class: 'stu-name' }, dname(x)), ` · ${x.className} · Grade ${C.classById[x.classId].grade}`));
      this.lede.appendChild(h('p', null, `${nar.head} ${nar.support}`));
      C.clear(this.cautionBox);
      nar.cautions.forEach(t => this.cautionBox.appendChild(cautionEl(t)));

      C.clear(this.legend);
      this.legend.appendChild(legendKey('line', 'Scale score'));
      this.legend.appendChild(legendKey('ring', fi === ti ? 'Selected occasion' : 'Occasions being compared'));
      this.legend.appendChild(legendKey('link', 'Change of test (assumed link)'));
      if (st8.showSEM) this.legend.appendChild(legendKey('zone', `Within one standard error (±${Math.round(D.scale.sem)}) of a threshold`));
      if (st8.showOnLevel) this.legend.appendChild(legendKey('onlevel', 'Smarter Balanced Level 3 (Standard Met) for each grade'));

      const W = chartWidth(this.chartBox);
      if (!this.chart || this.chart.key !== `stu:${W}`) this.chart = C.StudentChart(this.chartBox, { onLevel: k => C.set({ level: k }) });
      this.chart.update({ student: x, from: fi, to: ti, showSEM: st8.showSEM, showOnLevel: st8.showOnLevel, bandsOff: st8.bandsOff, level: st8.level });

      this.renderProb(x, fi, ti);
      this.renderNow(x, ti);
      this.renderTable(x);
    },

    renderProb(x, fi, ti) {
      const s0 = x.scores[fi], s1 = x.scores[ti];
      const nm = dfirst(x);
      const two = fi !== ti;
      this.probTitle.textContent = `What ${nm} is likely to answer correctly`;
      C.clear(this.probSub).appendChild(document.createTextNode(two
        ? `Chance of a correct answer on each exemplar, ${occasions[fi].label} (open circle) and ${occasions[ti].label} (filled). `
        : `Chance of a correct answer on each exemplar in ${occasions[ti].label}. `));
      this.probSub.appendChild(h('span', { class: 'screen-only' }, 'Easy, average, and challenge exemplars sit at the 25th, 50th, and 75th percentiles of the item locations for their level.'));
      this.probSub.appendChild(h('span', { class: 'print-inline' }, 'A typical item sits at the median location of the items at its level.'));
      C.clear(this.probBox);
      this.probBox.appendChild(h('div', { class: 'prob-head' },
        h('span', { class: 'desc-h' }, 'Exemplar'), C.probAxis(), h('span', { class: 'desc-h', style: { textAlign: 'right' } }, two ? 'Change' : 'Chance')));
      for (let k = levels.length; k >= 1; k--) {
        const L = levelInfo(k);
        const grp = h('div', { class: 'prob-group', 'data-tour': `prob-${k}` },
          h('div', { class: 'prob-group-title' }, C.swatch(k), `${k} · ${L.label}`,
            h('button', { type: 'button', class: 'no-print', onclick: () => C.set({ level: k }) }, 'Open level')));
        L.exemplars.forEach(ex => {
          const p0 = prob(s0, ex.location), p1 = prob(s1, ex.location);
          grp.appendChild(h('div', { class: 'prob-row' + (ex.tier === 'Average' ? ' avg' : '') },
            h('div', { class: 'desc' },
              h('span', { class: 'tier screen-only' }, ex.tier),
              ex.tier === 'Average' ? h('span', { class: 'tier print-inline' }, 'Typical item') : null,
              h('span', { class: 'code' }, ex.targets), ex.title, ' ',
              h('button', { type: 'button', class: 'no-print', onclick: () => openExemplar(ex, L) }, 'View')),
            C.probTrack(p0, p1, two),
            h('div', { class: 'pvals', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '14px' } },
              two ? [h('span', { style: { color: 'var(--ink-3)' } }, pct(p0)), ' → ', h('b', null, pct(p1))] : h('b', null, pct(p1)))));
        });
        this.probBox.appendChild(grp);
      }
      this.probBox.appendChild(h('p', { class: 'note' },
        `Illustrative probabilities from a logistic item response model on the Smarter Balanced scale (${D.scale.slope} points per logit, average discrimination assumed), using hypothetical item locations.`));
    },

    renderNow(x, ti) {
      const k = levelOf(x.scores[ti]);
      const L = levelInfo(k);
      const nm = dfirst(x);
      C.clear(this.nowBox);
      const box = h('section', { class: 'block' },
        h('h2', { class: 'section-title' }, k === 0 ? `${nm} is working toward Level 1` : `Where ${nm} is now: Level ${k}, ${L.label}`),
        h('p', { class: 'section-sub' }, L.summary));
      if (k > 0) {
        box.appendChild(h('p', { style: { margin: '0 0 .7rem', maxWidth: '50rem' } }, h('b', null, 'Instructional next step: '), L.next_step));
        box.appendChild(h('button', { class: 'btn btn-quiet no-print', type: 'button', onclick: () => C.set({ level: k }) }, `Open Level ${k}`));
        box.appendChild(h('div', { class: 'print-only' },
          h('p', null, h('b', null, 'Students at this level can: '), L.understands.join(' ')),
          L.not_yet.length ? h('p', null, h('b', null, 'They may not yet: '), L.not_yet.join(' ')) : null));
      }
      box.appendChild(h('p', { class: 'print-only note' }, D.text.data_note));
      this.nowBox.appendChild(box);
    },

    renderTable(x) {
      const sem = D.scale.sem;
      const tbl = h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Occasion', 'Test', 'Score', '±1 SEM', 'Level', 'Change'].map((t, i) => h('th', { class: i === 2 || i === 5 ? 'num' : null }, t)))),
        h('tbody', null, occasions.map((o, i) => h('tr', null,
          h('td', null, `${o.season}, ${o.label}`),
          h('td', null, `${o.test} (${o.measure.toLowerCase()})`),
          h('td', { class: 'num' }, x.scores[i]),
          h('td', null, `${Math.round(x.scores[i] - sem)}–${Math.round(x.scores[i] + sem)}`),
          h('td', null, C.levelTag(levelOf(x.scores[i]))),
          h('td', { class: 'num' }, i ? signed(x.scores[i] - x.scores[i - 1]) : '')))));
      C.clear(this.tableBox).appendChild(tbl);
    },

    resize() { this.chart = null; this.update(); }
  };

  // ============================================================================
  // Task view: one Project Signal task mapped onto the Claim B levels
  // ============================================================================
  const TaskView = {
    mount(root) {
      const T = D.task;
      this.cStu = selectCtl('Show chances for', v => C.set({ studentId: v, classId: C.studentById[v].classId }));
      root.appendChild(h('div', { class: 'controls' }, this.cStu.el,
        h('span', { class: 'note' }, `Chances use each student’s ${occasions[CUR].label} score.`)));
      this.lede = h('div', { class: 'lede', 'data-tour': 'task-lede' });
      this.gridBox = h('div', { class: 'task-wrap', 'data-tour': 'task-grid' });
      this.tableBox = h('div', { class: 'tbl-wrap' });
      root.appendChild(this.lede);
      root.appendChild(h('div', { class: 'task-legend' },
        h('span', null, h('i', { style: { background: 'var(--bg)' } }), 'More likely than not to succeed'),
        h('span', null, h('i', { style: { background: 'var(--bg-soft)' } }), 'Less likely than not'),
        h('span', null, h('i', { style: { background: 'var(--bg-soft)', borderLeft: '4px solid var(--lv0)' } }), 'Evidence mainly for another claim'),
        h('span', null, h('i', { style: { background: 'rgba(207,184,124,.25)' } }), 'Student’s current level')));
      root.appendChild(this.gridBox);
      root.appendChild(h('p', { class: 'note' },
        `Step locations are hypothetical, set relative to each level’s threshold. Select a step to see its page from ${T.subtitle.split(' · ').pop()}. Phase 3’s interactive parts are placeholders in the appendix.`));
      root.appendChild(h('details', { class: 'table-twin' }, h('summary', null, 'Show the task steps as a table'), this.tableBox));
    },

    update() {
      const st8 = C.state;
      const T = D.task;
      const x = C.studentById[st8.studentId];
      const sc = x.scores[CUR];
      const kNow = levelOf(sc);
      const nm = dfirst(x);
      fillSelect(this.cStu.sel, C.students.map(v => ({ value: v.id, label: dname(v), group: v.className })), x.id);

      const bSteps = T.steps.filter(st => st.level > 0);
      const counts = levels.map(L => bSteps.filter(st => st.level === L.id).length);
      const likely = bSteps.filter(st => prob(sc, st.location) >= .5);
      const reachNext = bSteps.filter(st => prob(sc, st.location) < .5).sort((a, b) => a.location - b.location).slice(0, 2);
      C.clear(this.lede);
      this.lede.appendChild(h('div', { class: 'meta' }, T.subtitle));
      this.lede.appendChild(h('h2', { class: 'section-title', style: { fontSize: '1.35rem' } }, T.title));
      this.lede.appendChild(h('p', { class: 'task-q' }, T.question));
      this.lede.appendChild(h('p', null,
        `The task’s ${bSteps.length} Claim B steps reach all ${levels.length} levels: ${counts[1] + counts[2]} sit at Levels 2 and 3, and Level 1 rests on ${counts[0] === 1 ? 'a single step' : `${counts[0]} steps`}. ` +
        `At ${sc} (${kNow ? `Level ${kNow}` : D.below.label}), ${nm} would be more likely than not to succeed on ${likely.length} of the ${bSteps.length} Claim B steps` +
        (reachNext.length ? `; the closest steps beyond reach are “${reachNext.map(st => st.title).join('” and “')}.”` : '.')));

      // Grid: levels top to bottom, phases left to right.
      const grid = h('div', { class: 'task-grid', role: 'table', 'aria-label': 'Task steps by phase and Claim B level' });
      grid.appendChild(h('div', { class: 'th' }, 'Claim B level'));
      T.phases.forEach(ph => grid.appendChild(h('div', { class: 'th' }, ph)));
      const chip = st => {
        const other = st.level === 0;
        const p = other ? null : prob(sc, st.location);
        const cls = 'step-chip' + (other ? ' other' : p >= .5 ? ' likely' : ' unlikely');
        const label = `${st.title}. ${other ? st.targets : `Level ${st.level}, targets ${st.targets}, ${pct(p)} chance for ${nm}`}.`;
        return h('button', { class: cls, type: 'button', style: { borderLeftColor: other ? null : C.levelColor(st.level) }, 'aria-label': label,
          onclick: () => C.lightbox(`assets/img/${st.img}`, `${T.title}, ${T.phases[st.phase - 1]}: ${st.title}. ${other ? `Evidence mainly for ${st.targets}.` : `Claim B Level ${st.level} (${levelName(st.level)}), targets ${st.targets}, hypothetical location ${st.location}.`}${st.probe ? ` Preconception to listen for: ${st.probe.charAt(0).toLowerCase()}${st.probe.slice(1)}.` : ''}`) },
          h('span', { class: 't' }, st.title),
          other ? null : h('span', { class: 'pc' }, pct(p)),
          h('span', { class: 'tg' }, st.targets));
      };
      const rows = levels.slice().reverse().map(L => L.id).concat([0]);
      rows.forEach(k => {
        const now = k === kNow && k > 0;
        const lab = k === 0
          ? h('div', { class: 'rowlab' }, h('span', { class: 'swatch', style: { background: 'var(--lv0)' } }), h('div', null, h('b', null, 'Other claims'), h('span', null, 'Not scored on Claim B')))
          : h('div', { class: 'rowlab' + (now ? ' now' : '') }, C.swatch(k), h('div', null, h('b', null, `${k} · ${levelInfo(k).short}`), h('span', null, `${levelInfo(k).threshold}+`)));
        grid.appendChild(lab);
        T.phases.forEach((ph, pi) => {
          const here = T.steps.filter(st => st.level === k && st.phase === pi + 1).sort((a, b) => (b.location || 0) - (a.location || 0));
          grid.appendChild(h('div', { class: 'cell' + (now ? ' now' : '') }, here.map(chip)));
        });
      });
      C.clear(this.gridBox).appendChild(grid);

      const tbl = h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Phase', 'Step', 'Claim B level', 'Targets', 'Location', `Chance for ${nm}`, 'Preconception to listen for'].map((t, i) => h('th', { class: i === 4 || i === 5 ? 'num' : null }, t)))),
        h('tbody', null, T.steps.map(st => h('tr', null,
          h('td', null, T.phases[st.phase - 1]),
          h('td', null, st.title),
          h('td', null, st.level ? C.levelTag(st.level) : 'Other claim'),
          h('td', null, st.targets),
          h('td', { class: 'num' }, st.location || ''),
          h('td', { class: 'num' }, st.level ? pct(prob(sc, st.location)) : ''),
          h('td', { style: { whiteSpace: 'normal' } }, st.probe || '')))));
      C.clear(this.tableBox).appendChild(tbl);
    },
    resize() {}
  };

  // ============================================================================
  // Learning progression view
  // ============================================================================
  const ProgressionView = {
    mount(root) {
      root.appendChild(h('div', { class: 'controls' },
        h('span', { class: 'control' }, h('span', { class: 'lbl' }, D.text.lp_name)), h('span', { class: 'spacer' }),
        C.canPrint ? h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => window.print() }, 'Print the progression') : null));
      root.appendChild(h('div', { class: 'lede' },
        h('h2', null, 'Five levels of quantitative modeling'),
        h('p', null, `${D.text.lp_def} ${D.text.lp_frame}`),
        h('p', { class: 'note', style: { marginTop: '.5rem' } }, D.text.draft_note)));

      const cards = h('div', { class: 'lp-cards' });
      for (let k = levels.length; k >= 1; k--) {
        const L = levelInfo(k);
        const hi = k < levels.length ? levels[k].threshold - 1 : null;
        cards.appendChild(h('article', { class: 'lp-card' },
          h('div', { class: 'bar', style: { background: C.levelColor(k) } }),
          h('div', null,
            h('div', { class: 'kicker', style: { color: 'var(--ink-3)' } }, `Level ${k}`),
            h('h3', null, L.label),
            h('p', null, L.summary),
            h('div', { class: 'range' }, `Scale scores ${L.threshold}${hi ? `–${hi}` : ' and above'} · ${L.n_items} hypothetical items coded to this level`),
            h('button', { class: 'btn btn-sm btn-quiet no-print', type: 'button', style: { marginTop: '.55rem' }, onclick: () => C.set({ level: k }) }, 'Explore this level'))));
      }
      cards.appendChild(h('p', { class: 'note', style: { borderTop: '1px solid var(--rule)', paddingTop: '.8rem' } },
        `Scores below ${levels[0].threshold} are labeled “${D.below.label}”: a student there would be expected to answer fewer than half of typical Level 1 items correctly.`));
      this.scaleBox = h('div', { class: 'chart lp-scale' });
      root.appendChild(h('div', { class: 'lp-layout' }, cards, this.scaleBox));

      const cell = arr => (arr && arr.length ? h('ul', null, arr.map(t => h('li', null, t))) : h('span', { class: 'note' }, '—'));
      root.appendChild(h('section', { class: 'block lp-table' },
        h('h2', { class: 'section-title' }, 'The full progression'),
        h('p', { class: 'section-sub' }, 'Working draft for review by the CADRE team and Project Signal content leads.'),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, ['Level', 'Students can', 'They may not yet', 'Preconceptions to listen for', 'Instructional next step'].map(t => h('th', null, t)))),
          h('tbody', null, levels.slice().reverse().map(L => h('tr', null,
            h('td', { style: { minWidth: '9rem' } }, h('b', null, `${L.id} · ${L.label}`)),
            h('td', null, cell(L.understands)), h('td', null, cell(L.not_yet)),
            h('td', null, cell(L.errors)), h('td', { style: { whiteSpace: 'normal', minWidth: '12rem' } }, L.next_step))))))));

      const tkeys = ['B1', 'B2', 'B3', 'B4'];
      root.appendChild(h('section', { class: 'block lp-table' },
        h('h2', { class: 'section-title' }, 'What each level looks like within each target'),
        h('p', { class: 'section-sub' }, 'Signal’s Claim B targets play the role that performance expectations play in a science learning progression: each is a content-specific version of the same five levels.'),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'data indicator-table' },
          h('thead', null, h('tr', null, h('th', null, 'Level'), tkeys.map(t => h('th', null, `${t}: ${D.targets[t]}`)))),
          h('tbody', null, levels.slice().reverse().map(L => h('tr', null,
            h('td', { style: { minWidth: '9rem' } }, h('b', null, `${L.id} · ${L.short}`)),
            tkeys.map(t => h('td', null, L.indicators[t])))))))));
    },
    update() {
      const W = 300, H = 540;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'The five levels located on the Smarter Balanced scale.' });
      C.frame(svg, { W, H, m: { t: 30, r: 150, b: 10, l: 44 }, yMin: C.Y_DOMAIN[0], yMax: C.Y_DOMAIN[1], ladderW: 140, narrow: false, onLevel: k => C.set({ level: k }) });
      C.clear(this.scaleBox).appendChild(svg);
    },
    resize() {}
  };

  // ============================================================================
  // Evidence view
  // ============================================================================
  const EvidenceView = {
    mount(root) {
      this.chart = null;
      const ev = D.evidence;
      const locs = D.items.map(it => it[1]);
      this.range = h('input', { type: 'range', class: 'range-input', min: Math.min(...locs), max: Math.max(...locs), step: 1, 'aria-label': 'Student score',
        oninput: e => C.set({ evScore: +e.target.value }) });
      this.rangeVal = h('b', { style: { fontVariantNumeric: 'tabular-nums', minWidth: '2.5rem' } });
      root.appendChild(h('div', { class: 'controls' },
        h('label', { class: 'control' }, h('span', { class: 'lbl' }, 'Student score'), this.range, this.rangeVal),
        h('span', { class: 'note' }, 'Or drag the gold line on the chart.')));
      root.appendChild(h('div', { class: 'lede' },
        h('h2', null, 'How the level thresholds would be set'),
        h('p', null, `Each dot is one of ${ev.n} hypothetical items coded to a Claim B level. In Project Signal, these would be item calibrations from the Year 3 tryouts. The black bar marks each level’s median location, which becomes that level’s threshold.`)));
      root.appendChild(h('div', { class: 'tiles' },
        h('div', { class: 'tile' }, h('div', { class: 't-label' }, 'Rank correlation, level and location'), h('div', { class: 't-value' }, ev.rho.toFixed(2))),
        h('div', { class: 'tile' }, h('div', { class: 't-label' }, 'Variance in location explained by level'), h('div', { class: 't-value' }, `${Math.round(ev.r2 * 100)}%`)),
        h('div', { class: 'tile' }, h('div', { class: 't-label' }, 'Typical item distance from its level’s mean'), h('div', { class: 't-value' }, Math.round(ev.rmse), h('small', null, ' points')))));
      this.chartBox = h('div', { class: 'chart', 'data-tour': 'evidence-chart' });
      root.appendChild(this.chartBox);
      root.appendChild(h('p', { class: 'note' }, 'Filled dots are items a student at the gold line would be more likely than not to answer correctly. Percentages above each column are the expected share of that level’s items answered correctly. All values here are hypothetical.'));

      const gap = levels[1].threshold - levels[0].threshold;
      root.appendChild(h('div', { class: 'prose block' },
        h('h3', null, 'Why the median'),
        h('p', null, 'A student whose score equals an item’s location has about a 50% chance of answering it correctly. Placing a level’s threshold at the median location of its items means a student at the threshold would be expected to answer about half of that level’s items correctly, and more of them as their score rises.'),
        h('h3', null, 'What the Signal data will need to show'),
        h('p', null, `The levels here are ${gap} points apart and each score carries about ±${Math.round(D.scale.sem)} points of measurement error. For the levels to support content-referenced interpretations, items written to higher levels must be reliably harder, and the typical item’s distance from its level’s mean should be smaller than the distance between thresholds. The Year 3 tryouts and Year 4 field test can test both conditions.`),
        h('h3', null, 'A starting point for inquiry'),
        h('p', null, 'A level assignment is a hypothesis about how a student is reasoning. It is best checked against classroom evidence such as the instructional next step that accompanies each level.')));

      this.tableBox = h('div', { class: 'tbl-wrap' });
      this.tableBox.appendChild(h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Level', 'Items', 'Min', '25th pct', 'Median (threshold)', '75th pct', 'Max'].map((t, i) => h('th', { class: i ? 'num' : null }, t)))),
        h('tbody', null, levels.map(Lv => h('tr', null, h('td', null, C.levelTag(Lv.id)),
          [Lv.n_items, Lv.min, Math.round(Lv.q25), Lv.threshold, Math.round(Lv.q75), Lv.max].map(v => h('td', { class: 'num' }, v)))))));
      root.appendChild(h('details', { class: 'table-twin' }, h('summary', null, 'Show the item location summary as a table'), this.tableBox));
    },
    update() {
      const v = C.state.evScore;
      this.range.value = v;
      this.rangeVal.textContent = v;
      const W = chartWidth(this.chartBox);
      if (!this.chart || this.chart.W !== W) {
        this.chart = C.Beeswarm(this.chartBox, { score: v, onScore: sc => C.set({ evScore: sc }), onLevel: k => C.set({ level: k }) });
        this.chart.W = W;
      }
      this.chart.update(v);
    },
    resize() { this.chart = null; this.update(); }
  };

  C.views = { class: ClassView, student: StudentView, task: TaskView, progression: ProgressionView, evidence: EvidenceView };
})();
