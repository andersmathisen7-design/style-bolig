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
