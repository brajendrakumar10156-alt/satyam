export const PRIO = { YEAR: 5, MONTH: 4, DAY: 3, HOUR: 2, MIN: 1 };

export function calculateTimeAxisLabels({
  candles,
  timeRange,
  cW,
  pAxisX,
  px,
  timezoneOffset = 0
}) {
  const firstI = Math.max(0, Math.floor(timeRange.from));
  const lastI  = Math.min(candles.length - 1, Math.ceil(timeRange.to));

  // Phase 1: Candidate collection
  const candidates = [];
  const visibleCount = lastI - firstI + 1;
  
  let minInterval = 1;
  if      (visibleCount > 2000) minInterval = 60;
  else if (visibleCount >  500) minInterval = 30;
  else if (visibleCount >  200) minInterval = 15;
  else if (visibleCount >  100) minInterval = 5;

  for (let i = firstI; i <= lastI; i++) {
    const c = candles[i];
    if (!c) continue;
    
    const x = Math.round(px(i)) + 0.5;
    if (x < -20 || x > cW + 20) continue;

    const d = new Date((c.time + timezoneOffset) * 1000);
    const H = d.getUTCHours(), M = d.getUTCMinutes();

    const isNewDay   = H === 0 && M === 0;
    const isNewMonth = isNewDay  && d.getUTCDate()  === 1;
    const isNewYear  = isNewMonth && d.getUTCMonth() === 0;

    let label    = '';
    let priority = PRIO.MIN;

    if (isNewYear) {
      label    = d.getUTCFullYear().toString();
      priority = PRIO.YEAR;
    } else if (isNewMonth) {
      label    = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
      priority = PRIO.MONTH;
    } else if (isNewDay) {
      label    = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`;
      priority = PRIO.DAY;
    } else {
      // Only emit at "nice" minute intervals to avoid label noise
      if ((H * 60 + M) % minInterval !== 0) continue;
      if (H === 0 && M === 0) continue; // midnight already handled above
      label    = `${H.toString().padStart(2, '0')}:${M.toString().padStart(2, '0')}`;
    }
    
    candidates.push({ x, label, priority, isMajor: priority >= PRIO.DAY });
  }

  // Phase 2: Priority-first greedy AABB placement
  candidates.sort((a, b) => b.priority - a.priority || a.x - b.x);

  const HPAD    = 10;          // padding between labels (each side)
  const placed  = [];          // [{left, right}]
  const winners = new Set();

  const collides = (nl, nr) => {
    for (const p of placed)
      if (nl < p.right + HPAD && nr > p.left - HPAD) return true;
    return false;
  };

  for (let ci = 0; ci < candidates.length; ci++) {
    const { x, label, priority } = candidates[ci];
    const charW = priority >= PRIO.DAY ? 7.2 : 6.5;
    const estW  = label.length * charW + HPAD * 2;
    const left  = x - estW / 2;
    const right = x + estW / 2;

    if (right > pAxisX - 4) continue;   // clip into price axis
    if (left  < 2)          continue;   // clip left edge

    if (collides(left, right)) continue;

    placed.push({ left, right });
    winners.add(ci);
  }

  // Return the winners sorted by x for Phase 3 drawing
  return candidates
    .filter((_, ci) => winners.has(ci))
    .sort((a, b) => a.x - b.x);
}
