/**
 * A lightweight, high-performance runtime Signed Distance Field (SDF) Font Generator.
 * Renders characters to an offscreen canvas and computes a 1D/2D distance transform
 * to generate a grayscale texture map that enables vector-sharp font rendering on the GPU.
 */
export function generateSDFAtlas(
  fontFamily: string = "'Inter', -apple-system, sans-serif",
  fontSize: number = 48, // High-res source glyphs for accurate distance computation
  padding: number = 8
) {
  const chars = "0123456789.:- ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const atlasSize = 512;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D context for SDF generation');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, atlasSize, atlasSize);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const charMap: Record<string, { x: number; y: number; w: number; h: number; cellW: number; cellH: number }> = {};
  let cx = padding;
  let cy = padding;

  // ── Render raw black/white glyphs to atlas with padding ──
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const metrics = ctx.measureText(char);
    const charW = Math.ceil(metrics.width);
    const charH = fontSize;

    const cellW = charW + padding * 2;
    const cellH = charH + padding * 2;

    if (cx + cellW > atlasSize) {
      cx = padding;
      cy += cellH;
    }

    ctx.fillText(char, cx + padding, cy + padding);

    charMap[char] = {
      x: cx,
      y: cy,
      w: cellW,
      h: cellH,
      cellW: cellW,
      cellH: cellH
    };

    cx += cellW;
  }

  // ── Perform distance transform compute on CPU (Fast 1D/2D pass) ──
  const imgData = ctx.getImageData(0, 0, atlasSize, atlasSize);
  const data = imgData.data;
  const sdfData = new Uint8Array(atlasSize * atlasSize);

  // Helper to find closest pixel of different color
  const maxSearch = padding;
  for (let y = 0; y < atlasSize; y++) {
    for (let x = 0; x < atlasSize; x++) {
      const idx = (y * atlasSize + x) * 4;
      const isInside = data[idx] > 127; // Grayscale threshold

      let minSqDist = maxSearch * maxSearch;
      
      // Radial search for speed
      const startX = Math.max(0, x - maxSearch);
      const endX = Math.min(atlasSize - 1, x + maxSearch);
      const startY = Math.max(0, y - maxSearch);
      const endY = Math.min(atlasSize - 1, y + maxSearch);

      for (let sy = startY; sy <= endY; sy++) {
        for (let sx = startX; sx <= endX; sx++) {
          const sIdx = (sy * atlasSize + sx) * 4;
          const sColor = data[sIdx] > 127;
          
          if (sColor !== isInside) {
            const dx = x - sx;
            const dy = y - sy;
            const sqDist = dx * dx + dy * dy;
            if (sqDist < minSqDist) {
              minSqDist = sqDist;
            }
          }
        }
      }

      const dist = Math.sqrt(minSqDist);
      const normalizedDist = Math.max(0, Math.min(1, dist / maxSearch));
      
      // Map to 0-255: inside glyph is > 128, outside is < 128
      let val = 128;
      if (isInside) {
        val = 128 + Math.floor(normalizedDist * 127);
      } else {
        val = 128 - Math.floor(normalizedDist * 128);
      }
      sdfData[y * atlasSize + x] = val;
    }
  }

  return {
    sdfData,
    charMap,
    atlasSize
  };
}
