const fs = require('fs');

let code = fs.readFileSync('src/WebContainer.tsx', 'utf8');

// 1. Extract PineEditorPanel
const pineEditorStartStr = "const renderEditorPanel = (className = '', onClose = null) => (";
const pineIdx = code.indexOf(pineEditorStartStr);
let depth = 0;
let pineEndIdx = -1;
for (let i = pineIdx; i < code.length; i++) {
  if (code[i] === '(') depth++;
  else if (code[i] === ')') depth--;
  if (depth === 0 && code.slice(i, i+2) === ');') {
    pineEndIdx = i + 2;
    break;
  }
}

const pineEditorContent = code.substring(pineIdx + pineEditorStartStr.length, pineEndIdx - 2);

// 2. Extract BottomPanel
const bottomPanelStartStr = 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"';
const bottomDivStart = code.lastIndexOf('<div', code.indexOf(bottomPanelStartStr));
const bottomPanelEndStr = '{/* Floating Modals */}';
const bottomEndIdx = code.indexOf(bottomPanelEndStr);

const bottomPanelContent = code.substring(bottomDivStart, bottomEndIdx);

// Now write them out!
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
  AiChatPanel: React.FC<any>;
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
${pineEditorContent}
  );
};
`;
fs.writeFileSync('src/components/layout/PineEditorPanel.tsx', pineEditorComponent);

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
${bottomPanelContent}
    </>
  );
};
`;
fs.writeFileSync('src/components/layout/BottomPanel.tsx', bottomPanelComponent);

// 3. Replace in WebContainer
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

let newCode = code.substring(0, pineIdx) + pineEditorReplacement + code.substring(pineEndIdx);

const bottomDivStartNew = newCode.lastIndexOf('<div', newCode.indexOf(bottomPanelStartStr));
const bottomEndIdxNew = newCode.indexOf(bottomPanelEndStr);

newCode = newCode.substring(0, bottomDivStartNew) + bottomPanelReplacement + newCode.substring(bottomEndIdxNew);

newCode = "import { PineEditorPanel } from './components/layout/PineEditorPanel';\nimport { BottomPanel } from './components/layout/BottomPanel';\n" + newCode;

fs.writeFileSync('src/WebContainer.tsx', newCode);
console.log('Done!');
