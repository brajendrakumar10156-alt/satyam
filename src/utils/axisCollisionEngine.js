export function resolveAxisCollisions(labels) {
  if (!labels || labels.length === 0) return [];

  // Clone to avoid mutating original objects if passed directly
  const sorted = labels.map(l => ({ ...l })).sort((a, b) => a.center - b.center);

  // Iterative Constraint Relaxation for 1D Bounding Boxes
  // This pushes overlapping labels apart smoothly.
  const iterations = 50;
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let j = 0; j < sorted.length - 1; j++) {
      const a = sorted[j];
      const b = sorted[j + 1];
      
      // Calculate gap between edges
      const minDistance = (a.size + b.size) / 2;
      const currentDistance = b.center - a.center;
      const overlap = minDistance - currentDistance;
      
      if (overlap > 0) {
        // Push apart
        const push = overlap / 2;
        a.center -= push;
        b.center += push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return sorted;
}
