const fs = require('fs');
let code = fs.readFileSync('src/WebContainer.tsx', 'utf8');

// 1. Extract Websockets
const wsStart = code.indexOf('let disposed = false;\n    let unsubWs = null;');
if (wsStart !== -1) {
    const useEffectStart = code.lastIndexOf('useEffect(() => {', wsStart);
    let brace = 0;
    let wsEnd = -1;
    for (let i = useEffectStart; i < code.length; i++) {
        if (code[i] === '{') brace++;
        if (code[i] === '}') {
            brace--;
            if (brace === 0) {
                wsEnd = code.indexOf(';', i) + 1;
                if (wsEnd === 0 || wsEnd - i > 10) wsEnd = i + 1;
                break;
            }
        }
    }
    if (wsEnd !== -1 && wsEnd > useEffectStart) {
        const wsCode = code.substring(useEffectStart, wsEnd);
        fs.writeFileSync('src/hooks/useMarketWebsockets.ts', 
            `import { useEffect, useRef } from 'react';\n\nexport const useMarketWebsockets = (props: any) => {\n  const { selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline } = props;\n\n${wsCode}\n};\n`
        );
        code = code.substring(0, useEffectStart) + '\n  useMarketWebsockets({ selectedCoin, selectedExchange, fetchGenerationRef, handleRawTrade, upsertLiveCandle, setMarketStatus, chartInterval, isBacktesting, backendOnline });\n' + code.substring(wsEnd);
        console.log('Extracted Websockets logic');
    }
}

// 2. Extract Lightweight Charts Init
const chartStart = code.indexOf('const chart = createChart(chartRef.current, {');
if (chartStart !== -1) {
    const useEffectStart = code.lastIndexOf('useEffect(() => {', chartStart);
    let brace = 0;
    let chartEnd = -1;
    for (let i = useEffectStart; i < code.length; i++) {
        if (code[i] === '{') brace++;
        if (code[i] === '}') {
            brace--;
            if (brace === 0) {
                chartEnd = code.indexOf(';', i) + 1;
                if (chartEnd === 0 || chartEnd - i > 10) chartEnd = i + 1;
                break;
            }
        }
    }
    if (chartEnd !== -1 && chartEnd > useEffectStart) {
        const chartCode = code.substring(useEffectStart, chartEnd);
        fs.writeFileSync('src/hooks/useLightweightCharts.ts', 
            `import { useEffect } from 'react';\nimport { createChart, CrosshairMode } from 'lightweight-charts';\n\nexport const useLightweightCharts = (props: any) => {\n  const { chartRef, renderEngine, chartInstance, candleSeries, t, darkMode, selectedCoin, subChartsMapRef, isDrawing, handleNativeWheel } = props;\n\n${chartCode}\n};\n`
        );
        code = code.substring(0, useEffectStart) + '\n  useLightweightCharts({ chartRef, renderEngine, chartInstance, candleSeries, t, darkMode, selectedCoin, subChartsMapRef, isDrawing, handleNativeWheel });\n' + code.substring(chartEnd);
        console.log('Extracted Lightweight Charts logic');
    }
}

// 3. Extract Drawing Overlays Logic
const drawStart = code.indexOf("const activeOverlays = visualIndicators.filter(ind => ind.visible && INDICATOR_REGISTRY[ind.type]?.kind === 'overlay');");
if (drawStart !== -1) {
    const useEffectStart = code.lastIndexOf('useEffect(() => {', drawStart);
    let brace = 0;
    let drawEnd = -1;
    for (let i = useEffectStart; i < code.length; i++) {
        if (code[i] === '{') brace++;
        if (code[i] === '}') {
            brace--;
            if (brace === 0) {
                drawEnd = code.indexOf(';', i) + 1;
                if (drawEnd === 0 || drawEnd - i > 10) drawEnd = i + 1;
                break;
            }
        }
    }
    if (drawEnd !== -1 && drawEnd > useEffectStart) {
        const drawCode = code.substring(useEffectStart, drawEnd);
        fs.writeFileSync('src/hooks/useDrawingOverlays.ts', 
            `import { useEffect } from 'react';\nimport { INDICATOR_REGISTRY } from '../indicatorsRegistry';\n\nexport const useDrawingOverlays = (props: any) => {\n  const { chartInstance, chartCreated, visualIndicators, latestCandleRef } = props;\n\n${drawCode}\n};\n`
        );
        code = code.substring(0, useEffectStart) + '\n  useDrawingOverlays({ chartInstance, chartCreated, visualIndicators, latestCandleRef });\n' + code.substring(drawEnd);
        console.log('Extracted Drawing Overlays logic');
    }
}

// Add Imports
const imports = `import { useMarketWebsockets } from './hooks/useMarketWebsockets';
import { useLightweightCharts } from './hooks/useLightweightCharts';
import { useDrawingOverlays } from './hooks/useDrawingOverlays';
`;
code = code.replace("import { RightToolbar } from './components/layout/RightToolbar';", imports + "import { RightToolbar } from './components/layout/RightToolbar';");

fs.writeFileSync('src/WebContainer.tsx', code);
console.log('WebContainer patched successfully!');
