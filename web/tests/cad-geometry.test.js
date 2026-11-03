import assert from "node:assert/strict";
import test from "node:test";
import { calculateClosedMeshVolume, UNIT_TO_MM } from "../src/lib/cad-geometry.js";

const tetrahedronPositions = [
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];
const tetrahedronIndices = [
  0, 2, 1,
  0, 1, 3,
  0, 3, 2,
  1, 2, 3,
];

test("computes volume for a watertight mesh in the selected units", () => {
  const result = calculateClosedMeshVolume(tetrahedronPositions, tetrahedronIndices, UNIT_TO_MM.mm);

  assert.equal(result.closed, true);
  assert.ok(Math.abs(result.volumeMm3 - 1 / 6) < 1e-12);
});

test("converts model volume to cubic millimetres", () => {
  const result = calculateClosedMeshVolume(tetrahedronPositions, tetrahedronIndices, UNIT_TO_MM.cm);

  assert.ok(Math.abs(result.volumeMm3 - 1000 / 6) < 1e-10);
});

test("does not estimate volume for an open mesh", () => {
  const result = calculateClosedMeshVolume(tetrahedronPositions, tetrahedronIndices.slice(0, 9));

  assert.equal(result.closed, false);
  assert.equal(result.volumeMm3, null);
  assert.match(result.reason, /open or non-manifold/);
});
