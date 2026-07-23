/**
 * Drawing Store — Universal Drawing Data Management
 * 
 * Key principle: Drawings are stored in TIME/PRICE coordinates,
 * never in pixel coordinates. Any engine can independently convert
 * time/price → pixels using its own viewport.
 */

export const DRAWING_TYPES = {
  // Lines
  trendline:        { category: 'trend', needs: ['start', 'end'] },
  ray:              { category: 'trend', needs: ['start', 'end'] },
  infoline:         { category: 'trend', needs: ['start', 'end'], hasLabel: true },
  extendedline:     { category: 'trend', needs: ['start', 'end'] },
  trendangle:       { category: 'trend', needs: ['start', 'end'], hasLabel: true },
  horizontal_line:  { category: 'trend', needs: ['start'], extends: 'full-width' },
  horizontal_ray:   { category: 'trend', needs: ['start'], extends: 'right' },
  vertical_line:    { category: 'trend', needs: ['start'], extends: 'full-height' },
  crossline:        { category: 'trend', needs: ['start'], extends: 'both' },
  channel:          { category: 'trend', needs: ['start', 'end'], hasOffset: true },
  
  // Gann & Fibonacci
  fibonacci:        { category: 'gann_fib', needs: ['start', 'end'], levels: true },
  fib_extension:    { category: 'gann_fib', needs: ['start', 'end'], levels: true },
  fib_fan:          { category: 'gann_fib', needs: ['start', 'end'], levels: true },
  fib_timezone:     { category: 'gann_fib', needs: ['start', 'end'] },
  gann_fan:         { category: 'gann_fib', needs: ['start', 'end'] },
  gann_square:      { category: 'gann_fib', needs: ['start', 'end'] },
  gann_box:         { category: 'gann_fib', needs: ['start', 'end'] },
  
  // Shapes
  rectangle:        { category: 'shape', needs: ['start', 'end'], filled: true },
  circle:           { category: 'shape', needs: ['start', 'end'], filled: true },
  ellipse:          { category: 'shape', needs: ['start', 'end'], filled: true },
  triangle:         { category: 'shape', needs: ['start', 'end'], filled: true },
  curve:            { category: 'shape', needs: ['start', 'end'] },
  polyline:         { category: 'shape', needs: ['start', 'end'] },
  
  // Annotations
  text:             { category: 'annotation', needs: ['start'], hasText: true },
  note:             { category: 'annotation', needs: ['start'], hasText: true },
  price_note:       { category: 'annotation', needs: ['start'] },
  callout:          { category: 'annotation', needs: ['start'], hasText: true },
  signpost:         { category: 'annotation', needs: ['start'], hasText: true },
  
  // Patterns
  xabcd:            { category: 'pattern', needs: ['start', 'end'] },
  abcd:             { category: 'pattern', needs: ['start', 'end'] },
  elliott_wave:     { category: 'pattern', needs: ['start', 'end'] },
  triangle_pat:     { category: 'pattern', needs: ['start', 'end'] },
  head_shoulders:   { category: 'pattern', needs: ['start', 'end'] },
  
  // Forecast
  long_position:    { category: 'forecast', needs: ['start', 'end'] },
  short_position:   { category: 'forecast', needs: ['start', 'end'] },
  
  // Measurement
  price_range:      { category: 'measure', needs: ['start', 'end'], extends: 'full-width' },
  date_range:       { category: 'measure', needs: ['start', 'end'], extends: 'full-height' },
  date_price_range: { category: 'measure', needs: ['start', 'end'] },
  ruler:            { category: 'measure', needs: ['start', 'end'], hasLabel: true },
  
  // Misc
  regression_trend: { category: 'trend', needs: ['start', 'end'], needsCandles: true },
  brush:            { category: 'freehand', needs: ['points'] },
  icon_up:          { category: 'icon', needs: ['start'] },
  icon_down:        { category: 'icon', needs: ['start'] },
  icon_star:        { category: 'icon', needs: ['start'] },
  icon_heart:       { category: 'icon', needs: ['start'] },
};

export function captureViewportSnapshot(chartInstance, priceScaleMode, autoScale) {
  if (!chartInstance) return null;
  try {
    const range = chartInstance.timeScale().getVisibleRange();
    const logicalRange = chartInstance.timeScale().getVisibleLogicalRange();
    return {
      visibleRange: range,            // {from: timestamp, to: timestamp}
      logicalRange: logicalRange,     // {from: bar_index, to: bar_index}
      priceScaleMode,
      autoScale,
      capturedAt: Date.now(),
    };
  } catch(e) {
    console.warn("Could not capture viewport snapshot", e);
    return null;
  }
}

export function isDrawingInRange(drawing, visibleRange) {
  if (!visibleRange) return true;
  
  if (['horizontal_line', 'crossline'].includes(drawing.type)) return true;
  if (drawing.type === 'vertical_line' && drawing.start?.time !== undefined) {
    return drawing.start.time >= visibleRange.from && drawing.start.time <= visibleRange.to;
  }
  
  const t1 = drawing.start?.time;
  const t2 = drawing.end?.time;
  if (t1 === undefined) return true;
  
  if (!['ray', 'horizontal_ray', 'extendedline'].includes(drawing.type)) {
    if (t2 !== undefined) {
      const minT = Math.min(t1, t2);
      const maxT = Math.max(t1, t2);
      if (maxT < visibleRange.from || minT > visibleRange.to) return false;
    }
  }
  return true;
}

export function colorToPixiHex(color) {
  if (typeof color === 'number') return color;
  if (!color) return 0x7c5cff;
  if (color.startsWith('#')) {
    return parseInt(color.replace('#', ''), 16);
  }
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g);
    if (parts && parts.length >= 3) {
      return (parseInt(parts[0]) << 16) + (parseInt(parts[1]) << 8) + parseInt(parts[2]);
    }
  }
  return 0x7c5cff; // fallback
}

export function generateDrawingId() {
  return 'drawing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
