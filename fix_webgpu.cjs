const fs = require('fs');
let code = fs.readFileSync('src_demo/App.jsx', 'utf8');

const targetStr = `                          </Suspense>
                        </WebGLErrorBoundary>
                      ) : null}`;

const insertStr = `                          </Suspense>
                        </WebGLErrorBoundary>
                      ) : (renderEngine === 'webgpu') ? (
                        <WebGLErrorBoundary onError={(error) => {
                          setRenderEngine('canvas2d');
                          showToast('WebGPU Error: ' + error.message);
                        }}>
                          <Suspense fallback={
                            <div className="w-full h-full flex items-center justify-center" 
                               style={{ background: darkMode ? '#131722' : '#ffffff' }}>
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                              <Zap size={36} className="text-purple-400" />
                              <span className="\`text-sm font-medium \${t.muted}\`">WebGPU Engine Loading...</span>
                            </div>
                          </div>
                        }>
                          <WebGPUChartEngine
                            ref={webGLEngineRef}
                            isHoveringDrawing={isHoveringDrawing}
                            candles={allCandles}
                            drawings={drawings}
                            brushPath={brushPath}
                            tempShape={tempShape}
                            drawStart={drawStart}
                            activeTool={activeTool}
                            visualIndicators={visualIndicators}
                            indicatorDataMap={indicatorDataMapRef.current}
                            darkMode={darkMode}
                            autoScale={autoScale}
                            initialVisibleRange={initialViewport?.logicalRange}
                            onVisibleRangeChange={handleVisibleRangeChange}
                            onChartReady={() => {}}
                            timezoneOffset={timezoneOffset}
                          />
                          </Suspense>
                        </WebGLErrorBoundary>
                      ) : null}`;

code = code.replace(targetStr, insertStr);

fs.writeFileSync('src_demo/App.jsx', code, 'utf8');
console.log('done fixing webgpu render');
