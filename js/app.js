/* app.js — the Word Lists app (views, spaced repetition, YouGlish, search).
 * Course language (G.course: en | fr) decides which lists you see, which voice reads words (TTS) and which YouGlish language is used.
 * Texts in the interface come from t() in i18n.js. Repo writes live in manage.js / github.js. */
const app = document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fm = s => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nz = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');   // accent-insensitive search
const ap = s => String(s).replace(/[’‘]/g, "'");
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const enc = s => encodeURIComponent(s);

let S = {}; try { S = JSON.parse(localStorage.getItem('wordlists.v1') || '{}'); } catch (e) { }
const save = () => { try { localStorage.setItem('wordlists.v1', JSON.stringify(S)); } catch (e) { } };
/* settings live under their own key so they never mix with progress */
let G = { n: 3, acc: 'us', auto: false, where: 'both', theme: 'auto', hideAr: false, videos: true, course: 'en', ui: 'auto', last: null };
try { Object.assign(G, JSON.parse(localStorage.getItem('wordlists.settings.v1') || '{}')); } catch (e) { }
if (!LANGS[G.course]) G.course = 'en';
const saveG = () => { try { localStorage.setItem('wordlists.settings.v1', JSON.stringify(G)); } catch (e) { } };
const setLast = (id, mode, i, title) => { G.last = { id, mode, i: i || 0, title, lang: G.course }; saveG(); };

/* ---------- chrome: header, language switch, breadcrumbs ---------- */
function applyUI() {
  const r = document.documentElement, b = document.body;
  G.theme === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', G.theme);
  b.classList.toggle('hide-ar', !!G.hideAr); b.classList.toggle('no-yg', G.videos === false);
  r.lang = uiLang();
  document.getElementById('langsw').innerHTML = Object.entries(LANGS).map(([k, v]) =>
    `<button data-lang="${k}" class="${G.course === k ? 'on' : ''}" title="${esc(v.name)}" aria-label="${esc(v.name)}">${v.flag} ${v.short}</button>`).join('');
  document.getElementById('b-ar').classList.toggle('off', !!G.hideAr);
  document.getElementById('b-yg').classList.toggle('off', G.videos === false);
  document.getElementById('b-set').title = t('settings');
  document.getElementById('brand-t').textContent = LANGS[G.course].name === 'Français' ? 'Listes de mots' : 'Word Lists';
}
const quick = f => () => { f(); saveG(); applyUI(); if (location.hash === '#/settings') settings(); };
document.getElementById('b-ar').onclick = quick(() => { G.hideAr = !G.hideAr; });
document.getElementById('b-yg').onclick = quick(() => { G.videos = G.videos === false; });
function setCourse(l) {
  if (!LANGS[l] || l === G.course) return;
  G.course = l; saveG(); applyUI();
  location.hash === '#/' || location.hash === '' ? route() : location.hash = '#/';
}
const crumbs = a => { document.getElementById('crumbs').innerHTML = a.map(([l, h]) => h ? `<a href="${h}">${esc(l)}</a>` : `<span>${esc(l)}</span>`).join('<i>›</i>'); };
const useLang = l => { l = l || 'en'; if (l !== G.course && LANGS[l]) { G.course = l; saveG(); applyUI(); } };   // opening a list of another language switches the course

/* ---------- data ---------- */
const cache = {}; let INDEX = null, SEARCH = null, EDITMODE = false, CAT = null, PR = {};
async function J(u) { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error('Cannot load ' + u); return r.json(); }
async function getIndex() { if (!INDEX) { INDEX = await J('data/index.json'); INDEX.forEach(e => { e.lang = e.lang || 'en'; }); } return INDEX; }
async function getSearch() { if (!SEARCH) { try { SEARCH = await J('data/search.json'); } catch (e) { SEARCH = []; } } return SEARCH; }
async function getCatalog() { if (!CAT) { try { CAT = await J('data/catalog.json'); } catch (e) { CAT = []; } } return CAT; }
/* e.file is a path relative to data/ and may contain subfolders (spaces, parentheses): encode each segment */
async function getList(id) {
  if (cache[id]) return cache[id];
  const e = (await getIndex()).find(x => x.id === id); if (!e) throw new Error('Unknown list ' + id);
  const l = await J('data/' + e.file.split('/').map(encodeURIComponent).join('/'));
  l.id = id; l.title = l.title || e.title; l.group = e.group; l.set = e.set; l.part = e.part; l.lang = e.lang || 'en';
  return cache[id] = l;
}
const cl = c => c.lang || 'en';
const srcOf = g => ((CAT || []).find(c => c.group === g) || {}).source || ((INDEX || []).find(e => e.group === g && e.source) || {}).source || '';
const srcBadge = g => { const s = srcOf(g); return s ? `<span class="src" title="Source: ${esc(s)}">${esc(s)}</span>` : ''; };
const expectedWords = (g, s) => (((CAT || []).find(c => cl(c) === G.course && c.group === g) || {}).counts || {})[s] || 0;
/* group -> Map(topic -> [parts]) for one language; catalog order first, then anything uploaded */
function tree(idx, L = G.course) {
  const M = new Map(), set = (g, s) => { g = g || 'Other'; if (!M.has(g)) M.set(g, new Map()); const m = M.get(g); if (!m.has(s)) m.set(s, []); return m.get(s); };
  (CAT || []).filter(c => cl(c) === L).forEach(c => { if (!(c.sets || []).length) set(c.group, '\0'); (c.sets || []).forEach(s => set(c.group, s)); });
  idx.filter(e => (e.lang || 'en') === L).forEach(e => set(e.group, e.set || e.title).push(e));
  M.forEach(m => { m.delete('\0'); m.forEach(a => a.sort((x, y) => (x.part || 0) - (y.part || 0) || x.title.localeCompare(y.title, undefined, { numeric: true }))); });
  return M;
}
/* progress per list id, computed once per view */
function buildPR() { const m = {}, now = Date.now(); for (const k in S) { const id = k.slice(0, k.indexOf('::')), x = m[id] || (m[id] = { due: 0, seen: 0 }); x.seen++; if (S[k].due <= now) x.due++; } PR = m; }
const stat = e => ({ due: (PR[e.id] || {}).due || 0, seen: (PR[e.id] || {}).seen || 0, count: e.count || 0 });
const sum = es => es.reduce((a, e) => { const s = stat(e); a.due += s.due; a.seen += s.seen; a.count += s.count; return a; }, { due: 0, seen: 0, count: 0 });
const partLabel = p => p.part ? cap(t('part')) + ' ' + p.part : p.title;
const bar = (a, b) => `<div class="bar"><i style="width:${b ? Math.min(100, a / b * 100) : 0}%"></i></div>`;
const partCard = e => { const s = stat(e); return `<div class="card slim"><a class="blk" href="#/l/${e.id}"><h2>${esc(e.title)}</h2><div class="mut">${esc([groupLabel(e.group), e.set].filter(Boolean).join(' / '))} · ${e.count} ${t('words')} · <span class="${s.due ? 'good' : ''}">${s.due} ${t('due')}</span></div></a>${EDITMODE ? listTools(e.file) : ''}</div>`; };

/* ---------- speech ---------- */
const speak = txt => { try { const u = new SpeechSynthesisUtterance(txt); u.lang = LANGS[G.course].tts; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } };
window.speak = speak;

/* ---------- YouGlish videos (lazy: nothing loads until a Videos button is tapped) ---------- */
// "have the *ability* to do something" -> "have the ability to"; a "yg" field in the JSON overrides the auto query
const ygq = s => String(s || '').replace(/\s*\[[^\]]*\]\s*(?:\([^)]*\))?\s*$/, '').replace(/\*/g, '').replace(/\b(?:do\s+)?(?:something|someone|somebody)\b/gi, '').replace(/(?:^|\s)(?:quelque chose|quelqu['’]un|qqch|qqn)(?=\s|$)/gi, ' ').replace(/\.\.\.|[?!]/g, ' ').replace(/\s+/g, ' ').trim();
const ygBtn = (q, label) => { q = ygq(q); return q ? `<button class="btn alt ygbtn" data-q="${enc(q)}">🎬 ${label || t('videos')}</button>` : ''; };
let ygP = null, ygN = 0;
const ygLoad = () => ygP = ygP || new Promise((ok, no) => {
  if (window.YG && YG.Widget) return ok();
  window.onYouglishAPIReady = ok; const s = document.createElement('script'); s.src = 'https://youglish.com/public/emb/widget.js'; s.async = true;
  s.onload = () => { if (window.YG && YG.Widget) ok(); }; s.onerror = () => { ygP = null; no(new Error('load')); }; document.body.appendChild(s);
});
const ygAccent = () => G.course === 'en' && G.acc !== 'all' ? G.acc : undefined;
const ygLink = q => 'https://youglish.com/pronounce/' + enc(q) + '/' + LANGS[G.course].yg + (ygAccent() ? '/' + ygAccent() : '');
async function ygOpen(btn) {
  const q = decodeURIComponent(btn.dataset.q), id = 'yg' + (++ygN), box = document.createElement('div'); box.className = 'yg';
  box.innerHTML = `<div id="${id}"><span class="mut">${t('loading_v')}</span></div><div class="nav"><button class="btn alt" data-d="-1">←</button><span class="mut"></span><button class="btn alt" data-d="1">→</button></div><a class="mut" target="_blank" rel="noopener" href="${ygLink(q)}">${esc(t('open_yg', { q }))}</a>`;
  btn.replaceWith(box);
  const lab = box.querySelector('.nav .mut'), [bp, bn] = box.querySelectorAll('.nav .btn'); let pos = 1, total = null, w;
  const max = () => Math.min(G.n, total == null ? G.n : total), upd = () => { lab.textContent = total === 0 ? t('no_clips') : pos + ' / ' + max(); bp.disabled = pos <= 1; bn.disabled = pos >= max(); };
  upd();
  try {
    await ygLoad();
    w = new YG.Widget(id, {
      width: Math.min(box.clientWidth || 320, 640), autoStart: G.auto ? 1 : 0,
      events: { onFetchDone: e => { total = e.totalResult || 0; upd(); }, onError: () => { lab.textContent = t('yg_err'); } }
    });
    w.fetch(q, LANGS[G.course].yg, ygAccent());
  } catch (e) { document.getElementById(id).innerHTML = `<span class="bad">${t('yg_fail')}</span>`; return; }
  bp.onclick = () => { if (pos > 1) { pos--; w.previous(); upd(); } };
  bn.onclick = () => { if (pos < max()) { pos++; w.next(); upd(); } };
}
/* one click handler for the whole page: videos, word-family chips, speaker icons, language switch */
document.addEventListener('click', e => {
  const lg = e.target.closest('[data-lang]'); if (lg) return setCourse(lg.dataset.lang);
  const sp = e.target.closest('.spk'); if (sp) return speak(sp.dataset.speak);
  const b = e.target.closest('.ygbtn'); if (b) return ygOpen(b);
  const f = e.target.closest('.fam'); if (!f) return;
  const box = f.parentElement.querySelector('.famyg'); if (!box) return;
  box.innerHTML = ''; const tb = document.createElement('button'); tb.dataset.q = f.dataset.q; box.appendChild(tb); ygOpen(tb);
});
/* keyboard: ← → in the study view, set per view */
let KEYS = null;
document.addEventListener('keydown', e => { if (!KEYS || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) || e.metaKey || e.ctrlKey) return; const f = KEYS[e.key]; if (f) f(); });

/* ---------- spaced repetition (SM-2 style) ---------- */
const key = (l, w) => l.id + '::' + w.w;
const st = (l, w) => S[key(l, w)];
const isDue = (l, w) => { const s = st(l, w); return !s || s.due <= Date.now(); };
function grade(l, w, g) { // g: 0 again, 1 hard, 2 good, 3 easy
  const s = st(l, w) || { reps: 0, ease: 2.3, iv: 0, lapses: 0 };
  if (g === 0) { s.reps = 0; s.lapses++; s.iv = 0; s.ease = Math.max(1.3, s.ease - .2); s.due = Date.now() + 10 * 60000; }
  else { s.reps++; s.iv = s.reps === 1 ? [0, 1, 2, 4][g] : Math.max(s.iv + 1, Math.round(s.iv * s.ease * [0, .8, 1, 1.35][g])); s.ease = Math.max(1.3, s.ease + [0, -.15, 0, .1][g]); s.due = Date.now() + s.iv * 864e5; }
  S[key(l, w)] = s; save();
}

/* ---------- content helpers ---------- */
/* sentence of an example / collocation / text: key "en", "fr", … (the list language first) */
const sent = (x, l) => (l && x[l]) || Object.keys(LANGS).map(k => x[k]).find(Boolean) || '';
/* "un *ami* proche [coll] (daily)" -> {p: "un *ami* proche", kind: "coll", reg: "daily"} */
const colParse = p => { const m = String(p || '').match(/^(.*?)\s*\[([^\]]+)\]\s*(?:\(([^)]+)\))?\s*$/); return m ? { p: m[1], kind: m[2], reg: m[3] || '' } : { p: String(p || ''), kind: '', reg: '' }; };
/* marks in texts: *form|headword*, *form* (form = headword) or **form** (headword guessed: réveillé -> se réveiller, compris -> comprendre) */
const MARK = /\*{1,2}([^*|]+)(?:\|([^*]+))?\*{1,2}/g;
function resolveHead(l, form, head) {
  if (head) return head.toLowerCase();
  const f = nz(form).replace(/’/g, "'"), key = w => nz(w.w).replace(/’/g, "'").replace(/^(se|s')\s*/, '');
  const exact = l.words.find(w => nz(w.w).replace(/’/g, "'") === f) || l.words.find(w => key(w) === f); if (exact) return exact.w.toLowerCase();
  let best = null, bestN = 0;
  for (const w of l.words) {
    const k = key(w); let n = 0; while (n < f.length && n < k.length && f[n] === k[n]) n++;
    const ok = k.includes(' ') ? f.includes(k) || (f.includes(' ') && k.includes(f)) : k.length < 4 ? f.startsWith(k) && f.length <= k.length + 2 : n >= 4 && n >= .6 * Math.min(f.length, k.length);
    if (ok && n >= bestN) { best = w; bestN = n; }
  }
  return best ? best.w.toLowerCase() : '';
}
function textSentences(l, w) {
  const out = [];
  for (const tx of l.texts || []) for (const s of sent(tx, l.lang).split(/(?<=[.!?])\s+/)) {
    let hit = 0;
    const x = s.replace(MARK, (m, f, h) => { if (!hit && resolveHead(l, f, h) === w.w.toLowerCase()) { hit = 1; return '*' + f + '*'; } return f; });
    if (hit) out.push(x);
  }
  return out;
}
const sentences = (l, w) => [...(w.ex || []).map(x => sent(x, l.lang)), ...(w.col || []).map(x => sent(x, l.lang)), ...textSentences(l, w)].filter(s => s && (s.match(/\*/g) || []).length === 2);
/* escape the pieces between *marks* separately, so apostrophes and accents survive */
function withMarks(raw, onMark) { const re = new RegExp(MARK.source, 'g'); let out = '', last = 0, m; while ((m = re.exec(raw))) { out += esc(raw.slice(last, m.index)) + onMark(m[1], m[2]); last = m.index + m[0].length; } return out + esc(raw.slice(last)); }
const BLANK = '<span class="blank"></span>';
const blankOut = (def, word) => esc(def).replace(/\*[^*]+\*/g, BLANK).replace(new RegExp('(?<![\\p{L}\\p{N}])' + reEsc(esc(word)) + '[\\p{L}]*', 'giu'), BLANK);

function wordCard(l, w, full) {
  let h = `<div class="center">${w.emoji ? `<div class="emo">${esc(w.emoji)}</div>` : ''}<div class="big">${esc(w.w)}</div>
  <span class="pos">${esc(w.pos)}</span> <span class="mut">${esc(w.ipa || '')}</span> <span class="spk" data-speak="${esc(w.w)}" role="button" aria-label="Listen">🔊</span>
  <div class="ar" style="text-align:center;font-size:30px;font-weight:700">${esc(w.ar)}</div></div>
  <p>${fm(w.def)}</p>`;
  if (w.note) h += `<div class="box note">${esc(w.note)}</div>`;
  if (!full) return h;
  const gram = [['gender', w.gender], ['forms', w.forms], ['pattern', w.pattern]].filter(x => x[1]).map(([k, v]) => `<div><b>${t(k)}:</b> ${esc(v)}</div>`).join('');
  if (gram) h += `<div class="box gram">${gram}</div>`;
  if (G.where !== 'cols') h += ygBtn(w.yg || w.w, t('videos_for', { w: esc(w.w) }));
  if ((w.ex || []).length) h += `<div class="tag">${t('examples')}</div>` + w.ex.map(x => `<div class="box">${fm(sent(x, l.lang))}<div class="ar">${esc(x.ar || '')}</div></div>`).join('');
  if ((w.col || []).length) h += `<div class="tag">${t('collocations')}</div>` + w.col.map(c => {
    const q = colParse(c.p), ex = sent(c, l.lang);
    return `<div class="box"><div><b>${fm(q.p)}</b>${q.kind ? ` <span class="tagc">${esc(q.kind)}</span>` : ''}${q.reg ? ` <span class="tagc">${esc(q.reg)}</span>` : ''}</div>${c.p_ar ? `<div class="ar" style="font-size:18px">${esc(c.p_ar)}</div>` : ''}${ex ? `<div class="mut" style="font-style:italic">${fm(ex)}</div>` : ''}${c.ar ? `<div class="ar" style="font-size:18px">${esc(c.ar)}</div>` : ''}${G.where !== 'words' ? `<div>${ygBtn(c.yg || q.p)}</div>` : ''}</div>`;
  }).join('');
  const ts = textSentences(l, w);
  if (ts.length) h += `<div class="tag">${t('in_texts')}</div>` + ts.map(s => `<div class="box">${fm(s)}</div>`).join('');
  if ((w.family || []).length) h += `<div class="tag">${t('family')}</div>` + w.family.map(f => { const q = f.replace(/\s*\(.*?\)\s*/g, ' ').trim(); return `<button class="chip fam" data-q="${enc(q)}"><span class="ygi">🎬 </span>${esc(f)}</button>`; }).join('') + '<div class="famyg"></div>';
  return h;
}
const crumbsFor = (l, last) => [[t('home'), '#/'], l.group ? [groupLabel(l.group), '#/g/' + enc(l.group)] : null, last ? [l.title, '#/l/' + l.id] : [l.title], last ? [last] : null].filter(Boolean);

/* ---------- home ---------- */
async function home() {
  crumbs([]);
  const idx = await getIndex(); await getCatalog(); buildPR();
  const L = G.course, mine = idx.filter(e => e.lang === L), due = mine.reduce((a, e) => a + stat(e).due, 0), seen = mine.reduce((a, e) => a + stat(e).seen, 0);
  const last = G.last && G.last.lang === L && mine.find(e => e.id === G.last.id) ? G.last : null;
  app.innerHTML = `<h1>${LANGS[L].flag} ${t('lists')}</h1>
  ${last ? `<a class="card cont" href="#/l/${last.id}${last.mode ? '/' + last.mode + '/' + last.i : ''}"><div class="mut">${t('cont')}</div><h2>${esc(last.title)}</h2><div class="mut">${seen} ${t('words')} · <span class="${due ? 'good' : ''}">${due} ${t('due')}</span></div></a>` : ''}
  <a class="card cont" href="#/today"><div class="mut">${pt('today')}</div><h2>${due} ${t('due')} · +10 ${t('words')}</h2></a>
  <input class="ans" id="q" type="search" placeholder="${esc(t('search'))}" style="text-align:left" autocomplete="off"><div id="hits"></div><div id="lists"></div>
  <div class="row"><button class="btn alt" id="editmode"></button><a class="btn alt" href="#/upload">${t('upload')}</a></div><div id="orph"></div>`;
  let tok = 0;
  const words = async q => {
    const my = ++tok, el = document.getElementById('hits'); if (q.length < 2) { el.innerHTML = ''; return; }
    const data = await getSearch(); if (my !== tok) return;
    const titles = Object.fromEntries(idx.map(e => [e.id, e.title])), g = {}; let exact = false; const nq = nz(q);
    for (const e of data) {
      if ((e.lg || 'en') !== L) continue;
      const wl = nz(e.w); let sc = 0;
      if (wl === nq) { sc = 5; exact = true; } else if (wl.startsWith(nq)) sc = 3; else if (wl.includes(nq)) sc = 2;
      else if ((e.ar || '').includes(q) || nz(e.def).includes(nq) || e.c.some(c => nz(c[0]).includes(nq) || (c[1] || '').includes(q))) sc = 1;
      if (!sc) continue; const k = wl + '|' + e.pos, x = g[k] = g[k] || { e, sc, at: [] }; x.sc = Math.max(x.sc, sc); x.at.push(e);
    }
    const rows = Object.values(g).sort((a, b) => b.sc - a.sc || a.e.w.localeCompare(b.e.w)).slice(0, 20);
    let h = '';
    if (rows.length) h += `<div class="tag">${t('words_h')}</div>` + rows.map(r => `<div class="card slim"><b>${esc(r.e.w)}</b> <span class="pos">${esc(r.e.pos)}</span> <span class="ar" style="font-size:18px">${esc(r.e.ar)}</span>
      <div class="mut">${t('appears_in')}: ${r.at.map(a => `<a class="chip" href="#/l/${a.l}/study/${a.i}">${esc(titles[a.l] || a.l)}</a>`).join('')}</div></div>`).join('');
    if (!exact) h += `<div class="card slim"><span class="mut">${esc(t('not_headword', { q }))}</span><div>${ygBtn(q, esc(t('watch', { q })))}</div></div>`;
    el.innerHTML = h;
  };
  const draw = () => {
    const raw = document.getElementById('q').value.trim(), q = nz(raw); words(raw);
    const Lst = document.getElementById('lists');
    if (q) { Lst.innerHTML = mine.filter(e => nz(e.title + ' ' + (e.group || '') + ' ' + (e.set || '')).includes(q)).map(partCard).join(''); return; }
    const T = tree(idx, L);
    if (!T.size) { Lst.innerHTML = `<p class="mut">${t('no_lists_lang')}</p>`; return; }
    Lst.innerHTML = '<div class="grid">' + [...T].map(([g, m]) => {
      const sets = [...m.values()], parts = sets.flat(), tt = sum(parts), started = sets.filter(a => a.length).length;
      return `<a class="card gc" href="#/g/${enc(g)}"><div class="gi">${groupIcon(g)}</div><h2>${esc(groupLabel(g))}${srcBadge(g)}</h2>
        <div class="mut">${t('topics_started', { a: started, b: sets.length })}</div><div class="mut">${parts.length} ${parts.length === 1 ? t('part') : t('parts')} · ${tt.count} ${t('words')}</div>
        <div class="${tt.due ? 'good' : 'mut'}">${tt.due} ${t('due')}</div>${bar(tt.seen, tt.count)}</a>`;
    }).join('') + '</div>';
  };
  document.getElementById('q').oninput = draw; draw();
  const em = document.getElementById('editmode'), orph = () => { const o = document.getElementById('orph'); o.innerHTML = ''; if (EDITMODE) orphanCards().then(h => { if (document.getElementById('orph') === o) o.innerHTML = h; }); };
  const lab = () => em.textContent = EDITMODE ? t('done_edit') : t('edit'); lab(); orph();
  em.onclick = () => { EDITMODE = !EDITMODE; lab(); draw(); orph(); };
}

/* ---------- category page: topics -> parts ---------- */
let GF = { q: '', f: 'all' };
async function groupView(g) {
  const idx = await getIndex(); await getCatalog(); buildPR();
  let T = tree(idx, G.course), m = T.get(g);
  if (!m) { const other = Object.keys(LANGS).find(l => tree(idx, l).has(g)); if (other) { useLang(other); T = tree(idx, G.course); m = T.get(g); } }
  if (!m) { crumbs([[t('home'), '#/']]); app.innerHTML = `<p class="mut">${t('unknown_cat')}</p>`; return; }
  crumbs([[t('home'), '#/'], [groupLabel(g)]]);
  const topics = () => [...m].filter(([name, parts]) => {
    const s = sum(parts);
    return (!GF.q || nz(name).includes(nz(GF.q))) && (GF.f === 'all' || (GF.f === 'started' && parts.length) || (GF.f === 'due' && s.due));
  }).map(([name, parts]) => {
    const tt = sum(parts), next = Math.max(0, ...parts.map(p => p.part || 0)) + 1, exp = expectedWords(g, name);
    const sub = parts.length ? `${parts.length} ${parts.length > 1 ? t('parts') : t('part')} · ${tt.count} ${t('words')} · <span class="${tt.due ? 'good' : ''}">${tt.due} ${t('due')}</span>` : `${t('not_started')}${exp ? ' · ' + t('expected', { n: exp }) : ''}`;
    return `<div class="card slim${parts.length ? '' : ' empty'}"><h2>${esc(name)}</h2><div class="mut">${sub}</div>${parts.length ? bar(tt.seen, tt.count) : ''}
      <div>${parts.map(p => { const s = stat(p); return `<a class="chip" href="#/l/${p.id}">${esc(partLabel(p))}${s.due ? ' · ' + s.due : ''}${s.count && s.seen >= s.count && !s.due ? ' ✓' : ''}</a>`; }).join('')}
      <a class="chip faint" href="#/upload/${enc(g === 'Other' ? '' : g)}/${enc(name)}">+ ${cap(t('part'))} ${next}</a></div>
      ${EDITMODE ? parts.map(p => `<div class="mut" style="margin-top:6px">${esc(p.file)}</div>` + listTools(p.file)).join('') : ''}</div>`;
  }).join('') || `<p class="mut">${t('no_topics')}</p>`;
  app.innerHTML = `<div class="strip">${[...T.keys()].map(k => `<a class="chip${k === g ? ' on' : ''}" href="#/g/${enc(k)}">${groupIcon(k)} ${esc(groupLabel(k))}</a>`).join('')}</div>
  <h1>${groupIcon(g)} ${esc(groupLabel(g))}${srcBadge(g)}</h1>
  <input class="ans" id="gq" type="search" placeholder="${esc(t('filter_topics'))}" value="${esc(GF.q)}" style="text-align:left" autocomplete="off">
  <div class="seg lg" id="gf">${[['all', 'f_all'], ['started', 'f_started'], ['due', 'f_due']].map(([k, l]) => `<button data-f="${k}" class="${GF.f === k ? 'on' : ''}">${t(l)}</button>`).join('')}</div>
  <div id="topics">${topics()}</div>
  <div class="row"><button class="btn alt" id="editmode">${EDITMODE ? t('done_edit') : t('edit')}</button><a class="btn alt" href="#/upload/${enc(g === 'Other' ? '' : g)}">${t('add_part')}</a></div>`;
  const redraw = () => { document.getElementById('topics').innerHTML = topics(); };
  document.getElementById('gq').oninput = e => { GF.q = e.target.value; redraw(); };
  document.querySelectorAll('#gf button').forEach(b => b.onclick = () => { GF.f = b.dataset.f; document.querySelectorAll('#gf button').forEach(x => x.classList.toggle('on', x === b)); redraw(); });
  document.getElementById('editmode').onclick = () => { EDITMODE = !EDITMODE; groupView(g); };
}

/* ---------- one list ---------- */
async function listMenu(id) {
  const l = await getList(id); useLang(l.lang); buildPR(); await getCatalog();
  crumbs(crumbsFor(l));
  const idx = await getIndex(), sibs = idx.filter(e => e.lang === l.lang && e.group === l.group && e.set === l.set && l.set).sort((a, b) => (a.part || 0) - (b.part || 0));
  const si = sibs.findIndex(e => e.id === id), prev = si > 0 ? sibs[si - 1] : null, next = si >= 0 && si < sibs.length - 1 ? sibs[si + 1] : null;
  const due = l.words.filter(w => isDue(l, w)).length, seen = l.words.filter(w => st(l, w)).length;
  const step = (n, h, d, btns) => `<div class="card step"><div class="num">${n}</div><div><h2>${h}</h2>${d ? `<p class="mut">${d}</p>` : ''}${btns}</div></div>`;
  app.innerHTML = `<h1>${esc(l.title)}</h1><div class="ar" style="text-align:left;direction:ltr;margin-bottom:8px">${esc(l.title_ar || '')}</div>
  ${sibs.length > 1 ? `<div class="tag">${t('other_parts')}</div><div class="strip">${sibs.map(e => `<a class="chip${e.id === id ? ' on' : ''}" href="#/l/${e.id}">${esc(partLabel(e))}</a>`).join('')}</div>` : ''}
  ${step(1, t('learn'), t('learn_d'), `<a class="btn" href="#/l/${id}/study/0">${t('start_learning')}</a>`)}
  ${(l.texts || []).length ? step(2, t('read'), '', l.texts.map((x, i) => `<a class="btn alt" href="#/l/${id}/text/${i}">${esc(x.title || t('text') + ' ' + (i + 1))}</a>`).join('')) : ''}
  ${step(3, pt('practice'), pt('practice_d'), `<a class="btn" href="#/l/${id}/practice">${pt('start_practice')}</a><a class="btn alt" href="#/l/${id}/review">${pt('review_due')} (${due})</a>`)}
  <div class="card"><h2>${t('words_h')}</h2>${l.words.map((w, i) => `<a class="chip" href="#/l/${id}/study/${i}">${esc(w.w)}</a>`).join('')}
  <p><button class="btn alt" id="reset">${t('reset')}</button></p></div>
  ${prev || next ? `<div class="nav">${prev ? `<a class="btn alt" href="#/l/${prev.id}">${t('prev_part')}</a>` : '<span></span>'}${next ? `<a class="btn" href="#/l/${next.id}">${t('next_part')}</a>` : '<span></span>'}</div>` : ''}`;
  document.getElementById('reset').onclick = () => { if (confirm(t('reset_confirm'))) { Object.keys(S).filter(k => k.startsWith(id + '::')).forEach(k => delete S[k]); save(); route(); } };
  setLast(id, '', 0, l.title);
}
async function study(id, i) {
  const l = await getList(id); useLang(l.lang); const n = l.words.length; i = Math.max(0, Math.min(n - 1, i)); const w = l.words[i];
  crumbs(crumbsFor(l, (i + 1) + ' / ' + n));
  app.innerHTML = `${bar(i + 1, n)}<div class="mut" style="margin-top:6px">${i + 1} / ${n}</div>
  <div class="card">${wordCard(l, w, true)}</div>
  <div class="nav"><a class="btn alt" ${i ? `href="#/l/${id}/study/${i - 1}"` : 'style="visibility:hidden"'}>${t('back')}</a>
  <select class="jump" id="jump" aria-label="${esc(t('jump'))}">${l.words.map((x, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${k + 1}. ${esc(x.w)}</option>`).join('')}</select>
  ${i < n - 1 ? `<a class="btn" href="#/l/${id}/study/${i + 1}">${t('next')}</a>` : `<a class="btn" href="#/l/${id}/practice">${t('start_flash')}</a>`}</div>`;
  document.getElementById('jump').onchange = e => { location.hash = `#/l/${id}/study/${e.target.value}`; };
  KEYS = { ArrowLeft: () => i && (location.hash = `#/l/${id}/study/${i - 1}`), ArrowRight: () => { location.hash = i < n - 1 ? `#/l/${id}/study/${i + 1}` : `#/l/${id}/practice`; } };
  setLast(id, 'study', i, l.title);
}
async function textView(id, ti) {
  const l = await getList(id); useLang(l.lang); const tx = l.texts[ti], ttl = tx.title || t('text') + ' ' + (ti + 1);
  crumbs(crumbsFor(l, ttl));
  const para = s => (s || '').split(/\n\s*\n/).map(p => `<p>${withMarks(p, (f, h) => `<span class="tw" data-w="${esc(resolveHead(l, f, h))}">${esc(f)}</span>`)}</p>`).join('');
  app.innerHTML = `<h1>${esc(ttl)}</h1>
  <div class="card text">${para(sent(tx, l.lang))}</div>
  ${tx.ar ? `<button class="btn alt arbtn" id="tgl">${t('toggle_ar')}</button><div id="tr" class="card ar" style="display:none">${esc(tx.ar).replace(/\n\s*\n/g, '<br><br>')}</div>` : ''}
  <p class="mut">${t('tap_word')}</p><div id="pop"></div>
  <div class="nav">${ti ? `<a class="btn alt" href="#/l/${id}/text/${ti - 1}">${t('prev')}</a>` : '<span></span>'}${ti < l.texts.length - 1 ? `<a class="btn" href="#/l/${id}/text/${ti + 1}">${t('next_text')}</a>` : `<a class="btn" href="#/l/${id}/practice">${t('flashcards_arrow')}</a>`}</div>`;
  const tg = document.getElementById('tgl'); if (tg) tg.onclick = () => { const x = document.getElementById('tr'); x.style.display = x.style.display === 'none' ? 'block' : 'none'; };
  app.querySelectorAll('.tw').forEach(el => el.onclick = () => { const w = l.words.find(x => x.w.toLowerCase() === el.dataset.w); if (w) document.getElementById('pop').innerHTML = '<div class="card">' + wordCard(l, w, false) + '</div>'; });
  setLast(id, 'text', ti, l.title);
}

/* ---------- review: retrieval first, then reveal, then self-grade ---------- */

/* ---------- settings ---------- */
function settings() {
  crumbs([[t('home'), '#/'], [t('settings')]]);
  const sel = (k, opts) => `<select class="ans" data-k="${k}">${opts.map(([v, tx]) => `<option value="${v}"${String(G[k]) === String(v) ? ' selected' : ''}>${tx}</option>`).join('')}</select>`;
  app.innerHTML = `<h1>${t('settings')}</h1>
  <div class="card"><h2>${t('language')}</h2><div class="tag">${t('course')}</div>${sel('course', Object.entries(LANGS).map(([k, v]) => [k, v.flag + ' ' + v.name]))}
  <div class="tag">${t('iface')}</div>${sel('ui', [['auto', t('ui_auto')], ['en', 'English'], ['fr', 'Français']])}</div>
  <div class="card"><h2>${t('appearance')}</h2><div class="tag">${t('theme')}</div>${sel('theme', [['auto', t('th_auto')], ['light', t('th_light')], ['dark', t('th_dark')]])}<div class="tag">${t('arabic')}</div>${sel('hideAr', [[false, t('show_ar')], [true, t('hide_ar')]])}<div class="tag">${t('videos_s')}</div>${sel('videos', [[true, t('show_v')], [false, t('hide_v')]])}</div>
  <div class="card"><h2>${t('yg_h')}</h2>
  <div class="tag">${t('yg_n')}</div>${sel('n', [[1, '1'], [3, '3'], [5, '5']])}
  <div class="tag">${t('yg_acc')}</div>${sel('acc', [['us', t('us')], ['uk', t('uk')], ['aus', t('aus')], ['all', t('any')]])}
  <div class="tag">${t('yg_auto')}</div>${sel('auto', [[false, t('off')], [true, t('on')]])}
  <div class="tag">${t('yg_where')}</div>${sel('where', [['both', t('w_both')], ['words', t('w_words')], ['cols', t('w_cols')]])}
  <p class="mut">${t('yg_note')}</p></div>
  <div class="card"><h2>${t('data')}</h2><button class="btn alt" id="clean">${t('clean')}</button></div>`;
  document.getElementById('clean').onclick = cleanProgress;
  app.querySelectorAll('select').forEach(s => s.onchange = () => {
    const k = s.dataset.k; G[k] = k === 'n' ? +s.value : (k === 'auto' || k === 'hideAr' || k === 'videos') ? s.value === 'true' : s.value;
    saveG(); applyUI(); if (k === 'course' || k === 'ui') settings();
  });
}

/* ---------- router ---------- */
async function route() {
  KEYS = null;
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (!p.length) await home();
    else if (p[0] === 'settings') settings();
    else if (p[0] === 'upload') uploadView(decodeURIComponent(p[1] || ''), decodeURIComponent(p[2] || ''));
    else if (p[0] === 'g') await groupView(decodeURIComponent(p[1] || ''));
    else if (p[0] === 'l' && p.length === 2) await listMenu(p[1]);
    else if (p[0] === 'l' && p[2] === 'study') await study(p[1], +p[3] || 0);
    else if (p[0] === 'l' && p[2] === 'text') await textView(p[1], +p[3] || 0);
    else if (p[0] === 'l' && (p[2] === 'review' || p[2] === 'practice')) await practice(p[1], p[2]);
    else if (p[0] === 'today') await today(p[1]);
    else await home();
    window.scrollTo(0, 0);
  } catch (e) { crumbs([[t('home'), '#/']]); app.innerHTML = '<div class="card bad">' + esc(e.message) + '<br><span class="mut">' + t('serve_hint') + '</span></div>'; }
}
addEventListener('hashchange', route)
applyUI(); route();
