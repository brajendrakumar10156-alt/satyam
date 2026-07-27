const fs = require('fs');

const path = 'src/WebContainer.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add imports if missing
if (!code.includes('import TradingPanel')) {
  code = code.replace(
    "import { TopNavbar } from './components/layout/TopNavbar';",
    "import { TopNavbar } from './components/layout/TopNavbar';\nimport TradingPanel from './components/layout/TradingPanel';\nimport { PineEditorPanel } from './components/layout/PineEditorPanel';"
  );
}

// 2. Replace renderEditorPanel dummy
const dummyEditorPanel = 'const renderEditorPanel = () => null;';
const actualEditorPanel = `const renderEditorPanel = () => (
    <PineEditorPanel 
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

code = code.replace(dummyEditorPanel, actualEditorPanel);

// 3. Replace the massive inline TradingPanel (Strategy Tester and Trading Panel HTML was here)
const tradingPanelStart = '<div \n          className={`w-full ${t.bg} flex flex-col min-h-0 transition-all duration-300 ${lowerBoxState === \'hidden\' ? \'\' : `border-t ${t.border} shadow-lg`} z-10 ${getLowerBoxHeight()}`}\n          onMouseLeave={() => { \n            if (!isReportPinned && lowerBoxState === \'minimized\') {\n              setLowerBoxState(\'hidden\'); \n            }\n          }}\n        >';
const tradingPanelEnd = '{/* Strategy Tester and Trading Panel HTML was here (Extracted to TradingPanel.tsx) */}\n        </div>';

const startIndex = code.indexOf(tradingPanelStart);
const endIndex = code.indexOf(tradingPanelEnd) + tradingPanelEnd.length;

if (startIndex !== -1 && endIndex > startIndex) {
  const actualTradingPanel = `<div \n          className={\`w-full \${t.bg} flex flex-col min-h-0 transition-all duration-300 \${lowerBoxState === 'hidden' ? '' : \`border-t \${t.border} shadow-lg\`} z-10 \${getLowerBoxHeight()}\`}\n          onMouseLeave={() => { \n            if (!isReportPinned && lowerBoxState === 'minimized') {\n              setLowerBoxState('hidden'); \n            }\n          }}\n        >\n          <TradingPanel \n            positions={positions}\n            paperOrders={paperOrders}\n            selectedCoin={selectedCoin}\n            livePrice={livePrice}\n            leverage={leverage}\n            closeActivePosition={closeActivePosition}\n            cancelLimitOrder={cancelLimitOrder}\n            handleExecuteArbitrage={handleExecuteArbitrage}\n            t={t}\n          />\n        </div>`;
  
  code = code.substring(0, startIndex) + actualTradingPanel + code.substring(endIndex);
} else {
  console.log("Could not find TradingPanel block bounds");
}

fs.writeFileSync(path, code);
console.log("WebContainer.tsx updated successfully.");
