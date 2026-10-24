import {
  DEFAULTS, createClient, formatEntry, entryHeader, splitEntries, lastEntryFor, appendEntry,
  isExerciseFile, sameName, planInfo, parseExercises, formatExercises, formatSet,
} from './core.js';

const $ = (s) => document.querySelector(s);
const store = {
  get: (k, d) => JSON.parse(localStorage.getItem(k) ?? 'null') ?? d,
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const cfg = () => ({ ...DEFAULTS, ...store.get('cfg', {}) });
const client = () => createClient({ ...cfg(), token: store.get('token', '') });
const plans = new Map();
const exFiles = new Map();
let logText = '';
let exercises = [];
let dirty = false;

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null && k !== '' && k !== false));
  return e;
}

function status(msg, kind = 'info') {
  const s = $('#status');
  s.hidden = !msg;
  s.textContent = msg || '';
  s.className = kind;
}

function show(tab) {
  document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== tab));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  status('');
  if (tab === 'history') loadHistory();
  if (tab === 'log' && !exercises.length && !$('#log-form').body.value.trim()) prefill(false);
}

async function loadPlans() {
  const c = cfg();
  const names = (await client().listDir(c.planDir)).filter((n) => n.endsWith('.txt'));
  plans.clear();
  exFiles.clear();
  await Promise.all([
    ...names.map(async (n) => {
      const { text } = await client().getFile(`${c.planDir}/${n}`);
      if (isExerciseFile(n)) exFiles.set(n.replace(/\.log\.txt$/, ''), text);
      else plans.set(n.replace(/\.txt$/, ''), text);
    }),
    client().getFile(c.logPath).then((f) => (logText = f.text), () => (logText = '')),
  ]);

  const list = $('#plan-list');
  list.replaceChildren();
  const select = $('#workout');
  select.replaceChildren();
  for (const name of [...plans.keys()].sort((a, b) => (a === 'oversigt' ? -1 : b === 'oversigt' ? 1 : a.localeCompare(b)))) {
    list.append(el('button', { textContent: name, onclick: () => openPlan(name) }));
    if (name !== 'oversigt') select.append(new Option(name, name));
  }
  select.append(new Option('andet', 'andet'));
  restoreDraft();
}

function openPlan(name) {
  $('#plan-list').hidden = true;
  $('#plan-view').hidden = false;
  $('#plan-text').textContent = plans.get(name);
  $('#plan-log').hidden = name === 'oversigt';
  $('#plan-log').onclick = () => {
    const changed = $('#workout').value !== name;
    $('#workout').value = name;
    if (changed || !exercises.length) prefill(true);
    const form = $('#log-form');
    const now = new Date();
    form.date.value = now.toLocaleDateString('sv-SE');
    form.start.value = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    form.end.value = '';
    saveDraft();
    updateTimer();
    show('log');
  };
}

function updateTimer() {
  const { date, start, end } = $('#log-form');
  const t = $('#timer');
  const from = date.value && start.value ? new Date(`${date.value}T${start.value}`) : null;
  const secs = from && !end.value ? Math.floor((Date.now() - from) / 1000) : -1;
  t.hidden = secs < 0;
  if (secs < 0) return;
  const p = (n) => String(n).padStart(2, '0');
  t.textContent = `Tid: ${p(Math.floor(secs / 3600))}:${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
}

function updateLast() {
  const workout = $('#workout').value;
  const last = workout === 'andet' ? '' : lastEntryFor(logText, workout);
  $('#last').hidden = workout === 'andet';
  $('#last pre').textContent = last || 'Ingen tidligere log med denne workout.';
}

function edited() {
  dirty = true;
  saveDraft();
}

function setRow(ex, s, j) {
  const kg = s.load.match(/^(\d+(?:[.,]\d+)?)\s*kg$/i);
  const load = el('input', {
    value: kg ? kg[1] : s.load,
    className: kg ? 'num' : 'load',
    inputMode: kg ? 'decimal' : 'text',
    oninput: () => {
      const v = load.value.trim();
      s.load = kg && /^\d+([.,]\d+)?$/.test(v) ? `${v} kg` : v;
    },
  });
  const n = s.unit && el('input', { value: s.n, className: 'num', inputMode: 'numeric', oninput: () => (s.n = n.value) });
  const remove = el('button', {
    type: 'button',
    className: 'icon',
    textContent: '✕',
    title: 'Fjern sæt',
    onclick: () => {
      ex.sets.splice(j, 1);
      renderCards();
      edited();
    },
  });
  return el('div', { className: 'set' },
    el('span', { className: 'idx', textContent: `${j + 1}` }),
    s.side && el('span', { className: 'tag', textContent: s.side }),
    load,
    kg && el('span', { className: 'tag', textContent: 'kg' }),
    s.unit === '×' && el('span', { className: 'tag', textContent: '×' }),
    n || '',
    s.unit === 'sek.' && el('span', { className: 'tag', textContent: 'sek.' }),
    remove,
  );
}

function card(ex, i, info, last) {
  const hint = [
    [info?.goal && `Mål: ${info.goal}`, info?.reserve && `Reserve: ${info.reserve}`].filter(Boolean).join(' · '),
    info?.note,
    last && `Sidst: ${[...last.sets.map(formatSet), last.note && `(${last.note})`].filter(Boolean).join(' · ')}`,
  ].filter(Boolean).join('\n');
  const field = (key, label) => el('label', {}, label, el('input', { value: ex[key], oninput: (e) => (ex[key] = e.target.value) }));
  return el('div', { className: 'card' },
    el('div', { className: 'card-head' },
      el('strong', { textContent: `${ex.num}. ${ex.name}` }),
      el('button', {
        type: 'button',
        className: 'icon',
        textContent: '✕',
        title: 'Fjern øvelse',
        onclick: () => {
          if (!confirm(`Fjern ${ex.name} fra loggen?`)) return;
          exercises.splice(i, 1);
          renderCards();
          edited();
        },
      }),
    ),
    hint && el('p', { className: 'hint', textContent: hint }),
    ...ex.sets.map((s, j) => setRow(ex, s, j)),
    el('button', {
      type: 'button',
      className: 'link',
      textContent: '+ sæt',
      onclick: () => {
        ex.sets.push({ ...(ex.sets.at(-1) || { side: '', load: '', n: '', unit: '×' }) });
        renderCards();
        edited();
      },
    }),
    el('div', { className: 'row' }, field('pause', 'Pause'), field('note', 'Note')),
  );
}

function renderCards() {
  const workout = $('#workout').value;
  const info = planInfo(plans.get(workout) || '');
  const last = parseExercises(workout === 'andet' ? '' : lastEntryFor(logText, workout));
  $('#cards').replaceChildren(
    ...exercises.map((ex, i) => card(ex, i, info.find((x) => sameName(x.name, ex.name)), last.find((x) => sameName(x.name, ex.name)))),
  );
}

function prefill(ask) {
  if (ask && dirty && !confirm('Erstat det, du har skrevet?')) return;
  exercises = parseExercises(exFiles.get($('#workout').value) || '');
  $('#log-form').body.value = '';
  dirty = false;
  renderCards();
  saveDraft();
}

function addExercise() {
  const name = prompt('Navn på øvelsen');
  if (!name || !name.trim()) return;
  const num = Math.max(0, ...exercises.map((e) => Number(e.num) || 0)) + 1;
  exercises.push({ num: String(num), name: name.trim().toUpperCase(), pause: '', note: '', sets: [{ side: '', load: '', n: '', unit: '×' }] });
  renderCards();
  edited();
}

function autosize() {
  const ta = $('#log-form').body;
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
}

function saveDraft() {
  autosize();
  store.set('draft', { ...Object.fromEntries(new FormData($('#log-form'))), exercises, dirty });
}

function restoreDraft() {
  const form = $('#log-form');
  const d = store.get('draft', {});
  for (const [k, v] of Object.entries(d)) if (form[k] && typeof v === 'string' && v) form[k].value = v;
  if (!form.date.value) form.date.value = new Date().toLocaleDateString('sv-SE');
  if (!form.place.value) form.place.value = store.get('lastPlace', '');
  exercises = Array.isArray(d.exercises) ? d.exercises : [];
  dirty = Boolean(d.dirty) || (!d.exercises && Boolean(d.body));
  updateLast();
  if (!exercises.length && !form.body.value.trim()) prefill(false);
  else renderCards();
  autosize();
  updateTimer();
}

async function submitLog(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const body = [formatExercises(exercises), data.body.trim()].filter(Boolean).join('\n\n');
  if (!body) {
    status('Der er intet at gemme.', 'error');
    return;
  }
  const entry = formatEntry({ ...data, body });
  if (!confirm(`Gem dette i loggen?\n\n${entry}`)) return;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  status('Gemmer …');
  try {
    await client().appendToFile(cfg().logPath, entry, `Log: ${entryHeader(entry)}`);
    logText = appendEntry(logText, entry);
    store.set('lastPlace', data.place || '');
    exercises = [];
    dirty = false;
    form.body.value = '';
    form.start.value = '';
    form.end.value = '';
    form.date.value = new Date().toLocaleDateString('sv-SE');
    localStorage.removeItem('draft');
    updateTimer();
    updateLast();
    renderCards();
    autosize();
    status('Gemt i loggen ✓', 'ok');
  } catch (err) {
    status(`Kunne ikke gemme. Dit udkast er gemt på telefonen. ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function loadHistory() {
  const list = $('#history-list');
  list.textContent = 'Henter …';
  try {
    const { text } = await client().getFile(cfg().logPath);
    logText = text;
    updateLast();
    list.replaceChildren(...splitEntries(text).slice(0, 10).map((entry) => el('pre', { textContent: entry })));
  } catch (err) {
    list.textContent = '';
    status(err.message, 'error');
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const { token, owner, repo, branch } = Object.fromEntries(new FormData(e.target));
  store.set('token', token.trim());
  store.set('cfg', { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() });
  await start();
}

function fillSettings() {
  const form = $('#settings-form');
  const c = cfg();
  form.token.value = store.get('token', '');
  form.owner.value = c.owner;
  form.repo.value = c.repo;
  form.branch.value = c.branch;
}

async function start() {
  fillSettings();
  if (!store.get('token', '')) {
    show('settings');
    status('Indsæt dit GitHub-token for at starte.');
    return;
  }
  status('Henter planer …');
  try {
    await loadPlans();
    show('plans');
  } catch (err) {
    show('settings');
    let who = '';
    try {
      const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${store.get('token', '')}` } });
      who = res.ok ? ` Tokenet tilhører kontoen "${(await res.json()).login}".` : ' Tokenet er ugyldigt eller udløbet.';
    } catch {}
    const hint = err.status === 404 ? ' Tokenet kan ikke se repoet. Vælg repoet under "Repository access", og giv "Contents: Read and write".' : '';
    status(`Kunne ikke hente planer. ${err.message}.${who}${hint}`, 'error');
  }
}

document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
$('#plan-back').onclick = () => {
  $('#plan-view').hidden = true;
  $('#plan-list').hidden = false;
};
$('#workout').onchange = () => {
  updateLast();
  prefill(true);
};
$('#prefill').onclick = () => prefill(true);
$('#add-ex').onclick = addExercise;
$('#log-form').oninput = (e) => {
  if (e.target.name === 'body' || e.target.closest('#cards')) edited();
  else saveDraft();
  updateTimer();
};
setInterval(updateTimer, 1000);
$('#log-form').onsubmit = submitLog;
$('#settings-form').onsubmit = saveSettings;

start();
