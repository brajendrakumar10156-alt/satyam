import React, { useMemo } from 'react';
import { resolveAxisCollisions } from '../utils/axisCollisionEngine';

export default function DrawingAxisLabels({ drawings, getPixel, width, height }) {
  if (!drawings || drawings.length === 0 || !getPixel) return null;

  const PRICE_LABEL_HEIGHT = 20;
  const TIME_LABEL_WIDTH = 80;
  const TIME_LABEL_HEIGHT = 20;
  const RIGHT_AXIS_WIDTH = 64; // Standard Lightweight Charts axis width

  // 1. Gather all raw Y (Price) and X (Time) candidates
  const yCandidates = [];
  const xCandidates = [];

  drawings.forEach(d => {
    if (!d.points || d.points.length === 0) return;
    const p1 = d.points[0];
    const px1 = getPixel(p1.time, p1.price);
    if (!px1) return;

    const color = d.color || '#2962ff';

    // Horizontal types (Price labels)
    if (['horizontal_line', 'horizontal_ray', 'crossline'].includes(d.type)) {
      yCandidates.push({ 
        id: d.id + '_y', 
        center: px1.y, 
        size: PRICE_LABEL_HEIGHT, 
        text: p1.price.toFixed(2), 
        color 
      });
    }
    
    // Vertical types (Time labels)
    if (['vertical_line', 'crossline'].includes(d.type)) {
      xCandidates.push({ 
        id: d.id + '_x', 
        center: px1.x, 
        size: TIME_LABEL_WIDTH, 
        text: formatTime(p1.time), 
        color 
      });
    }
  });

  // 2. Resolve collisions (only if there's more than one)
  const resolvedY = yCandidates.length > 0 ? resolveAxisCollisions(yCandidates) : [];
  const resolvedX = xCandidates.length > 0 ? resolveAxisCollisions(xCandidates) : [];

  return (
    <>
      {/* Price Labels (Right Axis) */}
      {resolvedY.map(l => (
        <div
          key={l.id}
          style={{
            position: 'absolute',
            right: 0,
            top: l.center - l.size / 2,
            height: l.size,
            width: RIGHT_AXIS_WIDTH - 2, // slightly smaller than axis
            backgroundColor: l.color,
            color: '#fff',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 30, // above canvas, below toolbars
            pointerEvents: 'none'
          }}
        >
          {l.text}
        </div>
      ))}

      {/* Time Labels (Bottom Axis) */}
      {resolvedX.map(l => (
        <div
          key={l.id}
          style={{
            position: 'absolute',
            bottom: 0,
            left: l.center - l.size / 2,
            width: l.size,
            height: TIME_LABEL_HEIGHT,
            backgroundColor: l.color,
            color: '#fff',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            zIndex: 30,
            pointerEvents: 'none'
          }}
        >
          {l.text}
        </div>
      ))}
    </>
  );
}

function formatTime(timestamp) {
  const d = new Date(timestamp * 1000);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const mo = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}
