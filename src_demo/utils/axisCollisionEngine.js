/**
 * 🚀 Native WebGPU & WebGL Axis Collision Engine
 * A highly optimized 2D spatial collision detector for Time (Horizontal) and Price (Vertical) axis labels.
 * Designed to filter out overlapping text elements natively before rendering.
 */

/**
 * Calculates which TIME labels should be visible on the horizontal X-axis.
 * Higher priority is given to Major time markers (New Year, New Month, New Day).
 */
export function calculateHorizontalTimeAxisLabels({
  timeLabels, // Array of { x, time, label, isMajor }
  cW,         // Canvas width
  pAxisW,     // Price Axis width (padding right)
  ctx         // HTML Canvas Context or measurement tool for text width
}) {
  if (!timeLabels || timeLabels.length === 0) return [];

  const PADDING = 20; // Minimum pixel gap between time labels

  // 1. Measure text width for all candidates
  const candidates = timeLabels.map(t => {
    // Basic approximation if ctx is missing: 7px per character
    const measuredWidth = ctx ? ctx.measureText(t.label).width : (t.label.length * 7);
    return {
      ...t,
      width: measuredWidth,
      left: t.x - (measuredWidth / 2) - (PADDING / 2),
      right: t.x + (measuredWidth / 2) + (PADDING / 2),
      priority: t.isMajor ? 100 : 10 // Major dates win collisions
    };
  });

  // 2. Sort candidates by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  const survivors = [];

  // 3. Collision filtering
  for (const cand of candidates) {
    // Drop if it bleeds off the left edge or into the price axis on the right
    if (cand.left < 0 || cand.right > (cW - pAxisW)) continue;

    let collided = false;
    for (const surv of survivors) {
      // 1D AABB intersection test on X axis
      if (cand.left < surv.right && cand.right > surv.left) {
        collided = true;
        break;
      }
    }

    if (!collided) {
      survivors.push(cand);
    }
  }

  // 4. Sort back into sequential chronological order for rendering
  survivors.sort((a, b) => a.x - b.x);
  return survivors;
}

/**
 * Calculates which PRICE labels should be visible on the vertical Y-axis.
 * Higher priority is given to round numbers or specific step intervals.
 */
export function calculateVerticalPriceAxisLabels({
  priceLabels, // Array of { y, p, label }
  cH,          // Canvas Height
  timeAxisH = 26, // Height of the time axis at the bottom
  labelHeight = 12 // Estimated height of the text in pixels
}) {
  if (!priceLabels || priceLabels.length === 0) return [];

  const PADDING = 15; // Minimum pixel gap vertically between price labels
  const totalH = labelHeight + PADDING;

  const candidates = priceLabels.map(p => {
    // Priority: round numbers (e.g. ending in .00 or .50) get higher priority
    let priority = 10;
    if (p.p % 1 === 0) priority += 50; // Whole numbers
    else if ((p.p * 10) % 5 === 0) priority += 20; // 0.50 intervals

    return {
      ...p,
      top: p.y - (totalH / 2),
      bottom: p.y + (totalH / 2),
      priority
    };
  });

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  const survivors = [];

  for (const cand of candidates) {
    // Drop if it bleeds off the top edge or into the time axis on the bottom
    if (cand.top < 0 || cand.bottom > (cH - timeAxisH)) continue;

    let collided = false;
    for (const surv of survivors) {
      // 1D AABB intersection test on Y axis
      if (cand.top < surv.bottom && cand.bottom > surv.top) {
        collided = true;
        break;
      }
    }

    if (!collided) {
      survivors.push(cand);
    }
  }

  // Sort back into physical sequential order (top to bottom)
  survivors.sort((a, b) => a.y - b.y);
  return survivors;
}

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
