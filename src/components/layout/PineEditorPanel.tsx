import React, { Suspense, lazy } from 'react';
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

    <div className={`flex flex-col h-full ${className}`}>
      <div className={`h-11 border-b ${t.border} flex items-center justify-between px-3 shrink-0 ${t.bg}`}>
        <div className="flex items-center gap-1.5">
          {renderTriangleRIcon()}
          <span className={`font-bold ${t.text} text-sm ml-1`}>Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={runBacktest} disabled={loading} className={`w-9 h-9 md:w-7 md:h-7 ${t.bg} border ${t.border} ${t.text} rounded hover:bg-[#7C5CFF]/10 hover:text-[#7C5CFF] hover:border-[#7C5CFF] flex items-center justify-center transition-colors`}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
          </button>
          {onClose && (
            <button onClick={onClose} className={`p-2 ${t.muted} ${t.hover} rounded-md`} aria-label="Close editor">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className={`flex gap-2 px-2 py-1 ${t.bg} border-b ${t.border} overflow-x-auto dark-scrollbar`}>
        <button onClick={() => { setEditorMode('pine'); setBaseCode(pineCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${editorMode === 'pine' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : `${t.muted} ${t.hover}`}`}>Pine Script</button>
        <button onClick={() => { setEditorMode('python'); setBaseCode(pythonCode); setShowDiff(false); }} className={`px-3 py-1.5 md:px-2 md:py-0.5 rounded text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${editorMode === 'python' ? 'bg-purple-500/15 text-purple-400' : `${t.muted} ${t.hover}`}`}>Python</button>
      </div>

      <div className={`flex items-center gap-1 px-2 py-1 border-b ${t.border} ${t.bg} overflow-x-auto dark-scrollbar`}>
        <button onClick={() => setSubView('code')} className={`px-2 py-1 rounded text-[11px] font-medium shrink-0 whitespace-nowrap ${getSubView() === 'code' ? 'bg-[#7C5CFF]/10 text-[#7C5CFF]' : t.muted}`}>Code</button>
        <button onClick={() => setSubView('ai')} className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 shrink-0 whitespace-nowrap ${getSubView() === 'ai' ? 'bg-purple-500/15 text-purple-400' : t.muted}`}>
          <Sparkles size={11} /> AI
        </button>
        {getSubView() === 'ai' && (
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={`ml-auto shrink-0 text-[10px] rounded px-1.5 py-0.5 border ${t.border} ${t.bg} ${t.text}`}>
            <option value="groq">Groq</option>
            <option value="gemini">Gemini</option>
          </select>
        )}
      </div>

      {getSubView() === 'code' ? (
        <>
          <div className={`h-9 md:h-8 border-b ${t.border} flex items-center px-2 gap-1 shrink-0 ${t.bg} overflow-x-auto dark-scrollbar`}>
            <button onClick={handleUndo} disabled={historyIndex === 0} className={`p-1.5 md:p-1 rounded transition-colors shrink-0 ${historyIndex === 0 ? t.border : `${t.muted} ${t.hover}`}`}><Undo size={13} /></button>
            <button onClick={handleRedo} disabled={historyIndex >= codeHistory.length - 1} className={`p-1.5 md:p-1 rounded transition-colors shrink-0 ${historyIndex >= codeHistory.length - 1 ? t.border : `${t.muted} ${t.hover}`}`}><Redo size={13} /></button>
            <div className={`h-3 w-px shrink-0 ${darkMode ? 'bg-[#2a2e39]' : 'bg-[#e0e3eb]'} mx-1`} />
            <button onClick={() => { setBaseCode(editorMode === 'pine' ? pineCode : pythonCode); setShowDiff(!showDiff); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs shrink-0 whitespace-nowrap ${t.muted} ${t.hover}`}><FileDiff size={12} /> {showDiff ? 'Close' : 'Changes'}</button>
            <button onClick={() => sendAiMessage('fix')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 shrink-0 whitespace-nowrap ${t.hover}`}><Sparkles size={12} /> AI Fix</button>
            {editorMode === 'python' && (
              <button type="button" onClick={() => { handleCodeChange(DEFAULT_PYTHON_STRATEGY); showToast('EMA sample loaded'); }} className={`flex items-center gap-1 px-2 py-1 rounded text-xs text-purple-400 shrink-0 whitespace-nowrap ${t.hover}`}>EMA sample</button>
            )}
          </div>

          {showDiff ? (
            <div className={`flex-1 min-h-0 ${t.bg} overflow-y-auto p-4 dark-scrollbar`}>{renderDiffViewer()}</div>
          ) : (
            <div className={`flex-1 min-h-0 pt-2 ${t.bg}`}>
              <Editor
                height="100%"
                language={editorMode === 'pine' ? 'javascript' : 'python'}
                theme={darkMode ? 'vs-dark' : 'light'}
                value={editorMode === 'pine' ? pineCode : pythonCode}
                onChange={handleCodeChange}
                onMount={(editor, monaco) => {
                  monacoEditorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  formatOnPaste: true,
                  suggestOnTriggerCharacters: true,
                  fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace"
                }}
              />
            </div>
          )}
        </>
      ) : (
        <AiChatPanel />
      )}

      <div className={`h-7 border-t ${t.border} flex items-center justify-between gap-2 px-3 font-medium text-[10px] ${t.bg} transition-colors shrink-0 safe-bottom`}>
        <span className={`${t.muted} truncate`}>{syntaxStatus}</span>
        <button
          type="button"
          onClick={() => checkBackend().then((ok) => showToast(ok ? '✅ API connected' : '❌ API offline — npm run backend'))}
          className={`shrink-0 px-1.5 py-0.5 rounded font-bold ${
            backendOnline === true ? 'text-[#089981]' : backendOnline === false ? 'text-[#F23645]' : t.muted
          }`}
          title="Backtest / AI server (port 8000)"
        >
          API {backendOnline === true ? '●' : backendOnline === false ? '○' : '…'}
        </button>
      </div>
    </div>
  
  );
};
