// @ts-nocheck
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { INDICATOR_REGISTRY } from '../indicatorsRegistry';
import { calculateHorizontalTimeAxisLabels, calculateVerticalPriceAxisLabels } from '../utils/axisCollisionEngine';
import { generateSDFAtlas } from '../utils/sdfFontGenerator';

// ── WebGL2 Shader Sources ──

const vsGridSource = `#version 300 es
in vec2 a_position;
out vec2 v_fragPos;
uniform vec2 u_resolution;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_fragPos = vec2((a_position.x + 1.0) * 0.5 * u_resolution.x, (1.0 - a_position.y) * 0.5 * u_resolution.y);
}
`;

const fsGridSource = `#version 300 es
precision highp float;
in vec2 v_fragPos;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_livePixelY;
uniform vec4 u_liveColor;
uniform float u_darkMode;
uniform vec2 u_axisSize;

void main() {
    vec2 coord = v_fragPos;
    
    // Axis background
    if (coord.x > (u_resolution.x - u_axisSize.x) || coord.y > (u_resolution.y - u_axisSize.y)) {
        if (u_darkMode > 0.5) {
            fragColor = vec4(0.051, 0.067, 0.090, 1.0); // #0d1117
        } else {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0); // #ffffff
        }
        return;
    }

    vec4 finalColor = vec4(0.0, 0.0, 0.0, 0.0);

    // Live Price dashed line
    if (u_livePixelY > 0.0 && coord.x < (u_resolution.x - u_axisSize.x)) {
        float distY = abs(coord.y - u_livePixelY);
        if (distY < 1.0) {
            if (int(coord.x) % 8 < 4) {
                finalColor = vec4(u_liveColor.rgb, 0.8);
            }
        }
    }
    
    fragColor = finalColor;
}
`;

const vsCandleSource = `#version 300 es
in vec2 a_position; // unit quad vertex
in vec4 a_candlePrices; // open, high, low, close
in vec2 a_candleMeta; // index, isPrediction

uniform vec2 u_resolution;
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform vec2 u_priceRange;
uniform float u_isWick;

out vec4 v_color;

void main() {
    float open = a_candlePrices.x;
    float high = a_candlePrices.y;
    float low = a_candlePrices.z;
    float close = a_candlePrices.w;
    float index = a_candleMeta.x;
    float isPrediction = a_candleMeta.y;

    float spacing = 10.0 * u_scale.x;
    float candleWidth = max(1.0, floor(spacing * 0.8));
    float wickWidth = max(1.0, floor(min(2.0, spacing * 0.1)));

    float topP = max(open, close);
    float botP = min(open, close);
    if (u_isWick > 0.5) {
        topP = high;
        botP = low;
    }

    float pixelYTop = floor((u_priceRange.y - topP) * u_scale.y + u_offset.y);
    float pixelYBot = floor((u_priceRange.y - botP) * u_scale.y + u_offset.y);
    if (u_isWick < 0.5 && (pixelYBot - pixelYTop) < 1.0) {
        pixelYBot = pixelYTop + 1.0;
    }

    float heightPx = max(1.0, pixelYBot - pixelYTop);
    float widthPx = (u_isWick > 0.5) ? wickWidth : candleWidth;
    float xOffset = (u_isWick > 0.5) ? floor((candleWidth - wickWidth) * 0.5) : 0.0;

    float pixelX = floor((index * 10.0 * u_scale.x) + u_offset.x) + xOffset;
    float pixelY = pixelYTop;

    vec2 pos = vec2(pixelX, pixelY) + a_position * vec2(widthPx, heightPx);
    // --- MANUAL PIXEL SNAPPING ---
    float snappedX = round(pos.x) + 0.5;
    float snappedY = round(pos.y) + 0.5;
    
    float clipX = (snappedX / u_resolution.x) * 2.0 - 1.0;
    float clipY = 1.0 - (snappedY / u_resolution.y) * 2.0;

    gl_Position = vec4(clipX, clipY, 0.0, 1.0);

    bool isUp = close >= open;
    vec4 color = isUp ? vec4(0.031, 0.600, 0.505, 1.0) : vec4(0.949, 0.212, 0.271, 1.0);
    if (isPrediction > 0.5) {
        color.a = 0.45;
    }
    v_color = color;
}
`;

const fsCandleSource = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;

void main() {
    fragColor = v_color;
}
`;

const vsLineSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;
uniform vec2 u_resolution;
out vec4 v_color;

void main() {
    // --- MANUAL PIXEL SNAPPING ---
    float snappedX = round(a_position.x) + 0.5;
    float snappedY = round(a_position.y) + 0.5;

    float clipX = (snappedX / u_resolution.x) * 2.0 - 1.0;
    float clipY = 1.0 - (snappedY / u_resolution.y) * 2.0;
    
    gl_Position = vec4(clipX, clipY, 0.0, 1.0);
    v_color = a_color;
}
`;

const fsLineSource = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;

void main() {
    fragColor = v_color;
}
`;

const vsSdfTextSource = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec2 u_resolution;
out vec2 v_uv;

void main() {
    float clipX = (a_position.x / u_resolution.x) * 2.0 - 1.0;
    float clipY = 1.0 - (a_position.y / u_resolution.y) * 2.0;
    gl_Position = vec4(clipX, clipY, 0.0, 1.0);
    v_uv = vec2(a_uv.x, a_uv.y);
}
`;

const fsSdfTextSource = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_fontTexture;
uniform vec4 u_textColor;

void main() {
    float distance = texture(u_fontTexture, v_uv).r;
    float smoothing = 0.05;
    float alpha = smoothstep(0.5 - smoothing, 0.5 + smoothing, distance);
    if (alpha < 0.01) { discard; }
    fragColor = vec4(u_textColor.rgb, u_textColor.a * alpha);
}
`;

const vsImageSource = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec2 u_resolution;
out vec2 v_uv;

void main() {
    float clipX = (a_position.x / u_resolution.x) * 2.0 - 1.0;
    float clipY = 1.0 - (a_position.y / u_resolution.y) * 2.0;
    gl_Position = vec4(clipX, clipY, 0.0, 1.0);
    v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
}
`;

const fsImageSource = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_imageTexture;
uniform vec4 u_tint;

void main() {
    vec4 texColor = texture(u_imageTexture, v_uv);
    fragColor = texColor * u_tint;
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compiler error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

const WebGLChartEngine = forwardRef(({
  candles = [],
  predictedCandle = null,
  darkMode = true,
  chartStyle = 'candles',
  priceScaleMode = 0,
  autoScale = true,
  timezoneOffset = 0,
  initialVisibleRange,
  onVisibleRangeChange,
  onChartReady,
  activeTool = null,
  isHoveringDrawing,
  drawings = [],
  visualIndicators = [],
  indicatorDataMap = {},
  onRequestDraw
}, ref) => {
  const containerRef = useRef(null);
  const glCanvasRef = useRef(null);

  const hoverPriceLabelRef = useRef(null);
  const hoverTimeLabelRef = useRef(null);
  const livePriceLabelRef = useRef(null);

  const glRef = useRef(null);
  const programsRef = useRef({});
  const buffersRef = useRef({});
  const textureRef = useRef(null);
  const charMapRef = useRef({});

  const vState = useRef({
    logicalRange: { from: 0, to: 100 },
    priceRange: { min: 0, max: 100 },
    manualPriceScale: false,
    width: 800,
    height: 600,
    isDragging: false,
    dragStart: null,
    hoverPixel: null
  });

  const rAFRef = useRef(null);
  const renderRef = useRef(null);
  
  const scheduleRender = () => {
    if (rAFRef.current !== null) return;
    rAFRef.current = requestAnimationFrame(() => {
      rAFRef.current = null;
      if (renderRef.current) renderRef.current();
    });
  };

  const dpr = window.devicePixelRatio || 1;

  const timeToIndex = (time, arr) => {
    if (!arr || arr.length === 0) return 0;
    let l = 0, r = arr.length - 1;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (arr[m].time === time) return m;
      if (arr[m].time < time) l = m + 1;
      else r = m - 1;
    }
    return l;
  };

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let e of entries) {
        const { width, height } = e.contentRect;
        vState.current.width = width;
        vState.current.height = height;

        if (glCanvasRef.current) {
          glCanvasRef.current.width = Math.floor(width * dpr);
          glCanvasRef.current.height = Math.floor(height * dpr);
        }
        scheduleRender();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [candles]);

  // Initial range setting
  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (isInitializedRef.current || !candles || candles.length === 0) return;
    isInitializedRef.current = true;
    if (initialVisibleRange?.visibleRange) {
      const fromIdx = timeToIndex(initialVisibleRange.visibleRange.from, candles);
      const toIdx = timeToIndex(initialVisibleRange.visibleRange.to, candles);
      vState.current.logicalRange = { from: fromIdx, to: toIdx };
    } else {
      vState.current.logicalRange = {
        from: Math.max(0, candles.length - 80),
        to: candles.length - 1 + 20
      };
    }
    scheduleRender();
  }, [initialVisibleRange, candles]);

  // Setup WebGL2
  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }
    glRef.current = gl;

    // Load programs
    programsRef.current.grid = createProgram(gl, vsGridSource, fsGridSource);
    programsRef.current.candle = createProgram(gl, vsCandleSource, fsCandleSource);
    programsRef.current.line = createProgram(gl, vsLineSource, fsLineSource);
    programsRef.current.sdfText = createProgram(gl, vsSdfTextSource, fsSdfTextSource);
    programsRef.current.image = createProgram(gl, vsImageSource, fsImageSource);

    // Quad geometry (for instanced candles + grid quad)
    const quadVertices = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
    buffersRef.current.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.quad);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Fullscreen quad for grid
    const fsQuadVertices = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1
    ]);
    buffersRef.current.fsQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.fsQuad);
    gl.bufferData(gl.ARRAY_BUFFER, fsQuadVertices, gl.STATIC_DRAW);

    // Dynamic buffer for lines & volume
    buffersRef.current.dynamic = gl.createBuffer();

    // Instanced Candle VBOs
    buffersRef.current.candlePrices = gl.createBuffer();
    buffersRef.current.candleMeta = gl.createBuffer();

    // SDF Text dynamic Buffer
    buffersRef.current.text = gl.createBuffer();

    // Generate and upload SDF Atlas Texture
    // Generate and upload SDF Atlas Texture at high resolution (64px) for sharp curves
    const { sdfData, charMap, atlasSize } = generateSDFAtlas(
      "'Inter', -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
      64,
      8
    );
    charMapRef.current = charMap;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      atlasSize,
      atlasSize,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      sdfData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textureRef.current = texture;
    
    // Load logo texture
    const logoImg = new Image();
    logoImg.src = '/src/assets/logo.png';
    const logoTexture = gl.createTexture();
    textureRef.current_logo = logoTexture;
    
    logoImg.onload = () => {
      const gl = glRef.current;
      if (gl) {
        gl.bindTexture(gl.TEXTURE_2D, logoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logoImg);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        scheduleRender();
      }
    };

    if (onChartReady) onChartReady();
    scheduleRender();

    return () => {
      if (rAFRef.current !== null) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
      gl.deleteBuffer(buffersRef.current.quad);
      gl.deleteBuffer(buffersRef.current.fsQuad);
      gl.deleteBuffer(buffersRef.current.dynamic);
      gl.deleteBuffer(buffersRef.current.candlePrices);
      gl.deleteBuffer(buffersRef.current.candleMeta);
      gl.deleteBuffer(buffersRef.current.text);
      gl.deleteTexture(textureRef.current);
    };
  }, []);

  const render = () => {
    const gl = glRef.current;
    if (!gl || !glCanvasRef.current) return;

    const cw = glCanvasRef.current.width;
    const ch = glCanvasRef.current.height;
    if (cw <= 0 || ch <= 0) return;

    let timeAxisY = ch - (28 * dpr);

    // Clear Screen
    gl.viewport(0, 0, cw, ch);
    if (darkMode) {
      gl.clearColor(0.051, 0.067, 0.090, 1.0); // #0d1117
    } else {
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable transparent alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let timeAxisWinners = [];
    let livePixelY = -1.0;
    let priceAxisWinners = [];
    
    // ── DRAW LOGO WATERMARK ──
    const progImage = programsRef.current.image;
    if (progImage && textureRef.current_logo) {
      gl.useProgram(progImage);
      
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current_logo);
      gl.uniform1i(gl.getUniformLocation(progImage, 'u_imageTexture'), 1);
      gl.uniform2f(gl.getUniformLocation(progImage, 'u_resolution'), cw, ch);
      
      const tint = darkMode ? [1.0, 1.0, 1.0, 0.05] : [0.0, 0.0, 0.0, 0.05];
      gl.uniform4fv(gl.getUniformLocation(progImage, 'u_tint'), tint);
      
      const pAxisW = vState.current.pAxisW || 65;
      const chartW = cw - pAxisW;
      const chartH = timeAxisY;
      
      // Assume square logo. Fit inside chart area.
      const size = Math.min(chartW, chartH) * 0.4; 
      const centerX = chartW / 2;
      const centerY = chartH / 2;
      const x1 = Math.round(centerX - size / 2);
      const y1 = Math.round(centerY - size / 2);
      const x2 = Math.round(centerX + size / 2);
      const y2 = Math.round(centerY + size / 2);
      
      const logoData = new Float32Array([
        x1, y1, 0.0, 0.0,
        x2, y1, 1.0, 0.0,
        x1, y2, 0.0, 1.0,
        
        x1, y2, 0.0, 1.0,
        x2, y1, 1.0, 0.0,
        x2, y2, 1.0, 1.0
      ]);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.text);
      gl.bufferData(gl.ARRAY_BUFFER, logoData, gl.DYNAMIC_DRAW);
      
      const aPos = gl.getAttribLocation(progImage, 'a_position');
      const aUv = gl.getAttribLocation(progImage, 'a_uv');
      
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      gl.disableVertexAttribArray(aPos);
      gl.disableVertexAttribArray(aUv);
    }

    // Auto-Scale
    if (autoScale && !vState.current.manualPriceScale && candles && candles.length > 0) {
      let minP = Infinity, maxP = -Infinity;
      const fromIdx = Math.max(0, Math.floor(vState.current.logicalRange.from));
      const toIdx = Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to));

      for (let i = fromIdx; i <= toIdx; i++) {
        if (candles[i].low < minP) minP = candles[i].low;
        if (candles[i].high > maxP) maxP = candles[i].high;
      }

      if (minP !== Infinity && maxP !== -Infinity) {
        let pad = (maxP - minP) * 0.1;
        if (pad === 0) pad = maxP * 0.01 || 1;

        const targetMin = minP - pad;
        const targetMax = maxP + pad;

        const diffMin = targetMin - vState.current.priceRange.min;
        const diffMax = targetMax - vState.current.priceRange.max;

        if (Math.abs(diffMin) > 0.000001 || Math.abs(diffMax) > 0.000001) {
          vState.current.priceRange.min += diffMin * 0.4;
          vState.current.priceRange.max += diffMax * 0.4;
          scheduleRender();
        }
      }
    }

    const logicalRange = vState.current.logicalRange;
    const rangeLen = (logicalRange.to - logicalRange.from) || 1;
    const { min, max } = vState.current.priceRange;
    const priceRange = (max - min) || 1;
    const hoverPixel = vState.current.hoverPixel;

    // 1. Calculate price step and labels first to compute dynamic price axis width
    const targetSteps = Math.max(4, Math.floor(ch / (60 * dpr)));
    const rawStep = priceRange / targetSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;

    let stepMult = 1;
    if (normalized > 7.5) stepMult = 10;
    else if (normalized > 3.5) stepMult = 5;
    else if (normalized > 1.5) stepMult = 2;

    const pStep = Math.max(0.000001, stepMult * magnitude);
    const decPlaces = pStep >= 1 ? 0 : pStep >= 0.1 ? 2 : pStep >= 0.01 ? 2 : pStep >= 0.001 ? 3 : 4;

    const getTextWidth = (str) => {
      let w = 0;
      const paddingValue = 8;
      for (let i = 0; i < str.length; i++) {
        const map = charMapRef.current[str[i]];
        if (map) w += (map.w - paddingValue * 2);
      }
      return w;
    };

    let maxPriceW = 36 * dpr;
    const startP = Math.floor(min / pStep) * pStep;
    for (let p = startP; p <= max; p += pStep) {
      if (p < min || p > max) continue;
      const w = getTextWidth(p.toFixed(decPlaces));
      if (w > maxPriceW) maxPriceW = w;
    }
    if (candles && candles.length > 0) {
      const lastC = candles[candles.length - 1];
      const w = getTextWidth(lastC.close.toFixed(decPlaces));
      if (w > maxPriceW) maxPriceW = w;
    }

    // Equal side margin: 8px (8 * dpr) on both sides of the price digits
    const pAxisW = maxPriceW + 16 * dpr;
    vState.current.pAxisW = pAxisW / dpr; // Store in CSS pixels

    // 2. Compute horizontal scaleX and offsetX using pAxisW
    const scaleX = (cw - pAxisW) / (rangeLen * 10);
    const offsetX = -(logicalRange.from * 10 * scaleX);

    // 3. Generate rawTimeLabels and timeAxisWinners
    const startIdx = Math.max(0, Math.floor(logicalRange.from));
    const endIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));

    const rawTimeLabels = [];
    let lastMonth = -1, lastDay = -1;
    for (let i = startIdx; i <= endIdx; i++) {
      if (!candles[i]) continue;
      const rawTime = candles[i].time;
      const timeMs = rawTime < 10000000000 ? rawTime * 1000 : rawTime;
      const d = new Date(timeMs);
      const mon = d.getUTCMonth();
      const day = d.getUTCDate();
      const H = d.getUTCHours();
      const M = d.getUTCMinutes();

      const isNewMonth = (mon !== lastMonth && lastMonth !== -1);
      const isNewDay = (day !== lastDay && lastDay !== -1) && !isNewMonth;
      lastMonth = mon; lastDay = day;

      const isNewYear = isNewMonth && d.getUTCMonth() === 0;

      let isMajor = false;
      let label = '';
      if (isNewYear) { label = d.getUTCFullYear().toString(); isMajor = true; }
      else if (isNewMonth) { label = d.toLocaleString('default', { month: 'short', timeZone: 'UTC' }); isMajor = true; }
      else if (isNewDay) { label = `${d.getUTCDate()} ${d.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`; isMajor = true; }
      else {
        const tickSpacing = Math.max(1, Math.floor(((logicalRange.to - logicalRange.from) || 1) / 12));
        if (i % tickSpacing !== 0) continue;
        label = `${H.toString().padStart(2, '0')}:${M.toString().padStart(2, '0')}`;
      }

      const candleWidth = Math.max(1.0, 10.0 * scaleX * 0.8);
      const x = (i * 10.0 * scaleX) + offsetX + (candleWidth * 0.5);
      rawTimeLabels.push({ x, label, isMajor });
    }

    timeAxisWinners = calculateHorizontalTimeAxisLabels({
      timeLabels: rawTimeLabels,
      cW: cw,
      pAxisW: pAxisW
    });

    // 4. Measure maximum height of time winners to calculate dynamic timeAxisY
    const getTextHeight = (str) => {
      let maxH = 0;
      const paddingValue = 8;
      for (let i = 0; i < str.length; i++) {
        const map = charMapRef.current[str[i]];
        if (map && (map.h - paddingValue * 2) > maxH) {
          maxH = (map.h - paddingValue * 2);
        }
      }
      return maxH || (12 * dpr);
    };

    const maxTimeH = timeAxisWinners.length > 0
      ? Math.max(...timeAxisWinners.map(w => getTextHeight(w.label)))
      : 12 * dpr;

    const timeAxisH = maxTimeH + 16 * dpr; // 8px dynamic padding top and bottom
    timeAxisY = ch - timeAxisH;
    vState.current.timeAxisH = timeAxisH / dpr; // Save in CSS pixels

    // 5. Compute scaleY and priceAxisWinners using final timeAxisY
    const scaleY = timeAxisY / priceRange;
    const offsetY = 0;

    const rawPriceLabels = [];
    for (let p = startP; p <= max; p += pStep) {
      if (p < min || p > max) continue;
      const py = timeAxisY - ((p - min) * scaleY);
      rawPriceLabels.push({ y: py, p: p, label: p.toFixed(decPlaces) });
    }

    priceAxisWinners = calculateVerticalPriceAxisLabels({
      priceLabels: rawPriceLabels,
      cH: ch,
      timeAxisH: timeAxisH
    });

    // ── 1. DRAW PROCEDURAL GRID (BACKGROUND) ──
    const progGrid = programsRef.current.grid;
    if (progGrid) {
      gl.useProgram(progGrid);

      gl.uniform2f(gl.getUniformLocation(progGrid, 'u_resolution'), cw, ch);
      gl.uniform2f(gl.getUniformLocation(progGrid, 'u_axisSize'), pAxisW, timeAxisH);
      gl.uniform1f(gl.getUniformLocation(progGrid, 'u_darkMode'), darkMode ? 1.0 : 0.0);

      let lc = [0.031, 0.600, 0.505, 1.0];
      if (candles && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        const isUp = lastC.close >= lastC.open;
        lc = isUp ? [0.031, 0.600, 0.505, 1.0] : [0.949, 0.211, 0.270, 1.0];
        livePixelY = timeAxisY - ((lastC.close - min) * scaleY);
      }

      gl.uniform1f(gl.getUniformLocation(progGrid, 'u_livePixelY'), livePixelY);
      gl.uniform4fv(gl.getUniformLocation(progGrid, 'u_liveColor'), lc);

      const posAttr = gl.getAttribLocation(progGrid, 'a_position');
      gl.enableVertexAttribArray(posAttr);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.fsQuad);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(posAttr);
    }

    // ── 2. DRAW GRAPHIC LINE SEGMENTS ──
    const progLine = programsRef.current.line;
    if (progLine) {
      gl.useProgram(progLine);
      gl.uniform2f(gl.getUniformLocation(progLine, 'u_resolution'), cw, ch);
      const lineSegments = [];
      const quadSegments = [];

      const pushLine = (x1, y1, x2, y2, color) => {
        lineSegments.push(x1, y1, color[0], color[1], color[2], color[3]);
        lineSegments.push(x2, y2, color[0], color[1], color[2], color[3]);
      };

      const pushRect = (x, y, w, h, color) => {
        const l = x - w / 2;
        const r = x + w / 2;
        const t = y;
        const b = y + h;

        quadSegments.push(l, t, ...color);
        quadSegments.push(r, t, ...color);
        quadSegments.push(l, b, ...color);

        quadSegments.push(l, b, ...color);
        quadSegments.push(r, t, ...color);
        quadSegments.push(r, b, ...color);
      };

      const gridLineColor = darkMode ? [42/255, 46/255, 57/255, 0.6] : [224/255, 227/255, 235/255, 1.0];
      const axisBorderColor = darkMode ? [42/255, 46/255, 57/255, 1.0] : [224/255, 227/255, 235/255, 1.0];

      // Draw grid lines and tick marks
      timeAxisWinners.forEach(({ x }) => {
        pushLine(x, 0, x, timeAxisY, gridLineColor);
        pushLine(x, timeAxisY, x, timeAxisY + 4 * dpr, gridLineColor); // Time axis tick
      });
      priceAxisWinners.forEach(({ y }) => {
        pushLine(0, y, cw - pAxisW, y, gridLineColor);
        pushLine(cw - pAxisW, y, cw - pAxisW + 4 * dpr, y, gridLineColor); // Price axis tick
      });

      pushLine(cw - pAxisW, 0, cw - pAxisW, timeAxisY, axisBorderColor);
      pushLine(0, timeAxisY, cw - pAxisW, timeAxisY, axisBorderColor);

      if (candles && candles.length > 0) {
        let maxVol = 0;
        for (let i = startIdx; i <= endIdx; i++) {
          if (candles[i]?.volume > maxVol) maxVol = candles[i].volume;
        }
        if (maxVol > 0) {
          const spacing = 10.0 * scaleX;
          const candleWidth = Math.max(1.0, spacing * 0.8);
          for (let i = startIdx; i <= endIdx; i++) {
            const c = candles[i];
            if (!c) continue;
            const x = (i * 10.0 * scaleX) + offsetX + (candleWidth * 0.5);
            const volH = (c.volume / maxVol) * (ch * 0.15);
            const isUp = c.close >= c.open;
            const volColor = isUp ? [16 / 255, 185 / 255, 129 / 255, 0.35] : [239 / 255, 68 / 255, 68 / 255, 0.35];
            pushRect(x, timeAxisY - volH, candleWidth, volH, volColor);
          }
        }
      }

      if (candles && candles.length > 1 && visualIndicators && visualIndicators.length > 0) {
        const seriesColors = ['#ff9800', '#2962ff', '#26a69a', '#e040fb', '#00e676', '#ff5722', '#00bcd4', '#9c27b0'];
        visualIndicators.forEach((ind, indIdx) => {
          if (!ind.visible) return;
          const reg = INDICATOR_REGISTRY[ind.type];
          if (!reg || reg.kind !== 'overlay') return;
          const results = indicatorDataMap[ind.id];
          if (!results) return;

          reg.seriesConfig.forEach((s, sIdx) => {
            const data = results[s.key];
            if (!data || data.length < 2) return;
            const color = ind.color || seriesColors[(indIdx + sIdx) % seriesColors.length];

            let r = 0.16, g = 0.50, b = 0.96, a = 1.0;
            if (color && color.startsWith('#')) {
              const hex = color.replace('#', '');
              if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16) / 255;
                g = parseInt(hex.substring(2, 4), 16) / 255;
                b = parseInt(hex.substring(4, 6), 16) / 255;
              }
            }

            for (let i = Math.max(1, startIdx); i <= endIdx; i++) {
              if (data[i - 1] === undefined || data[i] === undefined) continue;
              const x1 = ((i - 1) * 10.0 * scaleX) + offsetX + (Math.max(1.0, 10.0 * scaleX * 0.8) * 0.5);
              const x2 = (i * 10.0 * scaleX) + offsetX + (Math.max(1.0, 10.0 * scaleX * 0.8) * 0.5);
              const y1 = timeAxisY - ((data[i - 1] - min) * scaleY);
              const y2 = timeAxisY - ((data[i] - min) * scaleY);
              pushLine(x1, y1, x2, y2, [r, g, b, a]);
            }
          });
        });
      }

      if (drawings && drawings.length > 0) {
        const drawingColor = [0.2, 0.6, 1.0, 1.0];
        drawings.forEach(d => {
          if (d.tool === 'trendline' && d.points.length >= 2) {
            const px = (time) => ((timeToIndex(time, candles) - logicalRange.from) / (logicalRange.to - logicalRange.from)) * (cw - pAxisW);
            const x1 = px(d.points[0].time);
            const x2 = px(d.points[1].time);
            const y1 = timeAxisY - ((d.points[0].price - min) * scaleY);
            const y2 = timeAxisY - ((d.points[1].price - min) * scaleY);
            pushLine(x1, y1, x2, y2, drawingColor);
          }
        });
      }

      if (activeTool === 'trendline' && glRef.current.activeDrawStart && glRef.current.activeTempShape) {
        const drawingColor = [0.2, 0.6, 1.0, 1.0];
        const px = (time) => ((timeToIndex(time, candles) - logicalRange.from) / (logicalRange.to - logicalRange.from)) * (cw - pAxisW);
        const x1 = px(glRef.current.activeDrawStart.time);
        const x2 = px(glRef.current.activeTempShape.time);
        const y1 = timeAxisY - ((glRef.current.activeDrawStart.price - min) * scaleY);
        const y2 = timeAxisY - ((glRef.current.activeTempShape.price - min) * scaleY);
        pushLine(x1, y1, x2, y2, drawingColor);
      }

      if (hoverPixel) {
        const hx = hoverPixel.x * dpr;
        const hy = hoverPixel.y * dpr;
        const crosshairColor = [1.0, 1.0, 1.0, 0.3];
        if (hx >= 0 && hx <= cw - pAxisW && hy >= 0 && hy <= timeAxisY) {
          pushLine(hx, 0, hx, timeAxisY, crosshairColor);
          pushLine(0, hy, cw - pAxisW, hy, crosshairColor);
        }
      }

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, Math.floor(24 * dpr), Math.floor(cw - pAxisW), Math.floor(timeAxisY));

      const posAttr = gl.getAttribLocation(progLine, 'a_position');
      const colorAttr = gl.getAttribLocation(progLine, 'a_color');

      gl.enableVertexAttribArray(posAttr);
      gl.enableVertexAttribArray(colorAttr);

      // Draw quads (volume)
      if (quadSegments.length > 0) {
        const quadFloatData = new Float32Array(quadSegments);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.dynamic);
        gl.bufferData(gl.ARRAY_BUFFER, quadFloatData, gl.DYNAMIC_DRAW);

        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(colorAttr, 4, gl.FLOAT, false, 24, 8);

        gl.drawArrays(gl.TRIANGLES, 0, quadFloatData.length / 6);
      }

      // Draw lines (grid, crosshairs, trendlines)
      if (lineSegments.length > 0) {
        const lineFloatData = new Float32Array(lineSegments);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.dynamic);
        gl.bufferData(gl.ARRAY_BUFFER, lineFloatData, gl.DYNAMIC_DRAW);

        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(colorAttr, 4, gl.FLOAT, false, 24, 8);

        gl.drawArrays(gl.LINES, 0, lineFloatData.length / 6);
      }

      gl.disableVertexAttribArray(posAttr);
      gl.disableVertexAttribArray(colorAttr);
      gl.disable(gl.SCISSOR_TEST);

      // ── Draw Native Axis Tooltip Rectangles (Outside Scissor) ──
      const overlaySegs = [];
      const pushOverlayRectMinMax = (x1, y1, x2, y2, color) => {
        overlaySegs.push(x1, y1, ...color);
        overlaySegs.push(x2, y1, ...color);
        overlaySegs.push(x1, y2, ...color);
        overlaySegs.push(x1, y2, ...color);
        overlaySegs.push(x2, y1, ...color);
        overlaySegs.push(x2, y2, ...color);
      };

      // 1. Live Price Box
      if (livePixelY >= 0 && livePixelY <= timeAxisY && candles && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        const lastPriceStr = lastC.close.toFixed(decPlaces);
        const w = getTextWidth(lastPriceStr);
        const labelX = cw - 8 * dpr - w;
        const isUp = lastC.close >= lastC.open;
        const col = isUp ? [0.031, 0.600, 0.505, 1.0] : [0.949, 0.211, 0.270, 1.0];
        pushOverlayRectMinMax(cw - pAxisW, livePixelY - 10 * dpr, cw, livePixelY + 10 * dpr, col);
      }

      // 2. Hover Boxes
      if (hoverPixel) {
        const hx = hoverPixel.x * dpr;
        const hy = hoverPixel.y * dpr;
        if (hx >= 0 && hx <= cw - pAxisW && hy >= 0 && hy <= timeAxisY) {
          const hoverPrice = max - (hy / scaleY);
          const hoverPriceStr = hoverPrice.toFixed(decPlaces);
          const w = getTextWidth(hoverPriceStr);
          const labelX = cw - 8 * dpr - w;
          pushOverlayRectMinMax(cw - pAxisW, hy - 10 * dpr, cw, hy + 10 * dpr, [0.1, 0.1, 0.1, 1.0]);
          pushOverlayRectMinMax(hx - 60 * dpr, timeAxisY, hx + 60 * dpr, timeAxisY + timeAxisH, darkMode ? [42/255, 46/255, 57/255, 1.0] : [224/255, 227/255, 235/255, 1.0]);
        }
      }

      if (overlaySegs.length > 0) {
        const floatData = new Float32Array(overlaySegs);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.dynamic);
        gl.bufferData(gl.ARRAY_BUFFER, floatData, gl.DYNAMIC_DRAW);
        const posAttr = gl.getAttribLocation(progLine, 'a_position');
        const colorAttr = gl.getAttribLocation(progLine, 'a_color');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(colorAttr);
        gl.vertexAttribPointer(colorAttr, 4, gl.FLOAT, false, 24, 8);
        gl.drawArrays(gl.TRIANGLES, 0, floatData.length / 6);
        gl.disableVertexAttribArray(posAttr);
        gl.disableVertexAttribArray(colorAttr);
      }
    }

    // ── 3. DRAW INSTANCED CANDLESTICKS ──
    const progCandle = programsRef.current.candle;
    const renderCandles = predictedCandle ? [...candles, predictedCandle] : candles;
    if (progCandle && renderCandles && renderCandles.length > 0) {
      gl.useProgram(progCandle);

      gl.uniform2f(gl.getUniformLocation(progCandle, 'u_resolution'), cw, ch);
      gl.uniform2f(gl.getUniformLocation(progCandle, 'u_scale'), scaleX, scaleY);
      gl.uniform2f(gl.getUniformLocation(progCandle, 'u_offset'), offsetX, offsetY);
      gl.uniform2f(gl.getUniformLocation(progCandle, 'u_priceRange'), min, max);

      const count = renderCandles.length;
      const priceData = new Float32Array(count * 4);
      const metaData = new Float32Array(count * 2);

      for (let i = 0; i < count; i++) {
        const c = renderCandles[i];
        priceData[i * 4] = c.open;
        priceData[i * 4 + 1] = c.high;
        priceData[i * 4 + 2] = c.low;
        priceData[i * 4 + 3] = c.close;

        metaData[i * 2] = i;
        metaData[i * 2 + 1] = c.isPrediction ? 1.0 : 0.0;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.candlePrices);
      gl.bufferData(gl.ARRAY_BUFFER, priceData, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.candleMeta);
      gl.bufferData(gl.ARRAY_BUFFER, metaData, gl.DYNAMIC_DRAW);

      const aPos = gl.getAttribLocation(progCandle, 'a_position');
      gl.enableVertexAttribArray(aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.quad);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const aPrices = gl.getAttribLocation(progCandle, 'a_candlePrices');
      gl.enableVertexAttribArray(aPrices);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.candlePrices);
      gl.vertexAttribPointer(aPrices, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aPrices, 1);

      const aMeta = gl.getAttribLocation(progCandle, 'a_candleMeta');
      gl.enableVertexAttribArray(aMeta);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.candleMeta);
      gl.vertexAttribPointer(aMeta, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aMeta, 1);

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, Math.floor(24 * dpr), Math.floor(cw - pAxisW), Math.floor(timeAxisY));

      gl.uniform1f(gl.getUniformLocation(progCandle, 'u_isWick'), 0.0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

      gl.uniform1f(gl.getUniformLocation(progCandle, 'u_isWick'), 1.0);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

      gl.vertexAttribDivisor(aPrices, 0);
      gl.vertexAttribDivisor(aMeta, 0);
      gl.disableVertexAttribArray(aPos);
      gl.disableVertexAttribArray(aPrices);
      gl.disableVertexAttribArray(aMeta);
      gl.disable(gl.SCISSOR_TEST);
    }

    // ── 4. DRAW NATIVE SDF AXIS TEXT LABELS ──
    const progText = programsRef.current.sdfText;
    const charMap = charMapRef.current;
    if (progText && textureRef.current && (timeAxisWinners.length > 0 || priceAxisWinners.length > 0)) {
      gl.useProgram(progText);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.uniform1i(gl.getUniformLocation(progText, 'u_fontTexture'), 0);
      gl.uniform2f(gl.getUniformLocation(progText, 'u_resolution'), cw, ch);

      const textColor = darkMode ? [0.788, 0.820, 0.851, 1.0] : [0.075, 0.090, 0.133, 1.0];
      gl.uniform4fv(gl.getUniformLocation(progText, 'u_textColor'), textColor);
      
      const atlasSize = 1024.0;
      const sdfFontSize = 64;
      const targetFontSize = 12 * dpr;
      const fontScale = targetFontSize / sdfFontSize;

      const textData = [];
      const pushCharQuad = (x, y, w, h, map) => {
        const x2 = x + w;
        const y2 = y + h;
        const ux1 = map.x / atlasSize;
        const uy1 = map.y / atlasSize;
        const ux2 = (map.x + map.w) / atlasSize;
        const uy2 = (map.y + map.h) / atlasSize;

        textData.push(x, y, ux1, uy1);
        textData.push(x2, y, ux2, uy1);
        textData.push(x, y2, ux1, uy2);
        textData.push(x, y2, ux1, uy2);
        textData.push(x2, y, ux2, uy1);
        textData.push(x2, y2, ux2, uy2);
      };

      const pushText = (str, startX, startY) => {
        let curX = startX;
        const paddingValue = 8;
        for (let i = 0; i < str.length; i++) {
          const c = str[i];
          const map = charMap[c];
          if (!map) continue;
          const charW = (map.w - paddingValue * 2) * fontScale;
          pushCharQuad(curX - (paddingValue * fontScale), startY - (map.cellH * fontScale) / 2, map.cellW * fontScale, map.cellH * fontScale, map);
          curX += charW;
        }
      };

      const getTextWidth = (str) => {
        let w = 0;
        const paddingValue = 8;
        for (let i = 0; i < str.length; i++) {
          const map = charMap[str[i]];
          if (map) w += (map.w - paddingValue * 2) * fontScale;
        }
        return w;
      };

      timeAxisWinners.forEach(({ x, label }) => {
        const w = getTextWidth(label);
        pushText(label, Math.floor(x - w / 2), Math.floor(timeAxisY + timeAxisH / 2));
      });

      // Draw vertical price labels
      priceAxisWinners.forEach(({ y, label }) => {
        const w = getTextWidth(label);
        const labelX = cw - 8 * dpr - w;
        pushText(label, Math.floor(labelX), y);
      });

      // ── Live Price Text (WebGL Native) ──
      if (candles && candles.length > 0) {
        const lastC = candles[candles.length - 1];
        if (livePixelY >= 0 && livePixelY <= timeAxisY) {
          const lbl = lastC.close.toFixed(decPlaces);
          const w = getTextWidth(lbl);
          const labelX = cw - 8 * dpr - w;
          pushText(lbl, Math.floor(labelX), Math.floor(livePixelY));
        }
      }

      // ── Hover Tooltip Texts (WebGL Native) ──
      if (hoverPixel) {
        const hx = hoverPixel.x * dpr;
        const hy = hoverPixel.y * dpr;
        if (hx >= 0 && hx <= cw - pAxisW && hy >= 0 && hy <= timeAxisY) {
          const price = max - (hy / scaleY);
          const priceStr = price.toFixed(decPlaces);
          const wPrice = getTextWidth(priceStr);
          const centerX = Math.floor(cw - pAxisW + (pAxisW - wPrice) / 2);
          
          gl.uniform4fv(gl.getUniformLocation(progText, 'u_textColor'), darkMode ? [1.0, 1.0, 1.0, 1.0] : [0.0, 0.0, 0.0, 1.0]);
          pushText(priceStr, centerX, Math.floor(hy));

          const idx = logicalRange.from + ((hx / (cw - pAxisW)) * rangeLen);
          const cIdx = Math.min(candles.length - 1, Math.max(0, Math.floor(idx)));
          const c = candles[cIdx];
          if (c) {
            const timeMs = c.time < 10000000000 ? c.time * 1000 : c.time;
            const d = new Date(timeMs);
            const dd = d.getDate().toString().padStart(2, '0');
            const mo = d.toLocaleString('en-US', { month: 'short' });
            const yy = d.getFullYear().toString().slice(-2);
            const H = d.getHours().toString().padStart(2, '0');
            const M = d.getMinutes().toString().padStart(2, '0');
            const timeStr = `${dd} ${mo} '${yy} ${H}:${M}`;
            const timeW = getTextWidth(timeStr);
            pushText(timeStr, Math.floor(hx - timeW / 2), Math.floor(timeAxisY + timeAxisH / 2));
          }
          
          gl.uniform4fv(gl.getUniformLocation(progText, 'u_textColor'), textColor);
        }
      }

      if (textData.length > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.text);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textData), gl.DYNAMIC_DRAW);

        const aPos = gl.getAttribLocation(progText, 'a_position');
        const aUv = gl.getAttribLocation(progText, 'a_uv');

        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

        gl.drawArrays(gl.TRIANGLES, 0, textData.length / 4);

        gl.disableVertexAttribArray(aPos);
        gl.disableVertexAttribArray(aUv);
      }
    }

    if (onRequestDraw) onRequestDraw();
  };

  // Drag and Wheel interactions
  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startLogicalFrom = 0;
    let startLogicalTo = 0;
    let startPriceMin = 0;
    let startPriceMax = 0;

    const onPointerDown = (e) => {
      const { left, top } = canvas.getBoundingClientRect();
      const px = e.clientX - left;
      const py = e.clientY - top;

      const pAxisW = vState.current.pAxisW || 65;
      const isAxisClick = (px > cw - pAxisW) || (py > ch - (vState.current.timeAxisH || 28));

      if (isAxisClick) return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startLogicalFrom = vState.current.logicalRange.from;
      startLogicalTo = vState.current.logicalRange.to;
      startPriceMin = vState.current.priceRange.min;
      startPriceMax = vState.current.priceRange.max;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      const { left, top } = canvas.getBoundingClientRect();
      const px = e.clientX - left;
      const py = e.clientY - top;

      const cw = vState.current.width;
      const ch = vState.current.height;

      const { min, max } = vState.current.priceRange;
      const priceRange = max - min;
      const priceScale = priceRange > 0 ? (ch - (vState.current.timeAxisH || 28)) / priceRange : 1;
      const price = max - (py / priceScale);

      const logicalRange = vState.current.logicalRange;
      const rangeLen = logicalRange.to - logicalRange.from;
      const pAxisW_move = vState.current.pAxisW || 65;
      const idx = logicalRange.from + ((px / (cw - pAxisW_move)) * rangeLen);

      const cIdx = Math.min(candles.length - 1, Math.max(0, Math.floor(idx)));
      const c = candles[cIdx];
      const time = c?.time || 0;

      vState.current.hoverPixel = { x: px, y: py };

      if (!isDragging) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const candlesPerPixel = rangeLen / cw;
      const shift = dx * candlesPerPixel;

      vState.current.logicalRange.from = startLogicalFrom - shift;
      vState.current.logicalRange.to = startLogicalTo - shift;

      if (Math.abs(dy) > 2) vState.current.manualPriceScale = true;

      if (vState.current.manualPriceScale) {
        const priceScale = (ch - 26) / (startPriceMax - startPriceMin || 1);
        const priceShift = dy / priceScale;
        vState.current.priceRange.min = startPriceMin + priceShift;
        vState.current.priceRange.max = startPriceMax + priceShift;
      }

      if (onVisibleRangeChange && candles && candles.length > 0) {
        onVisibleRangeChange({
          from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
          to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
        });
      }
      scheduleRender();
    };

    const onPointerUp = (e) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    const onWheel = (e) => {
      e.preventDefault();
      const cw = vState.current.width;
      const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from;

      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const candlesPerPixel = rangeLen / cw;
        const shift = (e.deltaX * 0.5) * candlesPerPixel;
        vState.current.logicalRange.from += shift;
        vState.current.logicalRange.to += shift;
      } else {
        const zoomFactor = e.deltaY > 0 ? 1.05 : 0.95;
        const center = vState.current.logicalRange.from + (rangeLen / 2);
        const newLen = Math.max(10, Math.min(candles.length, rangeLen * zoomFactor));
        vState.current.logicalRange.from = center - (newLen / 2);
        vState.current.logicalRange.to = center + (newLen / 2);
      }

      if (onVisibleRangeChange && candles && candles.length > 0) {
        onVisibleRangeChange({
          from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
          to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
        });
      }
      scheduleRender();
    };

    const onPointerLeave = () => {
      isDragging = false;
      vState.current.hoverPixel = null;
      scheduleRender();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [candles, onVisibleRangeChange]);

  useImperativeHandle(ref, () => ({
    render: () => scheduleRender(),
    scrollToRealTime: () => {
      if (!candles || candles.length === 0) return;
      const lastIdx = candles.length - 1;
      const rangeLen = vState.current.logicalRange.to - vState.current.logicalRange.from || 100;
      const padding = rangeLen * 0.2;
      vState.current.logicalRange.from = lastIdx - rangeLen + padding;
      vState.current.logicalRange.to = lastIdx + padding;
      vState.current.manualPriceScale = false;
      scheduleRender();
      if (onVisibleRangeChange) {
        onVisibleRangeChange({
          from: candles[Math.max(0, Math.floor(vState.current.logicalRange.from))]?.time,
          to: candles[Math.min(candles.length - 1, Math.ceil(vState.current.logicalRange.to))]?.time
        });
      }
    },
    timeScale: () => ({
      getVisibleLogicalRange: () => vState.current.logicalRange,
      getVisibleRange: () => null,
      fitContent: () => { }
    }),
    priceScale: () => ({ applyOptions: () => { } }),
    captureViewport: () => ({ logicalRange: vState.current.logicalRange }),
    applyViewport: (vp) => { if (vp && vp.logicalRange) vState.current.logicalRange = vp.logicalRange; },
    getPixel: (time, price) => {
      const cw = vState.current.width * dpr;
      const ch = vState.current.height * dpr;
      const pAxisW = (vState.current.pAxisW || 65) * dpr;
      const timeAxisY = ch - ((vState.current.timeAxisH || 28) * dpr);

      const { min, max } = vState.current.priceRange;
      const priceRange = max - min;
      const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;

      const logicalRange = vState.current.logicalRange;
      const rangeLen = logicalRange.to - logicalRange.from;

      const idx = timeToIndex(time, candles);
      const x = ((idx - logicalRange.from) / rangeLen) * (cw - pAxisW);
      const y = timeAxisY - ((price - min) * priceScale);
      return { x: x / dpr, y: y / dpr };
    },
    coordinateToTimePrice: (x, y) => {
      if (!candles || candles.length === 0) return null;
      const cw = vState.current.width;
      const ch = vState.current.height;
      const pAxisW = vState.current.pAxisW || 65;
      const timeAxisY = ch - (vState.current.timeAxisH || 28);
      const chartW = cw - pAxisW;

      const logicalRange = vState.current.logicalRange;
      const rangeLen = logicalRange.to - logicalRange.from;

      const targetIdx = Math.round(logicalRange.from + (x / chartW) * rangeLen);
      const clampedIdx = Math.max(0, Math.min(candles.length - 1, targetIdx));
      const time = candles[clampedIdx]?.time || 0;

      const { min, max } = vState.current.priceRange;
      const priceRange = max - min;
      const priceScale = priceRange > 0 ? timeAxisY / priceRange : 1;
      const price = max - ((y) / (timeAxisY / priceRange));

      return { time, price };
    }
  }));

  renderRef.current = render;

  useEffect(() => {
    scheduleRender();
  }, [candles, drawings, visualIndicators, indicatorDataMap, darkMode]);

  return (
    <div ref={containerRef} className={`w-full h-full relative ${darkMode ? "bg-[#131722]" : "bg-[#ffffff]"} overflow-hidden cursor-crosshair`}>
      <canvas ref={glCanvasRef} className="absolute top-0 left-0 w-full h-full touch-none" />
    </div>
  );
});

export default WebGLChartEngine;
