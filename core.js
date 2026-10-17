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

function sectionLines(text, headers) {
  const out = [];
  let on = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (headers.includes(line)) {
      on = true;
      continue;
    }
    if (!on) continue;
    if (line === '') {
      if (out.length) break;
      continue;
    }
    out.push(line);
  }
  return out;
}

// Lines to prefill the log form with: the main part of a plan.
export const mainLines = (text) => sectionLines(text, ['Hoveddel', 'Øvelser', 'Log']);
export const nextGoal = (text) => sectionLines(text, ['Næste mål']).join('\n');

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function formatEntry({ date, start, end, workout, place, body }) {
  const dot = (t) => t.replace(':', '.');
  const time = start && end ? `${dot(start)}–${dot(end)}` : start ? dot(start) : '—';
  const header = [formatDate(date), time, workout.trim() || '—'];
  if (place && place.trim()) header.push(place.trim());
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return `${header.join(' | ')}\n\n${lines.join('\n')}`;
}

export function appendEntry(text, entry) {
  return `${text.replace(/\s+$/, '')}\n\n${entry.trim()}\n`;
}

// Log entries start with a "DD-MM-YYYY |" header line. Returns newest first.
export function splitEntries(text) {
  return text
    .replace(/\r\n/g, '\n')
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
