/**
 * 🧮 Native WebGPU Mathematical Engine
 * Contains independent geometry and collision math for autonomous WebGPU drawing tools.
 */

/**
 * Calculates the shortest distance from a point to a line segment.
 * Used for native raycasting/hover detection over trendlines.
 * 
 * @param {Object} p - The mouse/pointer {x, y} coordinate
 * @param {Object} v - The start point {x, y} of the line
 * @param {Object} w - The end point {x, y} of the line
 * @returns {number} The distance in pixels from point to line segment
 */
export function distanceToSegmentSq(p, v, w) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const proj = {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  };
  
  return (p.x - proj.x) ** 2 + (p.y - proj.y) ** 2;
}

export function distanceToSegment(p, v, w) {
  return Math.sqrt(distanceToSegmentSq(p, v, w));
}

/**
 * Converts a 2D line segment into a thick Rectangular Quad (2 Triangles / 6 Vertices).
 * WebGPU line-list topology is strictly 1-pixel thin. To draw thick, stylized lines 
 * natively on the GPU, we mathematically expand the line segment into a polygon.
 * 
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} thickness - Line thickness in pixels
 * @returns {Array} Array of 6 {x, y} vertices representing the thick line
 */
export function lineToQuad(p1, p2, thickness = 2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];
  
  // Normalized perpendicular vector
  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);
  
  // 4 corners of the rotated rectangle
  const v1 = { x: p1.x + nx, y: p1.y + ny };
  const v2 = { x: p1.x - nx, y: p1.y - ny };
  const v3 = { x: p2.x - nx, y: p2.y - ny };
  const v4 = { x: p2.x + nx, y: p2.y + ny };
  
  // Return 2 triangles (6 vertices)
  return [v1, v2, v3, v3, v4, v1];
}

/**
 * Validates if a native WebGPU mouse click hit a drawn object.
 * @param {Array} drawings - Array of active logical drawings
 * @param {number} mouseX - Physical mouse X
 * @param {number} mouseY - Physical mouse Y
 * @param {function} px - Logical time to Physical X mapping function
 * @param {function} py - Logical price to Physical Y mapping function
 * @param {number} tolerance - Hit detection radius in pixels (default: 5)
 * @returns {Object|null} The drawing object that was hit, or null
 */
export function raycastDrawings(drawings, mouseX, mouseY, px, py, tolerance = 5) {
  const p = { x: mouseX, y: mouseY };
  
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    
    if (d.tool === 'trendline' && d.points.length >= 2) {
      const v = { x: px(d.points[0].time), y: py(d.points[0].price) };
      const w = { x: px(d.points[1].time), y: py(d.points[1].price) };
      
      const dist = distanceToSegment(p, v, w);
      if (dist <= tolerance) return d;
    }
  }
  
  return null;
}
