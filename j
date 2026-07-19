# Precise Canvas Rendering Implementation Plan

This implementation plan details the technical steps to resolve the blurry, unprecise, and misaligned custom drawing tools (Trendlines, Fibonacci, etc.) overlaid on top of `lightweight-charts`.

## Problem Context
The current custom drawing implementation uses an HTML5 `<canvas>` element overlaid on the chart container. However, it lacks high-DPI scaling, precise sub-pixel rendering, and coordinate synchronization with the underlying chart's price scale. This results in fuzzy lines, drawing tools bleeding over the price scale, and floating drawings during window resizes.

## Proposed Changes

### 1. High-DPI Scaling (Device Pixel Ratio)
Modern screens require canvas scaling to avoid pixelated or fuzzy graphics.

#### [MODIFY] `c:/Users/satya/OneDrive/Documents/Desktop/satyam/src/App.jsx`
- **Resize Logic**: Update the logic where the canvas dimensions are set.
- Multiply `rect.width` and `rect.height` by `window.devicePixelRatio`.
- Set the `canvas.style.width` and `canvas.style.height` to the original CSS pixel values.
- Apply `ctx.scale(dpr, dpr)` before any drawing operations in `drawOnCanvas()`.

### 2. Coordinate Mismatch & Price Scale Bleeding
Currently, `timeToCoordinate()` returns X relative to the left of the chart pane, ignoring the right price scale. The canvas spans the full width, causing drawings to stretch or bleed over the price scale.

#### [MODIFY] `c:/Users/satya/OneDrive/Documents/Desktop/satyam/src/App.jsx`
- **Get Price Scale Width**: Read the right price scale width via `chartInstance.current.priceScale('right').width()`.
- **Clip Canvas / Adjust Width**: Either set the canvas CSS `width` to `calc(100% - ${priceScaleWidth}px)` OR apply a `ctx.clip()` region in `drawOnCanvas` so that lines (like horizontal rays) are physically cut off before entering the price scale area. 

### 3. Sub-Pixel Anti-Aliasing (The `+0.5` Hack)
HTML5 canvas tries to anti-alias 1px lines drawn on integer coordinates, resulting in 2px wide, fuzzy lines.

#### [MODIFY] `c:/Users/satya/OneDrive/Documents/Desktop/satyam/src/App.jsx`
- **Sub-pixel Alignment**: Create a helper function `const align = (val) => Math.floor(val) + 0.5;`
- Apply this helper function to all `ctx.moveTo(x, y)` and `ctx.lineTo(x, y)` calls inside `drawOnCanvas` (specifically inside `drawSingleShape`, `drawRay`, `drawExtendedLine`).

### 4. Synchronous Resize Handling (Floating Drawings Fix)
Chart resizing causes a desync between the `lightweight-charts` layout engine and the custom canvas state update.

#### [MODIFY] `c:/Users/satya/OneDrive/Documents/Desktop/satyam/src/App.jsx`
- **Resize Observer**: Ensure the `ResizeObserver` that handles the chart resize also directly handles the canvas resize and synchronously calls `drawOnCanvas()`. 
- Bypass `setState` delays for the physical canvas dimensions to guarantee a 1:1 sync with 60fps smoothness during layout changes.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
- Resize the browser window and confirm drawings stay perfectly anchored.
- Check on a mobile device or high-DPI monitor (e.g., Mac Retina) to ensure 1px lines are razor-sharp.
- Draw a horizontal line and confirm it stops exactly where the right price scale begins (no bleeding).
