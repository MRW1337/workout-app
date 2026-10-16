import assert from 'node:assert/strict';
import { b64encode, b64decode, mainLines, nextGoal, formatEntry, appendEntry, splitEntries } from './core.js';

const plan = `Pull — tung

Opvarmning
Pull-ups — 2×5

Hoveddel
Weighted pull-ups — 40 kg × 3
Front lever — 3×6 sek.

Næste mål
40 kg × 3; 30 kg × 5/5/5
`;

assert.equal(b64decode(b64encode('Træning æøå — ×')), 'Træning æøå — ×');
assert.deepEqual(mainLines(plan), ['Weighted pull-ups — 40 kg × 3', 'Front lever — 3×6 sek.']);
assert.equal(nextGoal(plan), '40 kg × 3; 30 kg × 5/5/5');
assert.deepEqual(mainLines('Løb\n\nLog\nTid — km — puls\n'), ['Tid — km — puls']);

assert.equal(
  formatEntry({ date: '2026-10-17', start: '10:00', end: '11:05', workout: 'pull-tung', place: 'PureGym ', body: ' A — 1\n\n B — 2 \n' }),
  '17-10-2026 | 10.00–11.05 | pull-tung | PureGym\n\nA — 1\nB — 2',
);
assert.equal(formatEntry({ date: '2026-10-17', start: '', end: '', workout: 'zone2-loeb', place: '', body: 'x' }), '17-10-2026 | — | zone2-loeb\n\nx');

assert.equal(appendEntry('head\nlast line', 'new'), 'head\nlast line\n\nnew\n');
assert.equal(appendEntry('head\n\n\n', 'new\n'), 'head\n\nnew\n');

const log = 'Skabelon:\nDato | Tid\n\n12-10-2026 | a\n\nx\n\n13-10-2026 | b\n\ny';
assert.deepEqual(splitEntries(log), ['13-10-2026 | b\n\ny', '12-10-2026 | a\n\nx']);

console.log('all tests passed');
