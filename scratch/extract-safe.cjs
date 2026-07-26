const fs = require('fs');
const code = fs.readFileSync('src/WebContainer.tsx', 'utf8');
const lines = code.split('\n');

// --- 1. Extract BottomPanel ---
// We need to find the start and end of the BottomPanel JSX
// Let's find: <div className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"
const bottomPanelStartStr = 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"';
const bottomPanelIdx = lines.findIndex(l => l.includes(bottomPanelStartStr)) - 1; // get the <div line
// It ends right before {/* Floating Modals */}
const bottomPanelEndIdx = lines.findIndex(l => l.includes('{/* Floating Modals */}')) - 2;

const bottomPanelLines = lines.slice(bottomPanelIdx, bottomPanelEndIdx);

const bottomPanelComponent = `import React, { useMemo } from 'react';
import { Activity, X, ChevronUp, ChevronDown, Check, Download, Layers, Crosshair, Pin, PinOff, BarChartHorizontal, Calendar, DollarSign, Filter, Code, Info, ListFilter, Minimize2, Maximize2 } from 'lucide-react';
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, AreaChart, Legend } from 'recharts';

export interface BottomPanelProps {
  darkMode: boolean;
  themeConfig: any;
  lowerBoxState: string;
  setLowerBoxState: (state: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isReportPinned: boolean;
  setIsReportPinned: (pinned: boolean) => void;
  getLowerBoxHeight: () => string;
  metrics: any;
  strategy: any;
  formatMoney: (val: number, showSign?: boolean) => string;
  formatNumber: (val: number) => string;
  formatShortNumber: (val: number) => string;
  equityChartData: any[];
  winRateChartData: any[];
  profitDistribution: any[];
  longShortData: any[];
  isMobile: boolean;
  setShowPredictionReport: (show: boolean) => void;
  downloadReportScreenshot: () => void;
  backendOfflineNotice: string | null;
  balance: number;
  unrealizedPnl: number;
  positions: any[];
  leverage: number;
  selectedCoin: string;
  livePrice: number;
  marginMode: string;
  setMarginMode: (mode: string) => void;
  setLeverage: (lev: number) => void;
  orderType: string;
  setOrderType: (type: string) => void;
  useTPSL: boolean;
  orderLimitPrice: string;
  setOrderLimitPrice: (price: string) => void;
  orderQty: string;
  setOrderQty: (qty: string) => void;
  getBaseAsset: (coin: string) => string;
  setUseTPSL: (use: boolean) => void;
  tpPrice: string;
  setTpPrice: (p: string) => void;
  slPrice: string;
  setSlPrice: (p: string) => void;
  postOnly: boolean;
  setPostOnly: (p: boolean) => void;
  reduceOnly: boolean;
  setReduceOnly: (p: boolean) => void;
  executeTrade: (side: 'BUY'|'SELL') => void;
  closeAllPositions: () => void;
  cancelAllOrders: () => void;
  activeOrders: any[];
  cancelOrder: (id: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  darkMode,
  themeConfig: t,
  lowerBoxState,
  setLowerBoxState,
  activeTab,
  setActiveTab,
  isReportPinned,
  setIsReportPinned,
  getLowerBoxHeight,
  metrics,
  strategy,
  formatMoney,
  formatNumber,
  formatShortNumber,
  equityChartData,
  winRateChartData,
  profitDistribution,
  longShortData,
  isMobile,
  setShowPredictionReport,
  downloadReportScreenshot,
  backendOfflineNotice,
  balance,
  unrealizedPnl,
  positions,
  leverage,
  selectedCoin,
  livePrice,
  marginMode,
  setMarginMode,
  setLeverage,
  orderType,
  setOrderType,
  useTPSL,
  orderLimitPrice,
  setOrderLimitPrice,
  orderQty,
  setOrderQty,
  getBaseAsset,
  setUseTPSL,
  tpPrice,
  setTpPrice,
  slPrice,
  setSlPrice,
  postOnly,
  setPostOnly,
  reduceOnly,
  setReduceOnly,
  executeTrade,
  closeAllPositions,
  cancelAllOrders,
  activeOrders,
  cancelOrder
}) => {
  return (
    <>
${bottomPanelLines.join('\n')}
    </>
  );
};
`;

fs.writeFileSync('src/components/layout/BottomPanel.tsx', bottomPanelComponent);

// --- 2. Extract PineEditorPanel ---
const pineEditorStartStr = "const renderEditorPanel = (className = '', onClose = null) => (";
const pineEditorIdx = lines.findIndex(l => l.includes(pineEditorStartStr));

// Find the end of renderEditorPanel correctly
let depth = 0;
let pineEditorEndIdx = -1;
for (let i = pineEditorIdx; i < lines.length; i++) {
  for (let char of lines[i]) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
  }
  if (depth === 0 && lines[i].trim() === ');') {
    pineEditorEndIdx = i;
    break;
  }
}

const pineEditorLines = lines.slice(pineEditorIdx + 1, pineEditorEndIdx);

const pineEditorComponent = `import React, { Suspense, lazy } from 'react';
import { Play, RefreshCw, X, FolderOpen, Save, Settings, Maximize2, Minimize2, Sparkles, Undo, Redo, FileDiff } from 'lucide-react';

const EditorLazy = lazy(() => import('@monaco-editor/react'));
const Editor = (props: any) => <Suspense fallback={<div className="p-4 text-center text-gray-500 text-xs">Loading Code Editor...</div>}><EditorLazy {...props} /></Suspense>;

export interface PineEditorPanelProps {
  className?: string;
  onClose?: (() => void) | null;
  t: any;
  darkMode: boolean;
  loading: boolean;
  runBacktest: () => void;
  editorRef: any;
  editorContent: string;
  setEditorContent: (c: string) => void;
  monacoEditorRef: any;
  consoleOutput: string[];
  compileError: string | null;
  renderTriangleRIcon: () => React.ReactNode;
  
  setEditorMode: (mode: string) => void;
  editorMode: string;
  pineCode: string;
  pythonCode: string;
  showDiff: boolean;
  setShowDiff: (val: boolean) => void;
  setBaseCode: (code: string) => void;
  setSubView: (view: string) => void;
  getSubView: () => string;
  aiProvider: string;
  setAiProvider: (provider: string) => void;
  handleUndo: () => void;
  historyIndex: number;
  codeHistory: any[];
  handleRedo: () => void;
  sendAiMessage: (msg: string) => void;
  DEFAULT_PYTHON_STRATEGY: string;
  handleCodeChange: (val: string | undefined) => void;
  renderDiffViewer: () => React.ReactNode;
  AiChatPanel: React.FC;
  syntaxStatus: string;
  checkBackend: () => Promise<boolean>;
  showToast: (msg: string) => void;
  backendOnline: boolean | null;
}

export const PineEditorPanel: React.FC<PineEditorPanelProps> = ({
  className = '',
  onClose = null,
  t,
  darkMode,
  loading,
  runBacktest,
  editorRef,
  editorContent,
  setEditorContent,
  monacoEditorRef,
  consoleOutput,
  compileError,
  renderTriangleRIcon,
  setEditorMode,
  editorMode,
  pineCode,
  pythonCode,
  showDiff,
  setShowDiff,
  setBaseCode,
  setSubView,
  getSubView,
  aiProvider,
  setAiProvider,
  handleUndo,
  historyIndex,
  codeHistory,
  handleRedo,
  sendAiMessage,
  DEFAULT_PYTHON_STRATEGY,
  handleCodeChange,
  renderDiffViewer,
  AiChatPanel,
  syntaxStatus,
  checkBackend,
  showToast,
  backendOnline
}) => {
  return (
${pineEditorLines.join('\n')}
  );
};
`;

fs.writeFileSync('src/components/layout/PineEditorPanel.tsx', pineEditorComponent);

// --- 3. Replace in WebContainer.tsx ---

const bottomPanelReplacement = `
        <BottomPanel
          darkMode={darkMode}
          themeConfig={t}
          lowerBoxState={lowerBoxState}
          setLowerBoxState={setLowerBoxState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isReportPinned={isReportPinned}
          setIsReportPinned={setIsReportPinned}
          getLowerBoxHeight={getLowerBoxHeight}
          metrics={metrics}
          strategy={strategy}
          formatMoney={formatMoney}
          formatNumber={formatNumber}
          formatShortNumber={formatShortNumber}
          equityChartData={equityChartData}
          winRateChartData={winRateChartData}
          profitDistribution={profitDistribution}
          longShortData={longShortData}
          isMobile={isMobile}
          setShowPredictionReport={setShowPredictionReport}
          downloadReportScreenshot={downloadReportScreenshot}
          backendOfflineNotice={backendOfflineNotice}
          balance={balance}
          unrealizedPnl={unrealizedPnl}
          positions={positions}
          leverage={leverage}
          selectedCoin={selectedCoin}
          livePrice={livePrice}
          marginMode={marginMode}
          setMarginMode={setMarginMode}
          setLeverage={setLeverage}
          orderType={orderType}
          setOrderType={setOrderType}
          useTPSL={useTPSL}
          orderLimitPrice={orderLimitPrice}
          setOrderLimitPrice={setOrderLimitPrice}
          orderQty={orderQty}
          setOrderQty={setOrderQty}
          getBaseAsset={getBaseAsset}
          setUseTPSL={setUseTPSL}
          tpPrice={tpPrice}
          setTpPrice={setTpPrice}
          slPrice={slPrice}
          setSlPrice={setSlPrice}
          postOnly={postOnly}
          setPostOnly={setPostOnly}
          reduceOnly={reduceOnly}
          setReduceOnly={setReduceOnly}
          executeTrade={executeTrade}
          closeAllPositions={closeAllPositions}
          cancelAllOrders={cancelAllOrders}
          activeOrders={activeOrders}
          cancelOrder={cancelOrder}
        />
`;

const pineEditorReplacement = `  const renderEditorPanel = (className = '', onClose = null) => (
    <PineEditorPanel 
      className={className} 
      onClose={onClose} 
      t={t}
      darkMode={darkMode}
      loading={loading}
      runBacktest={runBacktest}
      editorRef={editorRef}
      editorContent={editorContent}
      setEditorContent={setEditorContent}
      monacoEditorRef={monacoEditorRef}
      consoleOutput={consoleOutput}
      compileError={compileError}
      renderTriangleRIcon={renderTriangleRIcon}
      setEditorMode={setEditorMode}
      editorMode={editorMode}
      pineCode={pineCode}
      pythonCode={pythonCode}
      showDiff={showDiff}
      setShowDiff={setShowDiff}
      setBaseCode={setBaseCode}
      setSubView={setSubView}
      getSubView={getSubView}
      aiProvider={aiProvider}
      setAiProvider={setAiProvider}
      handleUndo={handleUndo}
      historyIndex={historyIndex}
      codeHistory={codeHistory}
      handleRedo={handleRedo}
      sendAiMessage={sendAiMessage}
      DEFAULT_PYTHON_STRATEGY={DEFAULT_PYTHON_STRATEGY}
      handleCodeChange={handleCodeChange}
      renderDiffViewer={renderDiffViewer}
      AiChatPanel={AiChatPanel}
      syntaxStatus={syntaxStatus}
      checkBackend={checkBackend}
      showToast={showToast}
      backendOnline={backendOnline}
    />
  );`;

let newLines = [
  ...lines.slice(0, pineEditorIdx),
  pineEditorReplacement,
  ...lines.slice(pineEditorEndIdx + 1, bottomPanelIdx),
  bottomPanelReplacement,
  ...lines.slice(bottomPanelEndIdx)
];

let newCode = newLines.join('\n');
newCode = "import { PineEditorPanel } from './components/layout/PineEditorPanel';\nimport { BottomPanel } from './components/layout/BottomPanel';\n" + newCode;

fs.writeFileSync('src/WebContainer.tsx', newCode);
console.log('Done!');
