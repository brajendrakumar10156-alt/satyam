const fs = require('fs');

const path = 'src/WebContainer.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove runBacktest
const rbStart = code.indexOf('const runBacktest = async () => {');
const rbEndStr = '  const toggleFullscreen = () => {';
const rbEnd = code.indexOf(rbEndStr);
if (rbStart !== -1 && rbEnd !== -1) {
    code = code.substring(0, rbStart) + code.substring(rbEnd);
    console.log('Removed runBacktest');
}

// 2. Remove sendAiMessage
const aiStart = code.indexOf('const sendAiMessage = async (mode = \'chat\', query = null) => {');
const aiEndStr = '  const executeSearch = (targetCoin) => {';
const aiEnd = code.indexOf(aiEndStr);
if (aiStart !== -1 && aiEnd !== -1) {
    code = code.substring(0, aiStart) + code.substring(aiEnd);
    console.log('Removed sendAiMessage');
}

// 3. Add imports
const imports = `import { useWebContainerBacktest } from './hooks/useWebContainerBacktest';
import { useWebContainerAI } from './hooks/useWebContainerAI';
import { RightToolbar } from './components/layout/RightToolbar';
`;
code = code.replace("import { RightSidebar } from './components/layout/RightSidebar';", imports + "import { RightSidebar } from './components/layout/RightSidebar';");

// 4. Add hook initializations inside WebContainer
const initHooks = `
  const { runBacktest } = useWebContainerBacktest({
    editorMode, pineCode, pythonCode, setLastBacktestCode, setLastBacktestMode,
    setBackendOfflineNotice, selectedCoin, chartInterval, backendOnline, checkBackend,
    lastBacktestResultsRef, setMetrics, showToast, setMarketStatus, setActiveTab,
    setSyntaxStatus, lowerBoxState, setLowerBoxState, runRustBacktest, loading, setLoading
  });

  const { sendAiMessage } = useWebContainerAI({
    aiMode, editorMode, pineCode, pythonCode, setSyntaxStatus, showToast, 
    setActiveTab, aiChatHistory, setAiChatHistory, isAiTyping, setIsAiTyping, 
    aiInput, setAiInput
  });
`;
code = code.replace("const handleScreenshot = async () => {", initHooks + "\n  const handleScreenshot = async () => {");

// 5. Replace RightToolbar HTML
const rtStartStr = '{/* Unified Combined Vertical Right Toolbar */}';
const rtEndStr = '{/* AESTHETIC MOBILE BOTTOM NAVIGATION BAR */}';
const rtStart = code.indexOf(rtStartStr);
const rtEnd = code.indexOf(rtEndStr);
if (rtStart !== -1 && rtEnd !== -1) {
    const replacement = `{/* Unified Combined Vertical Right Toolbar */}
      {!isMobile && !focusMode && (
        <RightToolbar 
          isEditorOpen={isEditorOpen} setIsEditorOpen={setIsEditorOpen} 
          isAutoPredictEnabled={isAutoPredictEnabled} handlePredictClick={handlePredictClick} 
          darkMode={darkMode} rightSidebar={rightSidebar} setRightSidebar={setRightSidebar} t={t} 
        />
      )}
      
      `;
    code = code.substring(0, rtStart) + replacement + code.substring(rtEnd);
    console.log('Replaced RightToolbar HTML');
}

fs.writeFileSync(path, code);
console.log('WebContainer.tsx patched successfully.');
