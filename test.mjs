import assert from 'node:assert/strict';
import {
  SEP, b64encode, b64decode, formatEntry, entryHeader, appendEntry, splitEntries, lastEntryFor,
  isExerciseFile, sameName, planInfo, parseSet, formatSet, parseExercises, formatExercises,
  formatDate, uniqueBase, photoNames, formatMeal,
} from './core.js';

assert.equal(b64decode(b64encode('Træning æøå — ×')), 'Træning æøå — ×');

assert.equal(isExerciseFile('pull-tung.log.txt'), true);
assert.equal(isExerciseFile('pull-tung.txt'), false);
assert.equal(sameName(' Front lever', 'FRONT LEVER'), true);

assert.deepEqual(parseSet('30 kg × 4'), { side: '', load: '30 kg', n: '4', unit: '×' });
assert.deepEqual(parseSet('V Kropsvægt × 6'), { side: 'V', load: 'Kropsvægt', n: '6', unit: '×' });
assert.deepEqual(parseSet('Advanced tuck 6 sek.'), { side: '', load: 'Advanced tuck', n: '6', unit: 'sek.' });
assert.deepEqual(parseSet('H Fri 1 sek.'), { side: 'H', load: 'Fri', n: '1', unit: 'sek.' });
assert.deepEqual(parseSet('Vægtskift 5 sek.'), { side: '', load: 'Vægtskift', n: '5', unit: 'sek.' });
assert.deepEqual(parseSet('40 min'), { side: '', load: '40 min', n: '', unit: '' });
for (const line of ['30 kg × 4', '17,5 kg × 10', 'V Vægtskift 5 sek.', 'Kropsvægt 15 sek.', 'km:', '40 min']) {
  assert.equal(formatSet(parseSet(line)), line);
}
assert.equal(formatSet({ side: '', load: '30 kg', n: '', unit: '×' }), '30 kg');

const exFile = '0. TEST — WEIGHTED PULL-UPS\n30 kg × 3\nNote:\n\n2. WEIGHTED PULL-UPS — BACK-OFF\nPause: 3 min\n30 kg × 4\n30 kg × 4\nNote:\n';
const exs = parseExercises(exFile);
assert.equal(exs.length, 2);
assert.deepEqual(exs[1], {
  num: '2', name: 'WEIGHTED PULL-UPS — BACK-OFF', pause: '3 min', note: '',
  sets: [parseSet('30 kg × 4'), parseSet('30 kg × 4')],
});

// Plan says 30 kg × 4, but the sets were 4@30, 3@30, 4@20, 1@30.
exs[1].sets = ['30 kg × 4', '30 kg × 3', '20 kg × 4', '30 kg × 1'].map(parseSet);
exs[1].note = ' tung dag ';
assert.equal(
  formatExercises(exs),
  '0. TEST — WEIGHTED PULL-UPS\n30 kg × 3\n\n2. WEIGHTED PULL-UPS — BACK-OFF\nPause: 3 min\n30 kg × 4\n30 kg × 3\n20 kg × 4\n30 kg × 1\nNote: tung dag',
);
assert.deepEqual(parseExercises(formatExercises(exs)), exs.map((e) => ({ ...e, note: e.note.trim() })));

const guide = 'PULL — TUNG\n\n1. WEIGHTED PULL-UPS — TUNG\nVægt:    40 kg\nReserve: 1\nNoter:   Skuldre ned.\nMål:     40 kg × 4\n\n2. PULL-UPS\nReserve: —\nMål:     —\n';
assert.deepEqual(planInfo(guide), [
  { name: 'WEIGHTED PULL-UPS — TUNG', goal: '40 kg × 4', reserve: '1', note: 'Skuldre ned.' },
  { name: 'PULL-UPS', goal: '', reserve: '', note: '' },
]);

const e1 = formatEntry({ date: '2026-10-17', start: '10:00', end: '11:05', workout: 'pull-tung', place: 'PureGym ', body: '\n A — 1\n\n\n\n B — 2 \n\n' });
assert.equal(e1, `${SEP}\n17-10-2026 | 10.00–11.05 | pull-tung | PureGym\n\nA — 1\n\nB — 2`);
assert.equal(entryHeader(e1), '17-10-2026 | 10.00–11.05 | pull-tung | PureGym');
assert.equal(formatEntry({ date: '2026-10-17', start: '', end: '', workout: 'zone2-loeb', place: '', body: 'x' }), `${SEP}\n17-10-2026 | — | zone2-loeb\n\nx`);

assert.equal(appendEntry('head\nlast line', 'new'), 'head\nlast line\n\nnew\n');
assert.equal(appendEntry('head\n\n\n', 'new\n'), 'head\n\nnew\n');

const log = 'Skabelon:\nDato | Tid\n\n12-10-2026 | a\n\nx\n\n13-10-2026 | b\n\ny';
assert.deepEqual(splitEntries(log), ['13-10-2026 | b\n\ny', '12-10-2026 | a\n\nx']);
const logSep = `Skabelon:\r\nDato | Tid\r\n\r\n${SEP}\r\n12-10-2026 | a\r\n\r\nx\r\n\r\n${SEP}\r\n13-10-2026 | b\r\n\r\ny\r\n`;
assert.deepEqual(splitEntries(logSep), ['13-10-2026 | b\n\ny', '12-10-2026 | a\n\nx']);
assert.deepEqual(splitEntries(appendEntry(logSep, e1))[0], e1.slice(SEP.length + 1));

const log2 = 'Skabelon:\nDato | Tid | Træning\n\n14-10-2026 | — | pull-tung\n\nold\n\n15-10-2026 | — | push | Gym\n\np\n\n17-10-2026 | 10.30 | pull-tung\n\nnew';
assert.equal(lastEntryFor(log2, 'pull-tung'), '17-10-2026 | 10.30 | pull-tung\n\nnew');
assert.equal(lastEntryFor(log2, 'push'), '15-10-2026 | — | push | Gym\n\np');
assert.equal(lastEntryFor(log2, 'zone2-loeb'), '');

assert.equal(formatDate('2026-10-27'), '27-10-2026');
assert.equal(uniqueBase('1235', []), '1235');
assert.equal(uniqueBase('1235', ['0800.txt', '1235-old.md']), '1235');
assert.equal(uniqueBase('1235', ['1235.jpg', '1235.2.jpg', '1235.txt']), '1235-2');
assert.equal(uniqueBase('1235', ['1235.txt', '1235-2.txt']), '1235-3');
assert.deepEqual(photoNames('1235', 0), []);
assert.deepEqual(photoNames('1235', 1), ['1235.jpg']);
assert.deepEqual(photoNames('1235-2', 3), ['1235-2.jpg', '1235-2.2.jpg', '1235-2.3.jpg']);
assert.equal(
  formatMeal({ date: '2026-10-27', time: '12:35', note: ' 150 g kylling ', weight: '81.4', photos: ['1235.jpg', '1235.2.jpg'] }),
  '27-10-2026 | 12.35\nBilleder: 1235.jpg, 1235.2.jpg\nVægt: 81,4 kg\nNote: 150 g kylling\n',
);
assert.equal(formatMeal({ date: '2026-10-27', time: '07:05', note: '', weight: '', photos: ['0705.jpg'] }), '27-10-2026 | 07.05\nBilleder: 0705.jpg\n');
assert.equal(formatMeal({ date: '2026-10-27', time: '07:05', note: '', weight: '81,2', photos: [] }), '27-10-2026 | 07.05\nVægt: 81,2 kg\n');

console.log('all tests passed');
