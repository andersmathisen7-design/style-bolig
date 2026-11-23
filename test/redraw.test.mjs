import test from 'node:test';
import assert from 'node:assert/strict';
import { clearFloor } from '../js/editor.js';
import { normalize, newState } from '../js/logic.js';

const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

test('«Tegn på nytt» tar bort alt på etasjen og lar de andre etasjene stå', () => {
  const s = {
    rooms: [
      { id: 'r1', type: 'stue', floor: 0, poly: sq(0, 0, 400, 400) },
      { id: 'r2', type: 'bad', floor: 0, poly: sq(400, 0, 200, 400) },
      { id: 'r3', type: 'soverom', floor: 1, poly: sq(0, 0, 400, 400) },
    ],
    furn: [{ id: 'f1', room: 'r1' }, { id: 'f2', room: 'r3' }],
    custom: [{ room: 'r2' }, { room: 'r3' }],
    openings: [{ id: 'o1', floor: 0 }, { id: 'o2', floor: 1 }],
    drawn: true, auto: true,
  };
  clearFloor(s, 0);
  assert.deepEqual(s.rooms.map((r) => r.id), ['r3']);
  assert.deepEqual(s.furn.map((f) => f.id), ['f2']);
  assert.deepEqual(s.custom.map((c) => c.room), ['r3']);
  assert.deepEqual(s.openings.map((o) => o.id), ['o2']);
  assert.equal(s.drawn, true);
  assert.equal(s.auto, undefined);
  clearFloor(s, 1);
  assert.equal(s.drawn, false);
});

test('en tegning laget av appen huskes som det etter lagring', () => {
  const s = { ...newState(), rooms: [{ id: 'r1', type: 'stue', size: 'M', m2: 16, wall: 400, poly: sq(0, 0, 400, 400) }], drawn: true, auto: true };
  assert.equal(normalize(JSON.parse(JSON.stringify(s))).auto, true);
  assert.equal(normalize(JSON.parse(JSON.stringify({ ...s, auto: undefined }))).auto, undefined);
});

test('en strek på tomt ark gjør arket til boligen, så streken kan dele den', async () => {
  const { sheetOutline } = await import('../js/editor.js');
  // loddrett strek fra kant til kant: hele arket
  assert.deepEqual(sheetOutline([[480, 0], [480, 1000]], 1000), [[50, 50], [950, 50], [950, 950], [50, 950]]);
  // vannrett strek fra 2 til 8 meter: boligen er så bred som streken, og hele arket på tvers
  assert.deepEqual(sheetOutline([[200, 500], [800, 500]], 1000), [[200, 50], [800, 50], [800, 950], [200, 950]]);
  // for kort strek: hele arket
  assert.deepEqual(sheetOutline([[450, 500], [550, 500]], 1500), [[80, 80], [1420, 80], [1420, 1420], [80, 1420]]);
});
