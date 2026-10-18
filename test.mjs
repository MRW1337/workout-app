import assert from 'node:assert/strict';
import { b64encode, b64decode, mainLines, nextGoal, formatEntry, appendEntry, splitEntries, lastEntryFor } from './core.js';

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
assert.deepEqual(
  mainLines('X\n\nOpvarmning\nw\n\nSkill: one-arm (10 min)\nOAHS — 4×5\n\nHoveddel\nHSPU — 4×3\n\nNæste mål\ng\n'),
  ['OAHS — 4×5', 'HSPU — 4×3'],
);

const linear = 'PULL — TUNG\n\nOPVARMNING\n• Pull-ups 2×5\n\n1. WEIGHTED PULL-UPS — TUNG\nVægt:    40 kg\nSæt:     1 × 3–4\nMål:     40 kg × 4\nNæste:   42,5 kg × 3\n\n2. FRONT LEVER\nVægt:    Advanced tuck\n';
assert.deepEqual(mainLines(linear), [
  '1. WEIGHTED PULL-UPS — TUNG',
  'Vægt:    40 kg',
  'Sæt:     1 × 3–4',
  '',
  '2. FRONT LEVER',
  'Vægt:    Advanced tuck',
]);
assert.equal(nextGoal(linear), 'Weighted pull-ups — tung: 40 kg × 4');

assert.equal(
  formatEntry({ date: '2026-10-17', start: '10:00', end: '11:05', workout: 'pull-tung', place: 'PureGym ', body: '\n A — 1\n\n\n\n B — 2 \n\n' }),
  '17-10-2026 | 10.00–11.05 | pull-tung | PureGym\n\nA — 1\n\nB — 2',
);
assert.equal(formatEntry({ date: '2026-10-17', start: '', end: '', workout: 'zone2-loeb', place: '', body: 'x' }), '17-10-2026 | — | zone2-loeb\n\nx');

assert.equal(appendEntry('head\nlast line', 'new'), 'head\nlast line\n\nnew\n');
assert.equal(appendEntry('head\n\n\n', 'new\n'), 'head\n\nnew\n');

const log = 'Skabelon:\nDato | Tid\n\n12-10-2026 | a\n\nx\n\n13-10-2026 | b\n\ny';
assert.deepEqual(splitEntries(log), ['13-10-2026 | b\n\ny', '12-10-2026 | a\n\nx']);

const log2 = 'Skabelon:\nDato | Tid | Træning\n\n14-10-2026 | — | pull-tung\n\nold\n\n15-10-2026 | — | push | Gym\n\np\n\n17-10-2026 | 10.30 | pull-tung\n\nnew';
assert.equal(lastEntryFor(log2, 'pull-tung'), '17-10-2026 | 10.30 | pull-tung\n\nnew');
assert.equal(lastEntryFor(log2, 'push'), '15-10-2026 | — | push | Gym\n\np');
assert.equal(lastEntryFor(log2, 'zone2-loeb'), '');

console.log('all tests passed');
