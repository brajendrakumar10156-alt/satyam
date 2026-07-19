const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, 'src_demo', 'App.jsx');
const CONTEXT_PATH = path.join(__dirname, 'src_demo', 'context', 'TradingContext.jsx');

if (!fs.existsSync(path.dirname(CONTEXT_PATH))) {
  fs.mkdirSync(path.dirname(CONTEXT_PATH), { recursive: true });
}

let appCode = fs.readFileSync(APP_PATH, 'utf8');

// Find the start of the App component
const appStartMatch = appCode.match(/export default function App\([^)]*\)\s*\{/);
if (!appStartMatch) {
  console.error("Could not find App function");
  process.exit(1);
}

const appStartIndex = appStartMatch.index + appStartMatch[0].length;

// Find the return statement of the App component
let returnIndex = appCode.indexOf('  return (', appStartIndex);
if (returnIndex === -1) {
    returnIndex = appCode.indexOf('\n  return (', appStartIndex);
}

if (returnIndex === -1) {
  console.error("Could not find return statement");
  process.exit(1);
}

// Extract the state and effects block
const stateAndEffects = appCode.substring(appStartIndex, returnIndex);

// We need to identify all top-level variables defined in stateAndEffects so we can provide them in context.
const varRegex = /(?:const|let|var)\s+(?:\[([^\]]+)\]|([a-zA-Z0-9_$]+))\s*=/g;
const exportedVars = new Set();
let match;
while ((match = varRegex.exec(stateAndEffects)) !== null) {
  if (match[1]) {
    // Array destructuring (e.g., const [a, b] = ...)
    const vars = match[1].split(',').map(v => v.trim()).filter(v => v);
    vars.forEach(v => {
      // Remove default assignments if any
      const cleanVar = v.split('=')[0].trim();
      if (cleanVar) exportedVars.add(cleanVar);
    });
  } else if (match[2]) {
    exportedVars.add(match[2].trim());
  }
}

// Also find all top-level function declarations
const funcRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
while ((match = funcRegex.exec(stateAndEffects)) !== null) {
  exportedVars.add(match[1]);
}

// Filter out some stuff we shouldn't export if it's obvious, but exporting all is safer.
const varsList = Array.from(exportedVars);

const contextCode = `
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { fetchExchangeSymbols, fetchExchangeCandles, subscribeExchangeKline, isPerpetualSymbol, parseUnifiedSymbol, getExchangeMeta } from '../exchanges';
import { exportTradesCsv, downloadStrategyFile, parseBacktestNumber, normalizeEquityCurve, DEFAULT_PYTHON_STRATEGY } from '../tradingFeatures';
import { loadCandleCache, saveCandleCache } from '../candleCache';
import { captureViewportSnapshot, generateDrawingId } from '../utils/drawingStore';
import { loadDrawingsFromDB, saveDrawingsToDB } from '../utils/drawingPersistence';

export const TradingContext = createContext({});

export function useTradingContext() {
  return useContext(TradingContext);
}

export function TradingProvider({ children, onLogout, onBackToCoins }) {
${stateAndEffects}

  const contextValue = {
    onLogout,
    onBackToCoins,
    ${varsList.join(',\n    ')}
  };

  return (
    <TradingContext.Provider value={contextValue}>
      {children}
    </TradingContext.Provider>
  );
}
`;

fs.writeFileSync(CONTEXT_PATH, contextCode);

// Now generate the Shell App
// The Shell App will just destructure everything from the context and render the UI.
const shellAppCode = `
import React, { Suspense, lazy } from 'react';
import { useTradingContext } from './context/TradingContext';
// ... other imports ...

export default function App() {
  const {
    ${varsList.join(',\n    ')}
  } = useTradingContext();

  return (
    // ... UI ...
  );
}
`;

console.log("Extracted variables count:", varsList.length);
console.log("Successfully generated TradingContext.jsx");
