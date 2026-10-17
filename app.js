import { DEFAULTS, createClient, mainLines, nextGoal, formatEntry, splitEntries, lastEntryFor, appendEntry } from './core.js';

const $ = (s) => document.querySelector(s);
const store = {
  get: (k, d) => JSON.parse(localStorage.getItem(k) ?? 'null') ?? d,
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const cfg = () => ({ ...DEFAULTS, ...store.get('cfg', {}) });
const client = () => createClient({ ...cfg(), token: store.get('token', '') });
const plans = new Map();
let logText = '';

function status(msg, kind = 'info') {
  const el = $('#status');
  el.hidden = !msg;
  el.textContent = msg || '';
  el.className = kind;
}

function show(tab) {
  document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== tab));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  status('');
  if (tab === 'history') loadHistory();
}

async function loadPlans() {
  const c = cfg();
  const names = (await client().listDir(c.planDir)).filter((n) => n.endsWith('.txt'));
  plans.clear();
  await Promise.all([
    ...names.map(async (n) => plans.set(n.replace(/\.txt$/, ''), (await client().getFile(`${c.planDir}/${n}`)).text)),
    client().getFile(c.logPath).then((f) => (logText = f.text), () => (logText = '')),
  ]);

  const list = $('#plan-list');
  list.replaceChildren();
  const select = $('#workout');
  select.replaceChildren();
  for (const name of [...plans.keys()].sort((a, b) => (a === 'oversigt' ? -1 : b === 'oversigt' ? 1 : a.localeCompare(b)))) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.onclick = () => openPlan(name);
    list.append(btn);
    if (name !== 'oversigt') select.append(new Option(name, name));
  }
  select.append(new Option('andet', 'andet'));
  restoreDraft();
  updateGoal();
}

function openPlan(name) {
  $('#plan-list').hidden = true;
  $('#plan-view').hidden = false;
  $('#plan-text').textContent = plans.get(name);
  $('#plan-log').hidden = name === 'oversigt';
  $('#plan-log').onclick = () => {
    $('#workout').value = name;
    updateGoal();
    prefill(false);
    show('log');
  };
}

function updateGoal() {
  const workout = $('#workout').value;
  const goal = nextGoal(plans.get(workout) || '');
  $('#goal').hidden = !goal;
  $('#goal').textContent = goal ? `Næste mål\n${goal}` : '';
  const last = workout === 'andet' ? '' : lastEntryFor(logText, workout);
  $('#last').hidden = workout === 'andet';
  $('#last').textContent = last ? `Sidste gang\n${last}` : 'Sidste gang\nIngen tidligere log med denne workout.';
}

function prefill(force) {
  const body = $('#log-form').body;
  if (body.value.trim() && !force && !confirm('Erstat det, du har skrevet?')) return;
  body.value = mainLines(plans.get($('#workout').value) || '').join('\n');
  saveDraft();
}

function saveDraft() {
  store.set('draft', Object.fromEntries(new FormData($('#log-form'))));
}

function restoreDraft() {
  const form = $('#log-form');
  const d = store.get('draft', {});
  for (const [k, v] of Object.entries(d)) if (form[k] && v) form[k].value = v;
  if (!form.date.value) form.date.value = new Date().toLocaleDateString('sv-SE');
  if (!form.place.value) form.place.value = store.get('lastPlace', '');
}

async function submitLog(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const entry = formatEntry(data);
  if (!confirm(`Gem dette i loggen?\n\n${entry}`)) return;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  status('Gemmer …');
  try {
    await client().appendToFile(cfg().logPath, entry, `Log: ${entry.split('\n')[0]}`);
    logText = appendEntry(logText, entry);
    updateGoal();
    store.set('lastPlace', data.place || '');
    localStorage.removeItem('draft');
    form.body.value = '';
    form.start.value = '';
    form.end.value = '';
    form.date.value = new Date().toLocaleDateString('sv-SE');
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
    updateGoal();
    list.replaceChildren(
      ...splitEntries(text).slice(0, 10).map((entry) => {
        const pre = document.createElement('pre');
        pre.textContent = entry;
        return pre;
      }),
    );
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
  updateGoal();
  saveDraft();
};
$('#prefill').onclick = () => prefill(false);
$('#log-form').oninput = saveDraft;
$('#log-form').onsubmit = submitLog;
$('#settings-form').onsubmit = saveSettings;

start();
