import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Application, Graphics, Container, Text } from 'pixi.js';
import { renderDrawing } from '../utils/drawingRenderer';
import { isDrawingInRange } from '../utils/drawingStore';
import { renderVolumeProfile, renderSessionDividers, renderHoverTools } from '../utils/chartOverlaysRenderer';

const PixiDrawingLayer = forwardRef(({
  width,
  height,
  drawings,
  brushPath,
  tempShape,
  drawStart,
  activeTool,
  getPixel,
  allCandles,
  visibleRange,
  selectedDrawingId,
  hideDrawings,
  volumeProfile,
  darkMode,
  cursorSettings,
  hoverCoords,
  magicTrail,
  coordinateToTimePrice,
  preference = 'webgl' // Accept preference (webgl or webgpu)
}, ref) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const graphicsRef = useRef(null);
  const textContainerRef = useRef(null);

  // We use imperative handle so App.jsx can trigger a draw without a React re-render
  // This matches the performance profile of requestDraw() in raw Canvas 2D
  useImperativeHandle(ref, () => ({
    draw: () => {
      renderAll();
    }
  }));

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    let isMounted = true;
    const initPixi = async () => {
      const app = new Application();
      await app.init({
        resizeTo: containerRef.current,
        backgroundAlpha: 0,
        preference: preference,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      if (!isMounted || !containerRef.current) {
        app.destroy(true, { children: true });
        return;
      }
      
      containerRef.current.appendChild(app.canvas);
      app.canvas.style.position = 'absolute';
      app.canvas.style.top = '0';
      app.canvas.style.left = '0';
      app.canvas.style.pointerEvents = 'none';
      app.canvas.style.zIndex = '10';

      const graphics = new Graphics();
      app.stage.addChild(graphics);
      graphicsRef.current = graphics;

      const textContainer = new Container();
      app.stage.addChild(textContainer);
      textContainerRef.current = textContainer;

      appRef.current = app;
      
      renderAll();
    };

    initPixi();

    return () => {
      isMounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  // If props change, we also want to trigger a render
  useEffect(() => {
    renderAll();
  }, [drawings, brushPath, tempShape, drawStart, activeTool, getPixel, allCandles, visibleRange, selectedDrawingId, hideDrawings, volumeProfile, darkMode, cursorSettings, hoverCoords, magicTrail]);

  const renderAll = () => {
    if (!appRef.current || !graphicsRef.current || !textContainerRef.current) return;
    const graphics = graphicsRef.current;
    const textContainer = textContainerRef.current;

    graphics.clear();
    
    // Efficiently destroy old text labels (in a real high-frequency app we'd pool these)
    textContainer.removeChildren().forEach(c => c.destroy());

    if (hideDrawings) return;
    if (!getPixel) return;

    const drawText = (text, x, y, style) => {
      const t = new Text({ text: text.toString(), style: { ...style, fontFamily: style.fontFamily || 'sans-serif' } });
      t.x = x;
      t.y = y;
      textContainer.addChild(t);
    };

    const actualWidth = appRef.current.renderer.width;
    const actualHeight = appRef.current.renderer.height;

    // Apply strict axis clip mask: clip drawings inside chart area (excluding right price axis & bottom time axis)
    if (graphics) {
      let maskGraphics = appRef.current.stage.mask;
      if (!maskGraphics) {
        maskGraphics = new Graphics();
        appRef.current.stage.addChild(maskGraphics);
        appRef.current.stage.mask = maskGraphics;
      }
      maskGraphics.clear();
      maskGraphics.rect(0, 0, Math.max(10, actualWidth - 60), Math.max(10, actualHeight - 30));
      maskGraphics.fill({ color: 0xffffff });
    }

    const options = { width: actualWidth, height: actualHeight, allCandles, visibleRange, darkMode, cursorSettings, hoverCoords, magicTrail, activeTool, coordinateToTimePrice };

    if (volumeProfile) {
      renderVolumeProfile(graphics, options, getPixel);
    }
    
    renderSessionDividers(graphics, options, getPixel);

    // Render permanent drawings
    drawings.forEach((d) => {
      if (!isDrawingInRange(d, visibleRange)) return;
      const isSelected = selectedDrawingId === d.id;
      renderDrawing(d, graphics, getPixel, drawText, options, false, isSelected);
    });

    // Render active brush stroke
    if (brushPath && brushPath.length > 0) {
      renderDrawing({ type: 'brush', points: brushPath }, graphics, getPixel, drawText, options, true);
    }

    // Render temporary shape
    if (drawStart && tempShape && activeTool && activeTool !== 'brush') {
      renderDrawing({ type: activeTool, start: drawStart, end: tempShape }, graphics, getPixel, drawText, options, true);
    }

    renderHoverTools(graphics, drawText, options);
  };

  return <div ref={containerRef} className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }} />;
});

export default PixiDrawingLayer;
