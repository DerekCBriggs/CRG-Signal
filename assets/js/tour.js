/* Guided tour: each step is an app state plus a spotlighted element. */
(function () {
  'use strict';
  const C = window.CRG;
  const { h, levelOf, levelName, prob, pct } = C;

  const root = document.getElementById('tour');
  let idx = -1;
  let spot, card, raf, settle;

  // The tour follows the first example student and the first class.
  const hero = C.students[0];
  const cls = C.classes[0];
  const CUR = C.CUR, PREV = C.occIndex[C.D.compare_default];
  const s0 = hero.scores[0], s1 = hero.scores[CUR];
  const L0 = levelOf(s0), L1 = levelOf(s1);
  const q = C.levelInfo(3);
  const occ = i => C.occasions[i];
  const movedUp = cls.students.filter(x => levelOf(x.scores[CUR]) > levelOf(x.scores[PREV])).length;
  const bSteps = C.D.task.steps.filter(st => st.level > 0);
  const base = { studentId: hero.id, classId: cls.id, from: 0, to: CUR, anon: false, highlight: null, showOnLevel: false, showSEM: false, level: null };
  const lvl = k => (k === 0 ? 'below Level 1' : `Level ${k} (${levelName(k)})`);

  const steps = [
    {
      state: Object.assign({}, base, { view: 'student', bandsOff: true }),
      target: '[data-tour="stu-chart"]',
      title: `A ${s1 - s0}-point gain`,
      body: `${hero.first}’s mathematics score rose from ${s0} on the ${occ(0).test} test in ${occ(0).label} to ${s1} on ${occ(CUR).test} in ${occ(CUR).label}. The number says ${hero.first} grew. It doesn’t say in what.`
    },
    {
      state: Object.assign({}, base, { view: 'student', bandsOff: false }),
      target: '[data-tour="stu-chart"] .ladder',
      title: 'Anchoring the scale to Claim B',
      body: 'Content-referenced growth divides the Smarter Balanced scale into the five levels of a learning progression for Project Signal’s Claim B, Quantitative Analysis and Modeling. Each level is a more sophisticated way of using mathematics to model a phenomenon. Hover over a level to shade its range, or select it to open it.'
    },
    {
      state: Object.assign({}, base, { view: 'evidence', evScore: q.threshold, bandsOff: false }),
      target: '[data-tour="evidence-chart"]',
      title: 'Where the thresholds would come from',
      body: 'Each dot is an item coded to a level; these are hypothetical until Signal’s Year 3 tryouts. Items written for higher levels should be harder. A level begins at the median location of its items, so a student at a threshold has about a 50% chance on a typical item at that level.'
    },
    {
      state: Object.assign({}, base, { view: 'task', bandsOff: false }),
      target: '[data-tour="task-grid"]',
      title: 'One Signal task, five levels',
      body: `“Water in Our Schoolyard” has ${bSteps.length} steps that yield Claim B evidence, from reading a data table (Level 1) to judging which measurement is more useful (Level 5). The percentages show ${hero.first}’s chance on each step. Select a step to see the task page.`
    },
    {
      state: Object.assign({}, base, { view: 'student', bandsOff: false }),
      target: '[data-tour="statement"]',
      title: 'The same growth, read as content',
      body: `Read against the progression, ${hero.first}’s ${s1 - s0} points become a change in how ${hero.first} uses mathematics: from ${lvl(L0)} to ${lvl(L1)}.`
    },
    {
      state: Object.assign({}, base, { view: 'student', bandsOff: false }),
      target: '[data-tour="prob-3"]',
      title: `What ${hero.first} can likely do now`,
      body: `On a typical Level 3 item, ${hero.first}’s chance of answering correctly rose from ${pct(prob(s0, q.threshold))} in ${occ(0).label} to ${pct(prob(s1, q.threshold))} in ${occ(CUR).label}.`
    },
    {
      state: Object.assign({}, base, { view: 'student', bandsOff: false, level: 3 }),
      target: '#drawer',
      title: 'Inside a level',
      body: 'Each level lists what students can do, what they may not yet do, and preconceptions to listen for, with indicators for each Claim B target, exemplars from the Signal task, and an instructional next step.'
    },
    {
      state: Object.assign({}, base, { view: 'class', compare: occ(PREV).id, sort: 'score', bandsOff: false }),
      target: '[data-tour="class-chart"]',
      title: 'The whole class',
      body: `Each column is a student. The open circle is the ${occ(PREV).test} score from ${occ(PREV).label} and the filled circle is the ${occ(CUR).test} score from ${occ(CUR).label}. Select any student to see their full trajectory.`
    },
    {
      state: Object.assign({}, base, { view: 'class', compare: occ(PREV).id, sort: 'score', bandsOff: false }),
      target: '[data-tour="flow"]',
      title: 'Grouping for instruction',
      body: `${movedUp} of ${cls.students.length} students moved up at least one level from ${occ(PREV).label} to ${occ(CUR).label}. Select a flow to highlight those students, or use the groups and their instructional next steps alongside.`
    },
    {
      state: Object.assign({}, base, { view: 'class', compare: occ(PREV).id, sort: 'score', bandsOff: false, showSEM: true }),
      target: '[data-tour="class-chart"]',
      title: 'Scores are estimates',
      body: `The shaded bands mark scores within ±${Math.round(C.D.scale.sem)} points (one standard error) of a threshold, where a student could be at either level. Dashed stems mark growth smaller than measurement error. The Grade 4 to Grade 5 comparison also rests on an assumed link between the two tests.`
    }
  ];

  function build() {
    C.clear(root);
    spot = h('div', { class: 'spot' });
    card = h('div', { class: 'card', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tour-title' });
    root.appendChild(spot);
    root.appendChild(card);
  }

  function renderCard() {
    const st = steps[idx];
    const last = idx === steps.length - 1;
    C.clear(card);
    card.appendChild(h('div', { class: 'step' }, `Tour · ${idx + 1} of ${steps.length}`));
    card.appendChild(h('h3', { id: 'tour-title' }, st.title));
    card.appendChild(h('p', null, st.body));
    const next = h('button', { class: 'btn btn-gold btn-sm', type: 'button', onclick: () => go(idx + 1) }, last ? 'Explore on your own' : 'Next');
    card.appendChild(h('div', { class: 'nav' },
      h('div', { class: 'dots', 'aria-hidden': 'true' }, steps.map((_, i) => h('i', { class: i === idx ? 'on' : null }))),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-sm btn-quiet', type: 'button', onclick: end }, 'Exit'),
      idx > 0 ? h('button', { class: 'btn btn-sm btn-quiet', type: 'button', onclick: () => go(idx - 1) }, 'Back') : null,
      next));
    requestAnimationFrame(() => next.focus({ preventScroll: true }));
  }

  function place() {
    const st = steps[idx];
    if (!st) return;
    const el = document.querySelector(st.target);
    const vw = window.innerWidth, vh = window.innerHeight, pad = 8, m = 16;
    let r = el ? el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, right: vw / 2, bottom: vh / 2, width: 0, height: 0 };
    const top = Math.max(r.top - pad, 4), left = Math.max(r.left - pad, 4);
    const bottom = Math.min(r.bottom + pad, vh - 4), right = Math.min(r.right + pad, vw - 4);
    Object.assign(spot.style, { top: top + 'px', left: left + 'px', width: Math.max(0, right - left) + 'px', height: Math.max(0, bottom - top) + 'px' });

    const cw = card.offsetWidth, ch = card.offsetHeight;
    const clampX = x => Math.min(Math.max(x, m), vw - cw - m);
    const clampY = y => Math.min(Math.max(y, m), vh - ch - m);
    const opts = [
      { ok: right + 14 + cw < vw - m, x: right + 14, y: clampY(top) },
      { ok: left - 14 - cw > m, x: left - 14 - cw, y: clampY(top) },
      { ok: bottom + 14 + ch < vh - m, x: clampX(left), y: bottom + 14 },
      { ok: top - 14 - ch > m, x: clampX(left), y: top - 14 - ch }
    ];
    // If nothing fits cleanly, use the roomiest side and accept a small overlap.
    const roomiest = () => {
      const room = [
        { v: vw - right, x: clampX(right + 14), y: clampY(top) },
        { v: left, x: clampX(left - 14 - cw), y: clampY(top) },
        { v: vh - bottom, x: clampX(left), y: clampY(bottom + 14) },
        { v: top, x: clampX(left), y: clampY(top - 14 - ch) }
      ];
      return room.sort((a, b) => b.v - a.v)[0];
    };
    const pick = opts.find(o => o.ok) || roomiest();
    card.style.left = pick.x + 'px';
    card.style.top = pick.y + 'px';
  }

  function follow() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const loop = now => { place(); if (now - t0 < 900) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  function go(i) {
    if (i < 0) return;
    if (i >= steps.length) { end(); return; }
    idx = i;
    C.set(steps[i].state, { replace: true });
    renderCard();
    // Timers as well as frames, so the spotlight settles even where animation frames are throttled.
    clearTimeout(settle);
    settle = setTimeout(function again(n) {
      place();
      if ((n || 0) < 4) settle = setTimeout(again, 350, (n || 0) + 1);
    }, 350);
    setTimeout(() => {
      const el = document.querySelector(steps[i].target);
      if (el && el.id !== 'drawer') {
        const r = el.getBoundingClientRect();
        // Park the target just under the pinned tab row so the card can sit beneath it.
        const header = document.querySelector('.tabs').offsetHeight + 8;
        const y = window.scrollY + r.top - header - 16;
        window.scrollTo({ top: Math.max(0, y), behavior: C.reduceMotion ? 'auto' : 'smooth' });
      }
      follow();
    }, 30);
  }

  function start() {
    build();
    root.classList.add('open');
    document.body.classList.add('touring');
    go(0);
  }
  function end() {
    root.classList.remove('open');
    document.body.classList.remove('touring');
    cancelAnimationFrame(raf);
    idx = -1;
    C.set({ bandsOff: false, level: null, showSEM: false }, { replace: true });
  }

  window.addEventListener('resize', () => { if (idx >= 0) place(); });
  window.addEventListener('scroll', () => { if (idx >= 0) place(); }, { passive: true });
  window.addEventListener('scrollend', () => { if (idx >= 0) place(); });
  document.addEventListener('keydown', e => {
    if (idx < 0) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
  }, true);

  C.tour = { start, end, active: () => idx >= 0 };
})();
