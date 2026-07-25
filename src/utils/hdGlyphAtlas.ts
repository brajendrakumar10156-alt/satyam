/**
 * High-DPI Direct Glyph Texture Atlas Generator.
 * Renders crisp system fonts at exact target pixel size (with DPR scaling)
 * directly to a texture map for 1:1 pixel-perfect GPU text rendering.
 */
export function generateHDGlyphAtlas(
  fontFamily: string = "'Inter', 'SF Pro Display', -apple-system, sans-serif",
  fontSize: number = 11,
  dpr: number = 1
) {
  const chars = "0123456789.:-+$%/ '\\()[]{}*!?@#&_~<>|,\"" + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const atlasSize = 512;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D context for HD Glyph generation');

  ctx.clearRect(0, 0, atlasSize, atlasSize);
  
  const targetFontSize = Math.floor(fontSize * dpr);
  ctx.font = `600 ${targetFontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';

  const charMap: Record<string, { x: number; y: number; w: number; h: number; cellW: number; cellH: number }> = {};
  const padding = Math.ceil(2 * dpr);
  let cx = padding;
  let cy = padding;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const metrics = ctx.measureText(char);
    const charW = Math.ceil(metrics.width);
    const charH = Math.ceil(targetFontSize * 1.3);

    const cellW = charW + padding * 2;
    const cellH = charH + padding * 2;

    if (cx + cellW > atlasSize) {
      cx = padding;
      cy += cellH;
    }

    ctx.fillText(char, cx + padding, cy + padding);

    charMap[char] = {
      x: cx + padding,
      y: cy + padding,
      w: charW,
      h: charH,
      cellW: cellW,
      cellH: cellH
    };

    cx += cellW;
  }

  const imgData = ctx.getImageData(0, 0, atlasSize, atlasSize);
  const data = imgData.data;
  const alphaData = new Uint8Array(atlasSize * atlasSize);

  // Extract pure alpha channel for R8 texture map
  for (let i = 0; i < atlasSize * atlasSize; i++) {
    alphaData[i] = data[i * 4 + 3];
  }

  return {
    alphaData,
    charMap,
    atlasSize,
    dpr
  };
}
