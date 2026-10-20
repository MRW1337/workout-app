export const DEFAULTS = {
  owner: 'MRW1337',
  repo: 'personal_development',
  branch: 'main',
  planDir: 'Calisthenics/calisthenics.workout.plan',
  logPath: 'Calisthenics/calisthenics.workout.log/log.txt',
};

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// Line above every log entry, so each workout is easy to find in the log file.
export const SEP = '═'.repeat(30);

export const isExerciseFile = (name) => name.endsWith('.log.txt');
export const sameName = (a, b) => a.trim().toUpperCase() === b.trim().toUpperCase();

// Plan and log format: an exercise starts with "1. NAME", followed by its lines until a blank line.
function exerciseBlocks(text) {
  const blocks = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^(\d+)\.\s+(.+)$/);
    if (m) {
      cur = { num: m[1], name: m[2], lines: [] };
      blocks.push(cur);
    } else if (!line) {
      cur = null;
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return blocks;
}

// Guideline file: goal, reserve and note for each exercise, by name.
export function planInfo(text) {
  return exerciseBlocks(text).map((b) => {
    const get = (k) => {
      const v = (b.lines.find((l) => l.startsWith(`${k}:`)) || '').slice(k.length + 1).trim();
      return v === '—' ? '' : v;
    };
    return { name: b.name, goal: get('Mål'), reserve: get('Reserve'), note: get('Noter') };
  });
}

// "V 30 kg × 4" → { side: 'V', load: '30 kg', n: '4', unit: '×' }; "Advanced tuck 6 sek." → unit 'sek.'
export function parseSet(line) {
  let s = line.trim();
  let side = '';
  const sm = s.match(/^([VH])\s+(.*)$/);
  if (sm) [, side, s] = sm;
  let m = s.match(/^(.*?)\s*×\s*(\d+)$/);
  if (m) return { side, load: m[1], n: m[2], unit: '×' };
  m = s.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*sek\.?$/);
  if (m) return { side, load: m[1], n: m[2], unit: 'sek.' };
  return { side, load: s, n: '', unit: '' };
}

export function formatSet({ side, load, n, unit }) {
  const k = String(n ?? '').trim();
  const amount = !k ? '' : unit === '×' ? `× ${k}` : unit === 'sek.' ? `${k} sek.` : '';
  return [side, load.trim(), amount].filter(Boolean).join(' ');
}

// Exercise file or log entry → [{ num, name, pause, note, sets }].
export function parseExercises(text) {
  return exerciseBlocks(text).map((b) => {
    const ex = { num: b.num, name: b.name, pause: '', note: '', sets: [] };
    for (const line of b.lines) {
      const kv = line.match(/^(Pause|Note):\s*(.*)$/);
      if (kv) ex[kv[1].toLowerCase()] = kv[2];
      else ex.sets.push(parseSet(line));
    }
    return ex;
  });
}

export function formatExercises(exercises) {
  return exercises
    .map((e) =>
      [`${e.num}. ${e.name.trim()}`, e.pause.trim() && `Pause: ${e.pause.trim()}`, ...e.sets.map(formatSet), e.note.trim() && `Note: ${e.note.trim()}`]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function formatEntry({ date, start, end, workout, place, body }) {
  const dot = (t) => t.replace(':', '.');
  const time = start && end ? `${dot(start)}–${dot(end)}` : start ? dot(start) : '—';
  const header = [formatDate(date), time, workout.trim() || '—'];
  if (place && place.trim()) header.push(place.trim());
  // Keep single blank lines between exercise blocks; drop the rest.
  const body2 = body.split(/\r?\n/).map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return `${SEP}\n${header.join(' | ')}\n\n${body2}`;
}

export const entryHeader = (entry) => entry.split('\n').find((l) => /^\d{2}-\d{2}-\d{4} \|/.test(l)) || '';

export function appendEntry(text, entry) {
  return `${text.replace(/\s+$/, '')}\n\n${entry.trim()}\n`;
}

// Log entries start with a "DD-MM-YYYY |" header line, with a SEP line above. Returns newest first, without SEP.
export function splitEntries(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^═{3,}[ \t]*$/gm, '')
    .split(/\n(?=\d{2}-\d{2}-\d{4} \|)/)
    .filter((chunk) => /^\d{2}-\d{2}-\d{4} \|/.test(chunk))
    .map((chunk) => chunk.trim())
    .reverse();
}

export function lastEntryFor(text, workout) {
  const name = workout.trim().toLowerCase();
  return splitEntries(text).find((e) => (e.split('\n')[0].split('|')[2] || '').trim().toLowerCase() === name) || '';
}

export function createClient({ token, owner, repo, branch }) {
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/`;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

  async function call(path, init = {}) {
    const url = base + enc(path) + (init.method ? '' : `?ref=${encodeURIComponent(branch)}&t=${Date.now()}`);
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).message || res.statusText;
      const err = new Error(`GitHub ${res.status}: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function getFile(path) {
    const data = await call(path);
    return { text: b64decode(data.content), sha: data.sha };
  }

  async function listDir(path) {
    const items = await call(path);
    return items.filter((i) => i.type === 'file').map((i) => i.name).sort();
  }

  async function putFile(path, text, sha, message) {
    return call(path, {
      method: 'PUT',
      body: JSON.stringify({ message, content: b64encode(text), sha, branch }),
    });
  }

  // Retries once if the file changed between read and write.
  async function appendToFile(path, entry, message) {
    for (let attempt = 0; ; attempt++) {
      const { text, sha } = await getFile(path);
      try {
        return await putFile(path, appendEntry(text, entry), sha, message);
      } catch (e) {
        if (attempt === 0 && (e.status === 409 || e.status === 422)) continue;
        throw e;
      }
    }
  }

  return { getFile, listDir, putFile, appendToFile };
}
