/* App state and hash routing.
   Routes: #/class/c1  #/student/c1-01  #/progression  #/evidence  (+ /level/3 opens a level). */
(function () {
  'use strict';
  const C = window.CRG;
  const { h } = C;

  const state = C.state = {
    view: 'class',
    classId: C.classes[0].id,
    studentId: C.students[0].id,
    level: null,
    compare: C.D.compare_default,
    sort: 'score',
    showSEM: false,
    showOnLevel: false,
    anon: false,
    highlight: null,
    from: 0,
    to: C.occasions.length - 1,
    evScore: C.levels[2].threshold,
    bandsOff: false
  };

  const VIEWS = ['class', 'student', 'task', 'progression', 'evidence'];
  const TITLES = { class: 'Class', student: 'Student', task: 'Task', progression: 'Learning progression', evidence: 'How levels are set' };
  const main = document.getElementById('main');
  let current = null, currentName = null;

  function hashFor(st) {
    let p = `#/${st.view}`;
    if (st.view === 'class') p += `/${st.classId}`;
    if (st.view === 'student') p += `/${st.studentId}`;
    if (st.level) p += `/level/${st.level}`;
    return p;
  }

  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const out = { level: null, view: VIEWS.includes(parts[0]) ? parts[0] : 'class' };
    let i = 1;
    if (out.view === 'class' && C.classById[parts[1]]) { out.classId = parts[1]; i = 2; }
    if (out.view === 'student' && C.studentById[parts[1]]) {
      out.studentId = parts[1];
      out.classId = C.studentById[parts[1]].classId;
      i = 2;
    }
    const k = +parts[i + 1];
    if (parts[i] === 'level' && k >= 1 && k <= C.levels.length) out.level = k;
    return out;
  }

  /** Update state and re-render. Route changes are written to the URL. */
  C.set = function (patch, opt) {
    const prevView = state.view;
    Object.assign(state, patch);
    const hs = hashFor(state);
    if (hs !== location.hash) {
      try {
        if (opt && opt.replace) history.replaceState(null, '', hs);
        else history.pushState(null, '', hs);
      } catch (e) {
        // Some browsers restrict history on file://; fall back to a plain hash write.
        ignoreHash = hs;
        location.hash = hs;
      }
    }
    render(prevView !== state.view);
  };

  let ignoreHash = null;
  function onRoute() {
    if (ignoreHash && location.hash === ignoreHash) { ignoreHash = null; return; }
    const prevView = state.view;
    Object.assign(state, parse());
    if (state.view !== 'class') state.highlight = null;
    render(prevView !== state.view);
  }
  window.addEventListener('popstate', onRoute);
  window.addEventListener('hashchange', onRoute);

  function render(viewChanged) {
    document.querySelectorAll('.tabs a').forEach(a => {
      if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (currentName !== state.view) {
      C.hideTip();
      C.clear(main);
      const root = h('div', { class: 'view', id: `view-${state.view}` });
      main.appendChild(root);
      current = C.views[state.view];
      currentName = state.view;
      current.mount(root);
      if (viewChanged && !(C.tour && C.tour.active())) window.scrollTo(0, 0);
    }
    current.update();
    C.drawer.sync();
    document.title = `${TITLES[state.view]} · ${C.D.text.title} · Content-Referenced Growth`;
  }

  // Tabs keep the current class and student when switching views.
  document.querySelectorAll('.tabs a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      C.set({ view: a.dataset.view, level: null, highlight: null });
    });
  });
  document.getElementById('tour-btn').addEventListener('click', () => C.tour.start());

  let lastW = window.innerWidth, rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      C.hideTip();
      if (current && current.resize) current.resize();
    }, 160);
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (C.lightboxOpen()) { C.closeLightbox(); return; }
    if (state.level) C.set({ level: null });
    else if (state.highlight) C.set({ highlight: null });
  });

  // Keep only the tab row pinned while scrolling.
  const head = document.querySelector('.app-head');
  const tabs = head.querySelector('.tabs');
  const pinTabs = () => { head.style.top = `calc(env(safe-area-inset-top, 0px) - ${head.offsetHeight - tabs.offsetHeight - 1}px)`; };
  pinTabs();
  window.addEventListener('resize', pinTabs);
  if (document.fonts) document.fonts.ready.then(pinTabs);

  Object.assign(state, parse());
  history.replaceState && (() => { try { history.replaceState(null, '', hashFor(state)); } catch (e) { /* file:// */ } })();
  render(true);
})();
