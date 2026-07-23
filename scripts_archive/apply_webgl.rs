use std::fs;
use std::io::{self, Write};
use std::path::Path;

fn main() -> io::Result<()> {
    let target_file = "src_demo/App.tsx";
    
    // Read the entire file to a string
    let mut content = fs::read_to_string(target_file)?;
    
    // 1. React imports
    content = content.replace(
        "import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';",
        "import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense, lazy } from 'react';"
    );
    
    // 2. WebGL lazy import + store helper
    content = content.replace(
        "import WebGLChartEngine from './components/WebGLChartEngine';",
        "const WebGLChartEngine = lazy(() => import('./components/WebGLChartEngine'));\nimport { captureViewportSnapshot } from './utils/drawingStore';"
    );
    
    // 3. State & Toggle Handler
    // Note: Rust regex could be used, but since it's a fixed string replacement, let's use exact match or basic replace
    let state_search = "const [useWebGL, setUseWebGL] = useState(false);\n  const webGLEngineRef = useRef<any>(null);";
    let toggle_code = r#"const [useWebGL, setUseWebGL] = useState(() => {
    return localStorage.getItem('renderEngine') === 'webgl';
  });
  const viewportSnapshotRef = useRef<any>(null);

  const handleEngineToggle = useCallback(() => {
    if (isDrawing) {
      setToastMsg('⚠️ Pehle drawing complete karo, phir toggle karo');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    if (chartInstance.current) {
      viewportSnapshotRef.current = captureViewportSnapshot(
        chartInstance.current, priceScaleMode, autoScale
      );
    }
    setSelectedDrawingIndex(null);
    setFloatingToolbarCoords(null);
    setHoverCoords(null);
    setActiveFlyout(null);
    const nextMode = !useWebGL;
    setUseWebGL(nextMode);
    localStorage.setItem('renderEngine', nextMode ? 'webgl' : '2d');
    setToastMsg(nextMode ? '⚡ WebGL Engine — GPU Accelerated' : '🎨 Canvas 2D Engine');
    setTimeout(() => setToastMsg(''), 3000);
  }, [useWebGL, isDrawing, priceScaleMode, autoScale]);"#;
    content = content.replace(state_search, toggle_code);
    
    // 4. Update the Chart Area JSX
    let chart_render_block = r#"<div ref={chartRef} className="w-full h-full absolute top-0 left-0" />"#;
    let new_chart_render_block = r#"{useWebGL ? (
                        <Suspense fallback={
                          <div className="w-full h-full flex items-center justify-center" 
                               style={{ background: darkMode ? '#131722' : '#ffffff' }}>
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                              <Zap size={36} className="text-emerald-400" />
                              <span className={`text-sm font-medium ${t.muted}`}>WebGL Engine Loading...</span>
                            </div>
                          </div>
                        }>
                          <WebGLChartEngine
                            candles={allCandles}
                            drawings={drawings}
                            brushPath={brushPath}
                            tempShape={tempShape}
                            drawStart={drawStart}
                            activeTool={activeTool}
                            visualIndicators={visualIndicators}
                            indicatorDataMap={indicatorDataMapRef.current}
                            darkMode={darkMode}
                            chartStyle={chartStyle}
                            chartInterval={chartInterval}
                            selectedCoin={selectedCoin}
                            volumeProfile={volumeProfile}
                            priceScaleMode={priceScaleMode}
                            autoScale={autoScale}
                            invertScale={invertScale}
                            hideDrawings={hideDrawings}
                            cursorSettings={cursorSettings}
                            hoverCoords={hoverCoords}
                            selectedDrawingIndex={selectedDrawingIndex}
                            initialVisibleRange={viewportSnapshotRef.current}
                            onCrosshairMove={(x, y) => { /* Optional crosshair sync */ }}
                            onVisibleRangeChange={(range) => {
                              if (range?.from && range?.to) {
                                // Keep range saved if needed
                              }
                            }}
                            onChartReady={() => {
                              viewportSnapshotRef.current = null;
                            }}
                          />
                        </Suspense>
                      ) : (
                        <div ref={chartRef} className="w-full h-full absolute top-0 left-0" />
                      )}"#;
    content = content.replace(chart_render_block, new_chart_render_block);
    
    // 5. Toggle Button UI
    let manage_drawings_flyout = "{/* MANAGE DRAWINGS FLYOUT */}";
    let new_toggle_button = r#"{/* ⚡ Rendering Engine Toggle */}
          <button
            onClick={handleEngineToggle}
            className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-300 ${
              useWebGL 
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                : `${t.muted} ${t.hover}`
            }`}
            title={`Rendering: ${useWebGL ? 'WebGL (GPU Accelerated)' : 'Canvas 2D'}`}
          >
            <Zap size={18} strokeWidth={2} className={useWebGL ? 'drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]' : ''} />
            {useWebGL && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
            )}
          </button>
          <div className="w-6 h-px bg-border my-1" />
          
          {/* MANAGE DRAWINGS FLYOUT */}"#;
    content = content.replace(manage_drawings_flyout, new_toggle_button);
    
    // 6. Cleanup effect
    let cleanup_effect = r#"// Engine lifecycle: destroy old engine on toggle
  useEffect(() => {
    if (useWebGL) {
      if (chartInstance.current) {
        Object.keys(subChartsMapRef.current).forEach(id => {
          try {
            subChartsMapRef.current[id].unsubscribeSync?.();
            subChartsMapRef.current[id].chart.remove();
          } catch (e) {}
        });
        subChartsMapRef.current = {};
        chartInstance.current.remove();
        chartInstance.current = null;
        candleSeries.current = null;
        volumeSeries.current = null;
        indicatorSeriesRef.current = {};
        setChartCreated(false);
      }
    }
  }, [useWebGL]);

// ─── Theme Management ───"#;
    content = content.replace("// ─── Theme Management ───", cleanup_effect);
    
    // Write back to file
    fs::write(target_file, content)?;
    println!("✅ Success: {} successfully patched using Native Rust.", target_file);
    
    Ok(())
}
