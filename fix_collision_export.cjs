const fs = require('fs');

let code = fs.readFileSync('src_demo/utils/axisCollisionEngine.js', 'utf8');

if (!code.includes('export function resolveAxisCollisions')) {
  const func = `
/**
 * Generic 1D AABB collision resolver for drawing labels
 * @param {Array} items - Array of objects with { center, size, ... }
 * @returns {Array} - Filtered array of non-overlapping items
 */
export function resolveAxisCollisions(items) {
  if (!items || items.length === 0) return [];
  
  // Sort by center position
  const sorted = [...items].sort((a, b) => a.center - b.center);
  
  const survivors = [];
  survivors.push(sorted[0]);
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = survivors[survivors.length - 1];
    
    // Check for 1D AABB overlap
    const prevTop = prev.center - prev.size / 2;
    const prevBottom = prev.center + prev.size / 2;
    const currTop = current.center - current.size / 2;
    const currBottom = current.center + current.size / 2;
    
    if (currTop < prevBottom) {
      // Overlap detected. Keep the first one for now (or apply priority logic)
      continue;
    }
    
    survivors.push(current);
  }
  
  return survivors;
}
`;
  code += func;
  fs.writeFileSync('src_demo/utils/axisCollisionEngine.js', code, 'utf8');
  console.log('Successfully added resolveAxisCollisions to axisCollisionEngine.js');
} else {
  console.log('resolveAxisCollisions already exists.');
}
