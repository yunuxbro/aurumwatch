export const UNIT_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

export function calculateClosedMeshVolume(positions, indices, scaleToMm = 1) {
  if (!positions || positions.length < 9 || positions.length % 3 !== 0) {
    return { closed: false, volumeMm3: null, reason: "No usable triangle geometry was found." };
  }

  const vertexCount = positions.length / 3;
  const triangleIndices = indices
    ? Array.from(indices)
    : Array.from({ length: vertexCount }, (_, index) => index);
  if (triangleIndices.length < 3 || triangleIndices.length % 3 !== 0) {
    return { closed: false, volumeMm3: null, reason: "The model has invalid triangle indices." };
  }

  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Number(positions[index + axis]);
      if (!Number.isFinite(value)) {
        return { closed: false, volumeMm3: null, reason: "The model contains non-finite coordinates." };
      }
      bounds[axis] = Math.min(bounds[axis], value);
      bounds[axis + 3] = Math.max(bounds[axis + 3], value);
    }
  }

  const span = Math.max(
    bounds[3] - bounds[0],
    bounds[4] - bounds[1],
    bounds[5] - bounds[2],
  );
  if (!Number.isFinite(scaleToMm) || scaleToMm <= 0 || span <= 0) {
    return { closed: false, volumeMm3: null, reason: "The model has invalid dimensions or units." };
  }

  const tolerance = Math.max(span * 1e-8, 1e-9);
  const vertexKeys = new Map();
  const keyForVertex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      throw new RangeError("The model contains an out-of-range vertex index.");
    }
    const offset = index * 3;
    const key = [0, 1, 2]
      .map((axis) => Math.round(Number(positions[offset + axis]) / tolerance))
      .join(",");
    if (!vertexKeys.has(key)) vertexKeys.set(key, vertexKeys.size);
    return vertexKeys.get(key);
  };

  const edges = new Map();
  let signedVolume = 0;
  const origin = [
    (bounds[0] + bounds[3]) / 2,
    (bounds[1] + bounds[4]) / 2,
    (bounds[2] + bounds[5]) / 2,
  ];

  for (let index = 0; index < triangleIndices.length; index += 3) {
    const [ia, ib, ic] = triangleIndices.slice(index, index + 3);
    const aId = keyForVertex(ia);
    const bId = keyForVertex(ib);
    const cId = keyForVertex(ic);
    if (aId === bId || bId === cId || cId === aId) {
      return { closed: false, volumeMm3: null, reason: "The model contains degenerate triangles." };
    }

    for (const [from, to] of [[aId, bId], [bId, cId], [cId, aId]]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const edge = edges.get(key) || { count: 0, direction: 0 };
      edge.count += 1;
      edge.direction += from < to ? 1 : -1;
      edges.set(key, edge);
    }

    const a = [0, 1, 2].map((axis) => positions[ia * 3 + axis] - origin[axis]);
    const b = [0, 1, 2].map((axis) => positions[ib * 3 + axis] - origin[axis]);
    const c = [0, 1, 2].map((axis) => positions[ic * 3 + axis] - origin[axis]);
    signedVolume += (
      a[0] * (b[1] * c[2] - b[2] * c[1]) +
      a[1] * (b[2] * c[0] - b[0] * c[2]) +
      a[2] * (b[0] * c[1] - b[1] * c[0])
    ) / 6;
  }

  if ([...edges.values()].some((edge) => edge.count !== 2 || edge.direction !== 0)) {
    return {
      closed: false,
      volumeMm3: null,
      reason: "The model is open or non-manifold; close/fix the mesh before using its volume.",
    };
  }

  const volumeMm3 = Math.abs(signedVolume) * scaleToMm ** 3;
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) {
    return { closed: false, volumeMm3: null, reason: "The model has no measurable enclosed volume." };
  }
  return { closed: true, volumeMm3, reason: null };
}
