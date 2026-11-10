/* practice.js — daily 10-word retrieval engine (replaces the old flip-card review).
 * Modes:  #/l/<id>/practice  learn session for one part (3 rounds: pick -> type -> recall)
 *         #/l/<id>/review    spaced review of the due words of one list
 *         #/today            summary; #/today/review = due words from all lists of the course language
 * Data:   data/.../partN.json  +  optional data/.../practiceN.json  (curated "fix" + new "cloze" items).
 *         Without a practice file every card type except "fix" is generated from partN.json.
 * State:  S["listId::word"] = {box, due, reps, lapses, last}  (same key/shape family as before, so home counters keep working).
 * Uses globals from app.js / i18n.js at call time. Load this file BEFORE app.js. */

const PT = {
  en: { today: 'Today', review_h: 'Review', review_d: 'Spaced reviews of words you already learned (max 20 per session).', start: 'Start', new_h: 'New batch',
    new_d: 'Study, read, then practice.', learn_btn: 'Learn', practice_btn: 'Practice', nothing: 'Nothing due right now.', no_batch: 'No unstarted batch left in this language.',
    done_today: '✓ You already did a new batch today', practice: 'Practice', practice_d: '3 rounds of retrieval: choose → write → recall. Then the words enter the spaced schedule.',
    start_practice: 'Start practice', review_due: 'Review due', hint: 'Hint', next: 'Continue', typo: '✓ Almost, spelling: ', round: 'Round', say: 'Say it in {l}', recall_q: 'Type the word',
    fix_q: 'Which sentence is correct?', done_title: 'Session complete', sched: '{n} words scheduled. First review: tomorrow.', hardest: 'Hardest', perfect: 'words with no mistakes', hinted: '✓ Correct (with hint)' },
  fr: { today: 'Aujourd’hui', review_h: 'Révision', review_d: 'Révision espacée des mots déjà appris (max. 20 par séance).', start: 'Commencer', new_h: 'Nouveau lot',
    new_d: 'Étudier, lire, puis s’exercer.', learn_btn: 'Apprendre', practice_btn: 'S’exercer', nothing: 'Rien à réviser pour le moment.', no_batch: 'Plus de lot à commencer dans cette langue.',
    done_today: '✓ Nouveau lot déjà fait aujourd’hui', practice: 'Exercices', practice_d: '3 tours de rappel : choisir → écrire → se souvenir. Ensuite les mots entrent dans le calendrier espacé.',
    start_practice: 'Commencer', review_due: 'Réviser', hint: 'Indice', next: 'Continuer', typo: '✓ Presque, orthographe : ', round: 'Tour', say: 'Dites-le en {l}', recall_q: 'Tapez le mot',
    fix_q: 'Quelle phrase est correcte ?', done_title: 'Séance terminée', sched: '{n} mots planifiés. Première révision : demain.', hardest: 'Les plus difficiles', perfect: 'mots sans erreur', hinted: '✓ Correct (avec indice)' }
};
const pt = k => (PT[uiLang()] || PT.en)[k] ?? PT.en[k] ?? k;
const INT = [0, 1, 3, 7, 16, 35, 70];     // days until the next review, per box
const BATCH = 20, DAYMS = 864e5;
const boxOf = s => s ? (s.box ?? Math.min(5, s.reps || 0)) : 0;
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const lo = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const x = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = x; } } return d[b.length]; };
const cnt = s => (String(s).match(/\*/g) || []).length === 2;
const PH = /\b(something|someone|somebody|sb|sth)\b|qqn|qqch|quelqu|quelque|…|\.\.\.|\+|\//i;   // chunks with placeholders cannot be typed
document.head.insertAdjacentHTML('beforeend', '<style>.cue{direction:rtl;font-size:30px;font-weight:700;color:var(--ar);line-height:1.6;margin:6px 0}.opt{display:block;width:100%;text-align:left;margin:8px 0}</style>');

let P = null;
addEventListener('hashchange', () => { if (!/#\/(l\/[^/]+\/(review|practice)|today\/review)$/.test(location.hash)) P = null; });

/* ---------- practice files (optional, one per partN.json) ---------- */
const PRC = {};
async function getPractice(id) {
  if (id in PRC) return PRC[id];
  let map = {};
  try {
    const e = (await getIndex()).find(x => x.id === id), f = e && e.file.replace(/part[-_ ]?(\d+)\.json$/i, 'practice$1.json');
    if (f && f !== e.file) { const j = await J('data/' + f.split('/').map(encodeURIComponent).join('/')); (j.items || []).forEach(x => { map[String(x.w).toLowerCase()] = x; }); }
  } catch (e) { map = {}; }
  return PRC[id] = map;
}

/* ---------- card factory ---------- */
function clozePool(l, w, pe, onlyNew) {
  const out = [], add = (s, ar, nw) => {
    const m = String(s || '').match(/\*([^*]+)\*/); if (!m || !cnt(s)) return;
    out.push({ stem: esc(s).replace(/\*[^*]+\*/, BLANK), ans: [m[1]], show: m[1], ar: ar || '', say: s.replace(/\*/g, ''), nw,
      lemma: ap(m[1]).toLowerCase() !== ap(w.w).toLowerCase() ? w.w : '' });
  };
  (w.ex || []).forEach(x => add(sent(x, l.lang), x.ar, 0));
  (w.col || []).forEach(c => add(sent(c, l.lang), c.ar, 0));
  textSentences(l, w).forEach(s => add(s, '', 0));
  if (pe && pe.cloze) [].concat(pe.cloze).forEach(c => { const a = [].concat(c.a);
    out.push({ stem: esc(c.q).replace('___', BLANK), ans: a, show: a[0], ar: c.ar || '', say: c.q.replace('___', a[0]), nw: 1, lemma: ap(a[0]).toLowerCase() !== ap(w.w).toLowerCase() ? w.w : '' }); });
  const fresh = out.filter(x => x.nw);
  return onlyNew && fresh.length ? fresh : out;
}
function make(l, w, ty, pe, fresh) {
  const base = { l, w, k: ty };
  if (ty === 'recall') return { ...base, ans: [w.w, w.w.replace(/^(se|s')\s*/i, '')], show: w.w, say: w.w };
  if (ty === 'chunk') {
    const cs = (w.col || []).map(c => ({ p: colParse(c.p).p.replace(/\*/g, '').trim(), ar: c.p_ar })).filter(c => c.ar && c.p && !PH.test(c.p));
    if (!cs.length) return null; const c = rnd(cs); return { ...base, cue: c.ar, ans: [c.p], show: c.p, say: c.p };
  }
  if (ty === 'cloze') { const pool = clozePool(l, w, pe, fresh); return pool.length ? { ...base, ...rnd(pool), tag: 'fill' } : null; }
  if (ty === 'pick') {
    const others = shuf(l.words.filter(x => x !== w)).sort((a, b) => (b.pos === w.pos) - (a.pos === w.pos)).slice(0, 3);
    const sp = clozePool(l, w, pe).filter(x => ap(x.ans[0]).toLowerCase() === ap(w.w).toLowerCase());
    const src = sp.length ? { ...rnd(sp), tag: 'fill' } : { stem: blankOut(w.def, w.w), ans: [w.w], show: w.w, say: w.w, ar: '', tag: 'which' };
    return { ...base, ...src, ans: [w.w], show: w.w, lemma: '', opts: shuf([w.w, ...others.map(x => x.w)]).map(x => ({ t: x, ok: x === w.w })) };
  }
  if (ty === 'fix') {
    const f = pe && pe.fix; if (!f) return null;
    return { ...base, opts: shuf(f.o.map((x, i) => ({ t: x, ok: i === f.a }))), why: f.why || '', show: f.o[f.a], say: f.o[f.a] };
  }
  return null;
}
const PLAN = b => b <= 1 ? ['cloze', 'recall'] : b === 2 ? ['chunk', 'cloze'] : ['fix', 'chunk'];

/* ---------- sessions ---------- */
function learnSession(l, pe, k) {
  const ws = l.words, mk = (w, ty) => make(l, w, ty, pe[w.w.toLowerCase()]);
  const r1 = shuf(ws.map(w => mk(w, 'pick'))), r2 = shuf(ws.map(w => mk(w, 'cloze') || mk(w, 'chunk') || mk(w, 'recall'))),
    r3 = shuf(ws.flatMap(w => [mk(w, 'recall'), mk(w, 'fix')].filter(Boolean)));
  [r1, r2, r3].forEach((r, i) => r.forEach(c => { c.rd = i + 1; }));
  const q = [...r1, ...r2, ...r3];
  return { key: k, mode: 'learn', id: l.id, items: ws.map(w => ({ l, w })), q, total: q.length, done: 0, res: {}, left: {} };
}
function reviewSession(items, pes, k, id) {
  const r1 = [], r2 = [], left = {};
  for (const { l, w } of items) {
    const b = boxOf(S[key(l, w)]), pe = (pes[l.id] || {})[w.w.toLowerCase()], used = new Set(), cs = [];
    for (const first of PLAN(b)) for (const ty of [first, 'cloze', 'chunk', 'recall']) {
      if (used.has(ty)) continue; const c = make(l, w, ty, pe, b >= 2); if (c) { used.add(ty); cs.push(c); break; }
    }
    if (cs[0]) r1.push(cs[0]); if (cs[1]) r2.push(cs[1]); left[key(l, w)] = cs.length;
  }
  const q = [...shuf(r1), ...shuf(r2)];
  return { key: k, mode: 'review', id, items, q, total: q.length, done: 0, res: {}, left };
}
function commit(r) {   // word-level scheduling after all its cards of this session were answered
  const k = key(r.l, r.w), o = S[k] || {}, b = boxOf(o), now = Date.now(); let nb, due;
  if (!r.bad) { nb = Math.min(6, b + 1); due = now + INT[nb] * DAYMS; }
  else if (r.bad === 1) { nb = Math.max(1, b - 1); due = now + Math.max(1, INT[nb]) * DAYMS; }
  else { nb = 1; due = now + 4 * 36e5; }
  S[k] = { ...o, box: nb, due, reps: (o.reps || 0) + 1, lapses: (o.lapses || 0) + (r.bad > 1 ? 1 : 0), last: now }; save();
}
function record(c, good) {
  const k = key(c.l, c.w), r = P.res[k] = P.res[k] || { l: c.l, w: c.w, bad: 0 };
  if (!good) r.bad++;
  if (P.mode === 'review' && --P.left[k] === 0) commit(r);
}
function judge(c, v) {
  v = String(v || '').trim(); if (!v) return { ok: false };
  if (c.ans.some(a => lo(v) === lo(a))) return { ok: true };
  const hit = c.ans.find(a => nz(lo(v)) === nz(lo(a))); if (hit) return { ok: true, note: 'accents', a: hit };
  const near = c.ans.find(a => { const b = nz(lo(a)); return b.length >= 6 && lev(nz(lo(v)), b) <= 1; }); if (near) return { ok: true, note: 'typo', a: near };
  return { ok: false };
}
const firstLetters = s => String(s).split(' ').map(x => x[0] + '_'.repeat(Math.max(0, x.length - 1))).join(' ');

/* ---------- rendering ---------- */
function render() {
  KEYS = null; if (!P) return;
  const c = P.q[0]; if (!c) return finish();
  const { l, w } = c; P.hinted = false;
  let cue;
  if (c.k === 'recall') cue = `<div class="tag">${pt('recall_q')}</div>${w.emoji ? `<div class="emo">${esc(w.emoji)}</div>` : ''}<div class="cue">${esc(w.ar)}</div>`;
  else if (c.k === 'chunk') cue = `<div class="tag">${pt('say').replace('{l}', LANGS[G.course].name)}</div><div class="cue">${esc(c.cue)}</div>`;
  else if (c.k === 'fix') cue = `<div class="tag">${pt('fix_q')}</div>`;
  else cue = `<div class="tag">${t(c.tag)}</div><div style="font-size:23px">${c.stem}</div>${c.lemma ? `<div class="mut">→ ${esc(c.lemma)}</div>` : ''}`;
  const label = P.mode === 'learn' ? pt('round') + ' ' + c.rd + '/3' : pt('review_h');
  const input = c.opts ? c.opts.map((o, i) => `<button class="btn alt opt" data-i="${i}">${esc(o.t)}</button>`).join('')
    : `<input class="ans" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false"><div><button class="btn alt sm" id="hint">${pt('hint')}</button> <button class="btn" id="chk">${t('check')}</button></div>`;
  app.innerHTML = `${bar(P.done, Math.max(1, P.total))}<div class="mut" style="margin:6px 0">${label} · ${P.q.length} ${t('left')}</div>
  <div class="card center">${cue}<span class="pos" style="margin-top:8px">${esc(w.pos)}</span><div id="hintbox"></div>${input}<div id="back"></div></div>`;
  if (c.opts) {
    const bs = [...app.querySelectorAll('.opt')];
    bs.forEach((b, i) => b.onclick = () => {
      bs.forEach((x, k) => { x.style.pointerEvents = 'none'; if (c.opts[k].ok) x.className = 'btn opt'; else if (k === i) { x.style.background = 'var(--no)'; x.style.color = '#fff'; } });
      answered(c, c.opts[i].ok);
    });
    return;
  }
  const inp = document.getElementById('ans'), chk = document.getElementById('chk'); inp.focus();
  document.getElementById('hint').onclick = () => {
    P.hinted = true; document.getElementById('hint').remove();
    document.getElementById('hintbox').innerHTML = (c.ar ? `<div class="ar" style="text-align:center">${esc(c.ar)}</div>` : '') + `<div class="mut">${esc(firstLetters(c.ans[0]))}</div>`;
  };
  const go = () => { const j = judge(c, inp.value); inp.disabled = true; chk.remove(); const h = document.getElementById('hint'); if (h) h.remove(); answered(c, j.ok, j.note, j.a); };
  chk.onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
}
function answered(c, ok, note, a) {
  if (!c.retry) record(c, ok && !P.hinted);
  const msg = ok ? (note === 'accents' ? t('accents') + esc(a) : note === 'typo' ? pt('typo') + esc(a) : P.hinted ? pt('hinted') : t('correct')) : t('answer') + esc(c.show);
  document.getElementById('back').innerHTML = `<p class="${ok ? 'good' : 'bad'}">${msg}</p>${c.why ? `<div class="box note">${esc(c.why)}</div>` : ''}
    ${ok ? '' : `<div style="text-align:left">${wordCard(c.l, c.w, false)}</div>`}<button class="btn" id="go">${pt('next')}</button>`;
  speak(c.say || c.show);
  let used = false;
  const next = () => { if (used) return; used = true; P.q.shift(); if (!ok) P.q.splice(Math.min(3, P.q.length), 0, { ...c, retry: true }); if (!c.retry) P.done++; render(); };
  document.getElementById('go').onclick = next; KEYS = { Enter: next };
}
function finish() {
  let h; const now = Date.now();
  if (P.mode === 'learn') {
    const hard = [];
    P.items.forEach(({ l, w }) => { const k = key(l, w), miss = (P.res[k] || {}).bad || 0; if (miss > 1) hard.push(w.w);
      if (!S[k]) S[k] = { box: 1, reps: 1, lapses: 0, due: now + (miss > 1 ? 3 * 36e5 : DAYMS), last: now }; });
    save(); G.daily = { d: new Date().toDateString(), id: P.id }; saveG();
    h = `<h1>🎉 ${pt('done_title')}</h1><p>${pt('sched').replace('{n}', P.items.length)}</p>${hard.length ? `<p class="mut">${pt('hardest')}: ${hard.map(esc).join(', ')}</p>` : ''}
      <a class="btn" href="#/today">${pt('today')}</a><a class="btn alt" href="#/l/${P.id}">${t('back_list')}</a>`;
  } else if (!P.total) {
    const nxt = Math.min(...Object.values(S).map(s => s.due).filter(d => d > now));
    h = `<h1>🎉 ${t('all_done')}</h1><p>${pt('nothing')}</p>${isFinite(nxt) ? `<p class="mut">${t('next_due')}${new Date(nxt).toLocaleString()}</p>` : ''}<a class="btn" href="#/today">${pt('today')}</a>`;
  } else {
    const rs = Object.values(P.res), ok = rs.filter(r => !r.bad).length;
    h = `<h1>🎉 ${pt('done_title')}</h1><p>${ok} / ${rs.length} ${pt('perfect')}</p><a class="btn" href="#/today">${pt('today')}</a>`;
  }
  P = null; app.innerHTML = `<div class="card center">${h}</div>`;
}

/* ---------- routes ---------- */
async function practice(id, mode) {
  const l = await getList(id); useLang(l.lang); crumbs(crumbsFor(l, pt(mode === 'practice' ? 'practice' : 'review_due')));
  const k = mode + ':' + id;
  if (!P || P.key !== k) {
    const pe = await getPractice(id);
    if (mode === 'practice') P = learnSession(l, pe, k);
    else { const now = Date.now(); P = reviewSession(l.words.filter(w => S[key(l, w)] && S[key(l, w)].due <= now).map(w => ({ l, w })), { [id]: pe }, k, id); }
  }
  render();
}
async function today(sub) {
  const idx = await getIndex(); await getCatalog(); buildPR();
  const L = G.course, mine = new Map(idx.filter(e => e.lang === L).map(e => [e.id, e])), now = Date.now(), lid = k => k.slice(0, k.indexOf('::'));
  const due = Object.entries(S).filter(([k, s]) => s.due <= now && mine.has(lid(k))).sort((a, b) => a[1].due - b[1].due);
  if (sub === 'review') {
    crumbs([[t('home'), '#/'], [pt('today'), '#/today'], [pt('review_h')]]);
    if (!P || P.key !== 'today') {
      const part = due.slice(0, BATCH), ids = [...new Set(part.map(([k]) => lid(k)))], lists = await Promise.all(ids.map(getList)), pes = {};
      for (const i of ids) pes[i] = await getPractice(i);
      const items = []; part.forEach(([k]) => { const l = lists[ids.indexOf(lid(k))], w = l.words.find(x => x.w === k.slice(lid(k).length + 2)); if (w) items.push({ l, w }); });
      P = reviewSession(items, pes, 'today', '');
    }
    return render();
  }
  crumbs([[t('home'), '#/'], [pt('today')]]);
  const parts = [...tree(idx, L).values()].flatMap(m => [...m.values()].flat()), nb = parts.find(e => !stat(e).seen), done = G.daily && G.daily.d === new Date().toDateString();
  const step = (n, h, d, b) => `<div class="card step"><div class="num">${n}</div><div><h2>${h}</h2><p class="mut">${d}</p>${b}</div></div>`;
  app.innerHTML = `<h1>${LANGS[L].flag} ${pt('today')}</h1>
  ${step(1, pt('review_h'), `<span class="${due.length ? 'good' : ''}">${due.length} ${t('due')}</span> · ${pt('review_d')}`, due.length ? `<a class="btn" href="#/today/review">${pt('start')}</a>` : `<span class="mut">${pt('nothing')}</span>`)}
  ${step(2, pt('new_h'), nb ? `${esc(nb.title)} · ${nb.count} ${t('words')}<br>${done ? pt('done_today') : pt('new_d')}` : pt('no_batch'),
    nb ? `<a class="btn${done ? ' alt' : ''}" href="#/l/${nb.id}/study/0">${pt('learn_btn')}</a><a class="btn alt" href="#/l/${nb.id}/practice">${pt('practice_btn')}</a>` : '')}`;
}
